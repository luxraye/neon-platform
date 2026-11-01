import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  Check,
  ClipboardCheck,
  Lock,
  ShieldCheck,
  Users,
  Wallet,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { FindCentre } from "@/components/marketing/find-centre";
import { ProductPreview } from "@/components/marketing/product-preview";
import { BILLING_PLAN_DEFINITIONS, BILLING_TIERS } from "@/lib/billing";

const features = [
  {
    icon: Users,
    title: "Students and cohorts",
    body: "Every student, class group and tutor in one list. Approve new sign-ups before they get in.",
  },
  {
    icon: ClipboardCheck,
    title: "Attendance in seconds",
    body: "Tutors mark a class present, late or absent from their phone. Headmasters see it straight away.",
  },
  {
    icon: CalendarDays,
    title: "Timetables",
    body: "Build the weekly timetable once. Students and tutors see their own classes for the day.",
  },
  {
    icon: BookOpenCheck,
    title: "Materials and secure quizzes",
    body: "Share notes and past papers. Run timed, password-protected quizzes that mark themselves.",
  },
  {
    icon: Wallet,
    title: "Fees and reminders",
    body: "Record cash and transfer payments, see who still owes, and send reminders in one click.",
  },
  {
    icon: WifiOff,
    title: "Works on weak connections",
    body: "Key class data stays on the device, so lessons carry on when the network drops.",
  },
];

const roles = [
  {
    role: "Headmasters",
    points: ["See attendance, fees and results at a glance", "Add tutors and approve students", "Monthly reports for parents"],
  },
  {
    role: "Tutors",
    points: ["Today's classes and rooms", "Mark attendance and post materials", "Set quizzes and see scores"],
  },
  {
    role: "Students",
    points: ["Timetable on your phone", "Notes, past papers and quizzes", "Track your own progress"],
  },
];

const faqs = [
  {
    q: "How does setup work?",
    a: "We create your centre for you. You add your tutors, and students ask to join with your centre's link. You approve each one.",
  },
  {
    q: "Is our data safe?",
    a: "Each centre's data is kept separate and is only reachable through Neon's server, which checks who is signed in on every request. Data is stored on Google Cloud through Firebase.",
  },
  {
    q: "Do parents and students pay anything?",
    a: "No. Your centre pays a monthly subscription. Students and tutors use Neon free.",
  },
  {
    q: "Can we try it first?",
    a: "Yes. Book a demo and we'll set up a free trial with your own centre.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden bg-ink text-white">
        <div className="bg-grid absolute inset-0" aria-hidden />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-14 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
          <div className="space-y-7">
            <p className="inline-flex items-center gap-2 rounded-full border border-neon/30 bg-neon/10 px-3 py-1 text-xs font-semibold text-neon">
              <span className="size-1.5 rounded-full bg-neon" /> Built for tuition centres in Botswana
            </p>
            <h1 className="text-balance text-4xl font-extrabold leading-[1.05] sm:text-5xl lg:text-6xl">
              Run your whole tuition centre from <span className="text-neon">one place</span>.
            </h1>
            <p className="max-w-xl text-balance text-base text-white/70 sm:text-lg">
              Students, attendance, timetables, learning materials, quizzes and fees. Neon replaces the
              registers, WhatsApp groups and spreadsheets, and keeps working when the internet doesn&apos;t.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" variant="neon">
                <Link href="/contact">
                  Book a free demo <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="border border-white/15 text-white hover:bg-white/10 hover:text-white">
                <Link href="#pricing">See pricing</Link>
              </Button>
            </div>
            <div id="find-centre" className="space-y-2 pt-4">
              <p className="text-sm text-white/60">Student or tutor? Find your centre to join.</p>
              <FindCentre />
            </div>
          </div>
          <ProductPreview />
        </div>
      </section>

      {/* Proof strip */}
      <section className="border-b border-border bg-card">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:grid-cols-3">
          {[
            { k: "1 place", v: "for records, classes, learning and fees" },
            { k: "4 roles", v: "admin, headmaster, tutor and student, each with their own view" },
            { k: "From P400", v: "a month, with no charge to students" },
          ].map((s) => (
            <div key={s.k}>
              <p className="text-2xl font-extrabold text-primary">{s.k}</p>
              <p className="text-sm text-muted-foreground">{s.v}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20">
        <div className="max-w-2xl space-y-3">
          <p className="text-sm font-semibold text-primary">Features</p>
          <h2 className="text-3xl font-extrabold sm:text-4xl">Everything a centre runs on, in one app</h2>
          <p className="text-muted-foreground">
            Neon covers the daily work of a tuition centre, from the first class of the day to the end-of-month fee list.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-card p-6 transition-shadow hover:shadow-md">
              <div className="flex size-10 items-center justify-center rounded-xl bg-secondary text-primary">
                <f.icon className="size-5" />
              </div>
              <h3 className="mt-4 font-bold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Roles */}
      <section id="roles" className="scroll-mt-20 border-y border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <div className="max-w-2xl space-y-3">
            <p className="text-sm font-semibold text-primary">Who it&apos;s for</p>
            <h2 className="text-3xl font-extrabold sm:text-4xl">One centre, a view for everyone</h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {roles.map((r) => (
              <div key={r.role} className="rounded-2xl bg-background p-6 ring-1 ring-border">
                <h3 className="text-lg font-bold">{r.role}</h3>
                <ul className="mt-4 space-y-2.5">
                  {r.points.map((p) => (
                    <li key={p} className="flex gap-2.5 text-sm">
                      <Check className="mt-0.5 size-4 shrink-0 text-success" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20">
        <div className="mx-auto max-w-2xl space-y-3 text-center">
          <p className="text-sm font-semibold text-primary">Pricing</p>
          <h2 className="text-3xl font-extrabold sm:text-4xl">Simple monthly plans</h2>
          <p className="text-muted-foreground">Prices in Botswana Pula. Cancel any time.</p>
        </div>
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {BILLING_TIERS.map((tier) => {
            const plan = BILLING_PLAN_DEFINITIONS[tier];
            const featured = tier === "growth";
            return (
              <div
                key={tier}
                className={
                  featured
                    ? "relative flex flex-col rounded-2xl bg-ink p-7 text-white shadow-xl"
                    : "flex flex-col rounded-2xl border border-border bg-card p-7"
                }
              >
                {featured ? (
                  <span className="absolute -top-3 left-7 rounded-full bg-neon px-3 py-1 text-xs font-bold text-neon-foreground">
                    Most popular
                  </span>
                ) : null}
                <h3 className="text-lg font-bold">{plan.displayName}</h3>
                <p className={featured ? "text-sm text-white/60" : "text-sm text-muted-foreground"}>{plan.targetClient}</p>
                <p className="mt-5 text-3xl font-extrabold">{plan.pricingDisplay}</p>
                <p className={featured ? "text-sm text-white/60" : "text-sm text-muted-foreground"}>{plan.capacityHint}</p>
                <ul className="mt-6 flex-1 space-y-2.5">
                  {plan.includedFeatures.map((f) => (
                    <li key={f} className="flex gap-2.5 text-sm">
                      <Check className={featured ? "mt-0.5 size-4 shrink-0 text-neon" : "mt-0.5 size-4 shrink-0 text-success"} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button asChild className="mt-7 w-full" variant={featured ? "neon" : "outline"}>
                  <Link href={`/contact?plan=${tier}`}>Start with {plan.displayName}</Link>
                </Button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Trust */}
      <section className="bg-ink text-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 md:grid-cols-3">
          {[
            { icon: ShieldCheck, title: "Each centre kept apart", body: "Every request is checked on the server, so one centre can never see another's records." },
            { icon: Lock, title: "Approved sign-ups only", body: "Students ask to join and the headmaster approves them. No strangers in your classes." },
            { icon: BookOpenCheck, title: "Fair quizzes", body: "Answers stay on the server, the timer is enforced, and tab-switching is recorded." },
          ].map((t) => (
            <div key={t.title} className="space-y-2">
              <t.icon className="size-6 text-neon" />
              <h3 className="font-bold">{t.title}</h3>
              <p className="text-sm text-white/60">{t.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-20">
        <h2 className="text-center text-3xl font-extrabold">Questions</h2>
        <div className="mt-8 divide-y divide-border rounded-2xl border border-border bg-card">
          {faqs.map((f) => (
            <details key={f.q} className="group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                {f.q}
                <span className="text-muted-foreground transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-14 text-center text-primary-foreground sm:px-12">
          <div className="bg-grid absolute inset-0 opacity-60" aria-hidden />
          <div className="relative space-y-5">
            <h2 className="text-balance text-3xl font-extrabold sm:text-4xl">See Neon with your own centre</h2>
            <p className="mx-auto max-w-xl text-primary-foreground/80">
              A 20-minute demo, then a free trial set up with your cohorts and tutors.
            </p>
            <Button asChild size="lg" variant="neon">
              <Link href="/contact">
                Book a free demo <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
