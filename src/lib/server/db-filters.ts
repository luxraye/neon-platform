/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Pure filtering helpers for the Firestore query builder in `db.ts`. Kept separate (and free
 * of server-only imports) so they can be unit tested.
 */

export type Row = Record<string, any>;
export type DbError = { message: string; code?: string };
export type DbResult<T = any> = { data: T; error: DbError | null; count: number | null };

export type Primitive = string | number | boolean | null;

export type Filter =
  | { kind: "eq"; field: string; value: Primitive }
  | { kind: "neq"; field: string; value: Primitive }
  | { kind: "in"; field: string; values: Primitive[] }
  | { kind: "cmp"; field: string; op: "gt" | "gte" | "lt" | "lte"; value: Primitive }
  | { kind: "ilike"; field: string; pattern: string }
  | { kind: "isnull"; field: string; negate: boolean }
  | { kind: "or"; branches: Filter[] };

export function likeToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".");
  return new RegExp(`^${escaped}$`, "i");
}

export function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a) < String(b) ? -1 : 1;
}

export function matches(row: Row, f: Filter): boolean {
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

export function parseLiteral(raw: string): Primitive {
  if (raw === "null") return null;
  if (raw === "true") return true;
  if (raw === "false") return false;
  return raw;
}

/** Parses the PostgREST-style `or` strings used in the app, e.g. `a.eq.1,b.is.null,c.ilike.%x%`. */
export function parseOr(expr: string): Filter {
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

export function project(row: Row, columns: string[] | null): Row {
  if (!columns) return row;
  const out: Row = {};
  for (const c of columns) out[c] = row[c] ?? null;
  return out;
}

export function parseColumns(cols?: string): string[] | null {
  if (!cols || cols.trim() === "*") return null;
  return cols
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}

