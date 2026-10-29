import { describe, expect, it } from "vitest";
import { roleRoot } from "@/lib/role-root";
import { daysUntil, isPast, pula, timeAgo } from "@/lib/format";
import { todayDayOfWeek, todayIso } from "@/app/_shared/overview/helpers";
import { safeHttpUrl } from "@/lib/server/guards";

describe("safeHttpUrl", () => {
  it("allows http and https links", () => {
    expect(safeHttpUrl(" https://example.com/notes.pdf ")).toBe("https://example.com/notes.pdf");
    expect(safeHttpUrl("http://example.com")).toBe("http://example.com/");
  });

  it("blocks script and data links", () => {
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("data:text/html,<b>x</b>")).toBeNull();
    expect(safeHttpUrl("not a url")).toBeNull();
    expect(safeHttpUrl("")).toBeNull();
  });
});

describe("roleRoot", () => {
  it("prefers the role, then the path", () => {
    expect(roleRoot("tutor", "/student/x")).toBe("/tutor");
    expect(roleRoot(null, "/headmaster/staff")).toBe("/headmaster");
    expect(roleRoot(undefined, "/somewhere")).toBe("/dashboard");
  });
});

describe("format", () => {
  it("formats pula", () => {
    expect(pula(500)).toBe("P500");
    expect(pula(1250.5)).toBe("P1,250.5");
  });

  it("describes recent times", () => {
    const now = Date.parse("2026-10-29T12:00:00Z");
    expect(timeAgo("2026-10-29T11:59:40Z", now)).toBe("just now");
    expect(timeAgo("2026-10-29T11:15:00Z", now)).toBe("45m ago");
    expect(timeAgo("2026-10-29T07:00:00Z", now)).toBe("5h ago");
    expect(timeAgo("2026-10-27T12:00:00Z", now)).toBe("2d ago");
  });

  it("knows past and future dates", () => {
    expect(isPast("2000-01-01")).toBe(true);
    expect(isPast("2999-01-01")).toBe(false);
    expect(daysUntil("2000-01-01")).toBe(0);
  });
});

describe("centre-local dates", () => {
  // 23:30 UTC on Saturday is already Sunday in Gaborone (UTC+2).
  const lateSaturdayUtc = new Date("2026-10-31T23:30:00Z");

  it("reads the date in Africa/Gaborone, not UTC", () => {
    expect(todayIso(lateSaturdayUtc)).toBe("2026-11-01");
  });

  it("numbers Sunday as 7", () => {
    expect(todayDayOfWeek(lateSaturdayUtc)).toBe(7);
    expect(todayDayOfWeek(new Date("2026-10-26T08:00:00Z"))).toBe(1);
  });
});
