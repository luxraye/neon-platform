import "server-only";

/** Monday = 1 … Sunday = 7, matching the timetable's day_of_week. */
export function todayDayOfWeek(date = new Date()) {
  return date.getDay() === 0 ? 7 : date.getDay();
}

export function todayIso(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function startOfMonthIso(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString();
}

export function greeting(date = new Date()) {
  const h = date.getHours();
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
