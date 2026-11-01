import "server-only";

/** Centres are in Botswana by default; servers run in UTC, so dates are read in this zone. */
export const APP_TIMEZONE = process.env.APP_TIMEZONE || "Africa/Gaborone";

function zoned(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { iso: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) % 24, weekday: get("weekday") };
}

const WEEKDAY: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

/** Monday = 1 … Sunday = 7, matching the timetable's day_of_week. */
export function todayDayOfWeek(date = new Date()) {
  return WEEKDAY[zoned(date).weekday] ?? 1;
}

export function todayIso(date = new Date()) {
  return zoned(date).iso;
}

export function startOfMonthIso(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString();
}

export function greeting(date = new Date()) {
  const h = zoned(date).hour;
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function firstName(full: string | null | undefined, email: string | null | undefined) {
  const n = full?.trim().split(/\s+/)[0];
  if (n) return n;
  return email?.split("@")[0] ?? "there";
}

export function formatPula(amount: number) {
  return `P ${amount.toLocaleString("en-BW", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function shortTime(t: string | null | undefined) {
  return (t ?? "").slice(0, 5);
}
