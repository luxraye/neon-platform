import "server-only";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { randomUUID } from "crypto";
import type { Query, DocumentData } from "firebase-admin/firestore";
import { adminFirestore } from "@/lib/firebase/admin";
import {
  COLLECTION_DEFAULTS,
  HAS_CREATED_AT,
  NATURAL_KEYS,
  type CollectionName,
} from "@/lib/server/schema";

/**
 * Neon's server-side data layer over Firestore.
 *
 * It keeps a small, chainable query API (`from().select().eq().order()`) so business logic
 * reads the same way across the app. Only equality and `in` filters go to Firestore, which
 * means no composite indexes are needed. Range filters, `or`, ordering and limits run in
 * memory on the result. That is fine for per-centre data volumes; revisit if a single
 * centre grows past tens of thousands of documents in one collection.
 *
 * Server-only. There is no row-level security here: every caller must scope queries by
 * the signed-in user's `institution_id` (see `requireIdentity` in `@/lib/auth/identity`).
 */

export type Row = Record<string, any>;
export type DbError = { message: string; code?: string };
export type DbResult<T = any> = { data: T; error: DbError | null; count: number | null };

type Primitive = string | number | boolean | null;

type Filter =
  | { kind: "eq"; field: string; value: Primitive }
  | { kind: "neq"; field: string; value: Primitive }
  | { kind: "in"; field: string; values: Primitive[] }
  | { kind: "cmp"; field: string; op: "gt" | "gte" | "lt" | "lte"; value: Primitive }
  | { kind: "ilike"; field: string; pattern: string }
  | { kind: "isnull"; field: string; negate: boolean }
  | { kind: "or"; branches: Filter[] };

type Action =
  | { kind: "select" }
  | { kind: "insert"; rows: Row[] }
  | { kind: "update"; patch: Row }
  | { kind: "upsert"; rows: Row[]; onConflict: string[] }
  | { kind: "delete" };

const IN_CHUNK = 30;

function nowIso() {
  return new Date().toISOString();
}

function errorOf(e: unknown): DbError {
  if (e && typeof e === "object" && "message" in e) {
    return { message: String((e as { message: unknown }).message) };
  }
  return { message: String(e) };
}

function likeToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".");
  return new RegExp(`^${escaped}$`, "i");
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a) < String(b) ? -1 : 1;
}

function matches(row: Row, f: Filter): boolean {
  const v = "field" in f ? row[f.field] ?? null : null;
  switch (f.kind) {
    case "eq":
      return v === f.value;
    case "neq":
      return v !== f.value;
    case "in":
      return f.values.includes(v);
    case "cmp": {
      if (v === null) return false;
      const c = compare(v, f.value);
      return f.op === "gt" ? c > 0 : f.op === "gte" ? c >= 0 : f.op === "lt" ? c < 0 : c <= 0;
    }
    case "ilike":
      return typeof v === "string" && likeToRegExp(f.pattern).test(v);
    case "isnull":
      return f.negate ? v !== null : v === null;
    case "or":
      return f.branches.some((b) => matches(row, b));
  }
}

function parseLiteral(raw: string): Primitive {
  if (raw === "null") return null;
  if (raw === "true") return true;
  if (raw === "false") return false;
  return raw;
}

/** Parses the PostgREST-style `or` strings used in the app, e.g. `a.eq.1,b.is.null,c.ilike.%x%`. */
function parseOr(expr: string): Filter {
  const branches: Filter[] = [];
  for (const part of expr.split(",")) {
    const [field, op, ...rest] = part.trim().split(".");
    const value = rest.join(".");
    switch (op) {
      case "eq":
        branches.push({ kind: "eq", field, value: parseLiteral(value) });
        break;
      case "neq":
        branches.push({ kind: "neq", field, value: parseLiteral(value) });
        break;
      case "is":
        branches.push({ kind: "isnull", field, negate: value !== "null" });
        break;
      case "ilike":
      case "like":
        branches.push({ kind: "ilike", field, pattern: value });
        break;
      case "gt":
      case "gte":
      case "lt":
      case "lte":
        branches.push({ kind: "cmp", field, op, value: parseLiteral(value) });
        break;
      default:
        throw new Error(`Unsupported or() operator: ${op}`);
    }
  }
  return { kind: "or", branches };
}

function project(row: Row, columns: string[] | null): Row {
  if (!columns) return row;
  const out: Row = {};
  for (const c of columns) out[c] = row[c] ?? null;
  return out;
}

function parseColumns(cols?: string): string[] | null {
  if (!cols || cols.trim() === "*") return null;
  return cols
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}

export class QueryBuilder<T = any> implements PromiseLike<DbResult<T[]>> {
  private filters: Filter[] = [];
  private orders: { field: string; ascending: boolean }[] = [];
  private limitN: number | null = null;
  private rangeFrom: number | null = null;
  private columns: string[] | null = null;
  private returning = false;
  private countOnly = false;
  private wantCount = false;
  private singleMode: "one" | "maybe" | null = null;
  private action: Action = { kind: "select" };

  constructor(private readonly table: CollectionName) {}

  // ---- builders -------------------------------------------------------------

  select(cols?: string, opts?: { count?: "exact"; head?: boolean }): this {
    if (this.action.kind !== "select") this.returning = true;
    this.columns = parseColumns(cols);
    if (opts?.count) this.wantCount = true;
    if (opts?.head) this.countOnly = true;
    return this;
  }

  insert(rows: Row | Row[]): this {
    this.action = { kind: "insert", rows: Array.isArray(rows) ? rows : [rows] };
    return this;
  }

  update(patch: Row): this {
    this.action = { kind: "update", patch };
    return this;
  }

  upsert(rows: Row | Row[], opts?: { onConflict?: string }): this {
    const onConflict = (opts?.onConflict ?? NATURAL_KEYS[this.table] ?? "id")
      .split(",")
      .map((s) => s.trim());
    this.action = { kind: "upsert", rows: Array.isArray(rows) ? rows : [rows], onConflict };
    return this;
  }

  delete(): this {
    this.action = { kind: "delete" };
    return this;
  }

  eq(field: string, value: Primitive): this {
    this.filters.push({ kind: "eq", field, value });
    return this;
  }

  neq(field: string, value: Primitive): this {
    this.filters.push({ kind: "neq", field, value });
    return this;
  }

  in(field: string, values: readonly unknown[]): this {
    this.filters.push({ kind: "in", field, values: [...values] as Primitive[] });
    return this;
  }

  is(field: string, value: null): this {
    void value;
    this.filters.push({ kind: "isnull", field, negate: false });
    return this;
  }

  not(field: string, op: "is", value: null): this {
    void op;
    void value;
    this.filters.push({ kind: "isnull", field, negate: true });
    return this;
  }

  gt(field: string, value: Primitive): this {
    this.filters.push({ kind: "cmp", field, op: "gt", value });
    return this;
  }

  gte(field: string, value: Primitive): this {
    this.filters.push({ kind: "cmp", field, op: "gte", value });
    return this;
  }

  lt(field: string, value: Primitive): this {
    this.filters.push({ kind: "cmp", field, op: "lt", value });
    return this;
  }

  lte(field: string, value: Primitive): this {
    this.filters.push({ kind: "cmp", field, op: "lte", value });
    return this;
  }

  ilike(field: string, pattern: string): this {
    this.filters.push({ kind: "ilike", field, pattern });
    return this;
  }

  or(expr: string): this {
    this.filters.push(parseOr(expr));
    return this;
  }

  order(field: string, opts?: { ascending?: boolean }): this {
    this.orders.push({ field, ascending: opts?.ascending ?? true });
    return this;
  }

  limit(n: number): this {
    this.limitN = n;
    return this;
  }

  range(from: number, to: number): this {
    this.rangeFrom = from;
    this.limitN = to - from + 1;
    return this;
  }

  maybeSingle<R = T>(): PromiseLike<DbResult<R | null>> {
    this.singleMode = "maybe";
    return this as unknown as PromiseLike<DbResult<R | null>>;
  }

  /** Resolves with an error when no row matches. */
  single<R = T>(): PromiseLike<DbResult<R>> {
    this.singleMode = "one";
    return this as unknown as PromiseLike<DbResult<R>>;
  }

  then<A = DbResult<T[]>, B = never>(
    onfulfilled?: ((value: DbResult<T[]>) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null
  ): PromiseLike<A | B> {
    return this.execute().then(onfulfilled, onrejected);
  }

  // ---- execution ------------------------------------------------------------

  private col() {
    return adminFirestore().collection(this.table);
  }

  /** Fetches candidate rows using only equality/in filters, then applies the rest in memory. */
  private async fetchMatching(): Promise<Row[]> {
    const pushable = this.filters.filter(
      (f): f is Extract<Filter, { kind: "eq" | "in" }> => f.kind === "eq" || f.kind === "in"
    );
    const idEq = pushable.find((f) => f.kind === "eq" && f.field === "id") as
      | { kind: "eq"; field: string; value: Primitive }
      | undefined;

    let rows: Row[] = [];

    if (idEq) {
      if (typeof idEq.value !== "string" || !idEq.value) return [];
      const snap = await this.col().doc(idEq.value).get();
      rows = snap.exists ? [{ ...(snap.data() as Row), id: snap.id }] : [];
    } else {
      const inFilter = pushable.find((f) => f.kind === "in") as
        | { kind: "in"; field: string; values: Primitive[] }
        | undefined;
      const eqFilters = pushable.filter((f) => f.kind === "eq") as {
        field: string;
        value: Primitive;
      }[];

      let base: Query<DocumentData> = this.col();
      for (const f of eqFilters) base = base.where(f.field, "==", f.value);

      if (inFilter) {
        const values = [...new Set(inFilter.values)];
        if (values.length === 0) return [];
        const chunks: Primitive[][] = [];
        for (let i = 0; i < values.length; i += IN_CHUNK) chunks.push(values.slice(i, i + IN_CHUNK));
        const snaps = await Promise.all(
          chunks.map((chunk) =>
            inFilter.field === "id"
              ? Promise.all(chunk.map((id) => this.col().doc(String(id)).get())).then((docs) =>
                  docs.filter((d) => d.exists).map((d) => ({ ...(d.data() as Row), id: d.id }))
                )
              : base
                  .where(inFilter.field, "in", chunk)
                  .get()
                  .then((s) => s.docs.map((d) => ({ ...(d.data() as Row), id: d.id })))
          )
        );
        rows = snaps.flat();
      } else {
        const snap = await base.get();
        rows = snap.docs.map((d) => ({ ...(d.data() as Row), id: d.id }));
      }
    }

    return rows.filter((r) => this.filters.every((f) => matches(r, f)));
  }

  private sortAndSlice(rows: Row[]): Row[] {
    let out = rows;
    if (this.orders.length) {
      out = [...rows].sort((a, b) => {
        for (const o of this.orders) {
          const c = compare(a[o.field], b[o.field]);
          if (c !== 0) return o.ascending ? c : -c;
        }
        return 0;
      });
    }
    const start = this.rangeFrom ?? 0;
    if (this.limitN !== null || start > 0) {
      out = out.slice(start, this.limitN !== null ? start + this.limitN : undefined);
    }
    return out;
  }

  private withDefaults(row: Row): Row {
    const defaults = COLLECTION_DEFAULTS[this.table] ?? {};
    const out: Row = { ...defaults, ...row };
    if (HAS_CREATED_AT.has(this.table) && !out.created_at) out.created_at = nowIso();
    return out;
  }

  private docIdFor(row: Row): string {
    const natural = NATURAL_KEYS[this.table];
    if (natural && row[natural]) return String(row[natural]);
    return typeof row.id === "string" && row.id ? row.id : randomUUID();
  }

  private finish(rows: Row[], count: number | null = null): DbResult<any> {
    const shaped = rows.map((r) => project(r, this.columns));
    if (this.singleMode) {
      if (shaped.length > 1) {
        return { data: null, error: { message: "Multiple rows returned for a single-row query." }, count };
      }
      if (shaped.length === 0) {
        return this.singleMode === "one"
          ? { data: null, error: { message: "No rows found.", code: "PGRST116" }, count }
          : { data: null, error: null, count };
      }
      return { data: shaped[0], error: null, count };
    }
    return { data: shaped, error: null, count };
  }

  private async execute(): Promise<DbResult<any>> {
    try {
      switch (this.action.kind) {
        case "select": {
          const rows = await this.fetchMatching();
          const count = this.wantCount ? rows.length : null;
          if (this.countOnly) return { data: null, error: null, count };
          return this.finish(this.sortAndSlice(rows), count);
        }
        case "insert": {
          const db = adminFirestore();
          const batch = db.batch();
          const written: Row[] = [];
          for (const raw of this.action.rows) {
            const row = this.withDefaults(raw);
            const id = this.docIdFor(row);
            const doc = { ...row, id };
            batch.create(this.col().doc(id), doc);
            written.push(doc);
          }
          await batch.commit();
          return this.returning ? this.finish(written) : { data: null, error: null, count: null };
        }
        case "update": {
          if (this.filters.length === 0) throw new Error("Refusing to update without a filter.");
          const rows = await this.fetchMatching();
          const patch = { ...this.action.patch };
          delete patch.id;
          const db = adminFirestore();
          const updated: Row[] = [];
          for (let i = 0; i < rows.length; i += 400) {
            const batch = db.batch();
            for (const r of rows.slice(i, i + 400)) {
              batch.update(this.col().doc(r.id), patch);
              updated.push({ ...r, ...patch });
            }
            await batch.commit();
          }
          return this.returning ? this.finish(updated) : { data: null, error: null, count: null };
        }
        case "upsert": {
          const db = adminFirestore();
          const written: Row[] = [];
          for (const raw of this.action.rows) {
            const keys = this.action.onConflict;
            let existing: Row | null = null;
            if (keys.length === 1 && (keys[0] === "id" || keys[0] === NATURAL_KEYS[this.table])) {
              const id = keys[0] === "id" ? raw.id : raw[keys[0]];
              if (id) {
                const snap = await this.col().doc(String(id)).get();
                existing = snap.exists ? { ...(snap.data() as Row), id: snap.id } : null;
              }
            } else {
              let q: Query<DocumentData> = this.col();
              for (const k of keys) q = q.where(k, "==", raw[k] ?? null);
              const snap = await q.limit(1).get();
              existing = snap.empty ? null : { ...(snap.docs[0].data() as Row), id: snap.docs[0].id };
            }
            if (existing) {
              const patch = { ...raw };
              delete patch.id;
              await this.col().doc(existing.id).set(patch, { merge: true });
              written.push({ ...existing, ...patch });
            } else {
              const row = this.withDefaults(raw);
              const id = this.docIdFor(row);
              const doc = { ...row, id };
              await db.collection(this.table).doc(id).set(doc);
              written.push(doc);
            }
          }
          return this.returning ? this.finish(written) : { data: null, error: null, count: null };
        }
        case "delete": {
          if (this.filters.length === 0) throw new Error("Refusing to delete without a filter.");
          const rows = await this.fetchMatching();
          const db = adminFirestore();
          for (let i = 0; i < rows.length; i += 400) {
            const batch = db.batch();
            for (const r of rows.slice(i, i + 400)) batch.delete(this.col().doc(r.id));
            await batch.commit();
          }
          return this.returning ? this.finish(rows) : { data: null, error: null, count: null };
        }
      }
    } catch (e) {
      return { data: null, error: errorOf(e), count: null };
    }
  }
}

export function from<T = any>(table: CollectionName): QueryBuilder<T> {
  return new QueryBuilder<T>(table);
}

/** The data-layer handle used across server code: `const db = getDb(); db.from("cohorts")...` */
export function getDb() {
  return { from };
}
