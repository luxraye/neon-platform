import { describe, expect, it } from "vitest";
import { compare, likeToRegExp, matches, parseColumns, parseOr, project } from "@/lib/server/db-filters";

describe("parseOr", () => {
  it("parses the deleted_at window used by the staff list", () => {
    const f = parseOr("deleted_at.is.null,deleted_at.gte.2026-10-01T00:00:00.000Z");
    expect(f).toEqual({
      kind: "or",
      branches: [
        { kind: "isnull", field: "deleted_at", negate: false },
        { kind: "cmp", field: "deleted_at", op: "gte", value: "2026-10-01T00:00:00.000Z" },
      ],
    });
  });

  it("keeps dots inside values", () => {
    const f = parseOr("email.eq.a.b@example.com");
    expect(f.kind === "or" && f.branches[0]).toEqual({ kind: "eq", field: "email", value: "a.b@example.com" });
  });

  it("rejects operators it does not understand", () => {
    expect(() => parseOr("x.contains.y")).toThrow(/Unsupported/);
  });
});

describe("matches", () => {
  const row = { name: "Kagiso", score: 72, deleted_at: null, cohort_id: "c1" };

  it("handles equality, in and null checks", () => {
    expect(matches(row, { kind: "eq", field: "cohort_id", value: "c1" })).toBe(true);
    expect(matches(row, { kind: "neq", field: "cohort_id", value: "c1" })).toBe(false);
    expect(matches(row, { kind: "in", field: "cohort_id", values: ["c2", "c1"] })).toBe(true);
    expect(matches(row, { kind: "isnull", field: "deleted_at", negate: false })).toBe(true);
    expect(matches(row, { kind: "isnull", field: "missing", negate: false })).toBe(true);
    expect(matches(row, { kind: "isnull", field: "name", negate: true })).toBe(true);
  });

  it("compares numbers and ISO dates", () => {
    expect(matches(row, { kind: "cmp", field: "score", op: "gte", value: 72 })).toBe(true);
    expect(matches(row, { kind: "cmp", field: "score", op: "gt", value: 72 })).toBe(false);
    const dated = { at: "2026-10-29T10:00:00.000Z" };
    expect(matches(dated, { kind: "cmp", field: "at", op: "lt", value: "2026-11-01" })).toBe(true);
  });

  it("never matches a range filter on a missing value", () => {
    expect(matches(row, { kind: "cmp", field: "deleted_at", op: "lt", value: "2030" })).toBe(false);
  });

  it("supports case-insensitive like with % and _", () => {
    expect(matches(row, { kind: "ilike", field: "name", pattern: "%AGI%" })).toBe(true);
    expect(matches(row, { kind: "ilike", field: "name", pattern: "K_giso" })).toBe(true);
    expect(matches(row, { kind: "ilike", field: "name", pattern: "giso" })).toBe(false);
  });

  it("evaluates or branches", () => {
    expect(matches(row, parseOr("name.eq.Neo,score.gt.70"))).toBe(true);
    expect(matches(row, parseOr("name.eq.Neo,score.gt.90"))).toBe(false);
  });
});

describe("likeToRegExp", () => {
  it("escapes regex characters in the pattern", () => {
    expect(likeToRegExp("a.c").test("abc")).toBe(false);
    expect(likeToRegExp("a.c").test("a.c")).toBe(true);
  });
});

describe("compare", () => {
  it("sorts nulls last", () => {
    expect([3, null, 1].sort(compare)).toEqual([1, 3, null]);
  });
});

describe("columns", () => {
  it("treats * and empty as all columns", () => {
    expect(parseColumns("*")).toBeNull();
    expect(parseColumns(undefined)).toBeNull();
    expect(parseColumns(" id, name ")).toEqual(["id", "name"]);
  });

  it("projects missing columns as null", () => {
    expect(project({ id: "1", secret: "x" }, ["id", "name"])).toEqual({ id: "1", name: null });
  });
});
