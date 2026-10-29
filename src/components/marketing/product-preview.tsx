import { CalendarClock, CheckCircle2, Wallet, Users } from "lucide-react";

/** A static, illustrative picture of the headmaster dashboard for the landing page. */
export function ProductPreview() {
  const classes = [
    { time: "14:00", subject: "Mathematics", cohort: "Form 5 A", room: "Room 2" },
    { time: "15:30", subject: "Physics", cohort: "Form 4 B", room: "Lab" },
    { time: "17:00", subject: "English", cohort: "Form 5 B", room: "Room 1" },
  ];
  return (
    <div className="relative" aria-hidden>
      <div className="absolute -inset-6 rounded-[2rem] bg-neon/10 blur-3xl" />
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#14172e] shadow-2xl">
        <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
          <span className="size-2.5 rounded-full bg-white/15" />
          <span className="size-2.5 rounded-full bg-white/15" />
          <span className="size-2.5 rounded-full bg-white/15" />
          <span className="ml-3 text-xs text-white/40">Bright Minds Academy · Overview</span>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-3">
          {[
            { icon: Users, label: "Active students", value: "184" },
            { icon: CheckCircle2, label: "Attendance today", value: "92%" },
            { icon: Wallet, label: "Fees this month", value: "P 41,200" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <s.icon className="size-4 text-neon" />
              <p className="mt-2 text-xl font-bold text-white">{s.value}</p>
              <p className="text-xs text-white/50">{s.label}</p>
            </div>
          ))}
        </div>
        <div className="px-4 pb-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.03]">
            <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2.5 text-xs font-semibold text-white/70">
              <CalendarClock className="size-3.5" /> Today&apos;s classes
            </div>
            <ul className="divide-y divide-white/5">
              {classes.map((c) => (
                <li key={c.time} className="flex items-center justify-between px-3 py-2.5 text-sm">
                  <span className="flex items-center gap-3">
                    <span className="font-mono text-xs text-neon">{c.time}</span>
                    <span className="text-white">{c.subject}</span>
                  </span>
                  <span className="text-xs text-white/50">
                    {c.cohort} · {c.room}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
