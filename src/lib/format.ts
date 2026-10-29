/** "just now", "5m", "3h", "2d", then a short date. */
export function timeAgo(iso: string | number | Date, now = Date.now()) {
  const t = new Date(iso).getTime();
  const mins = Math.round((now - t) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function pula(n: number) {
  return `P${n.toLocaleString("en-BW", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
