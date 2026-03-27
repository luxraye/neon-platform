"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useTransition } from "react";
import { findSchool } from "./actions";
import { toast } from "sonner";
import { BILLING_PLAN_DEFINITIONS, BILLING_TIERS } from "@/lib/billing";

export default function Home() {
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    startTransition(async () => {
      const result = await findSchool(q);
      if (!result) {
        toast.error("School not found. Check the spelling or ask your headmaster for the join link.");
        return;
      }
      window.location.href = `/join/${result.subdomain}`;
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-50">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-white/15 p-1.5 shadow-[0_0_24px_rgba(74,222,128,0.25)] ring-1 ring-emerald-300/40">
              <Image
                src="/logo.png"
                alt="Neon"
                fill
                className="object-contain"
                sizes="56px"
                priority
              />
            </div>
            <span className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.45)] sm:text-base">
              STUDENT MANAGEMENT PLATFORM
            </span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/login" className="text-slate-200 hover:text-white">
              Sign in
            </Link>
            <Button asChild size="sm" className="rounded-full">
              <Link href="/contact">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-12 lg:flex lg:items-start lg:gap-12">
        <section className="flex-1 space-y-8 font-serif">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
              Operating system for tuition centres
            </p>
            <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
              Neon is the student management backbone for Botswana&apos;s tuition centres.
            </h1>
            <p className="max-w-xl text-balance text-sm sm:text-base text-slate-300">
              From attendance and payments to forums and performance reports, Neon keeps your
              centre online—even when the internet isn&apos;t.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <h3 className="text-sm font-semibold mb-1">Offline-first (NLM)</h3>
              <p className="text-xs text-slate-300">
                Neon Local Mode currently supports offline caching for key class data like cohorts,
                timetables, attendance drafts, and community activity while broader sync coverage is
                being rolled out.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <h3 className="text-sm font-semibold mb-1">Strict data isolation</h3>
              <p className="text-xs text-slate-300">
                Every centre is row-level secured, with role-based visibility controls already active
                and continuous hardening of service-level checks in progress.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <h3 className="text-sm font-semibold mb-1">Automated billing</h3>
              <p className="text-xs text-slate-300">
                Tiered pricing and per-student monthly reports are active, with fully automated
                invoicing and payment settlement currently being finalized.
              </p>
            </div>
          </div>

          <section aria-labelledby="pricing-heading" className="mt-6 space-y-4">
            <h2 id="pricing-heading" className="text-sm font-semibold text-slate-200">
              Simple pricing for centres of every size
            </h2>
            <div className="grid gap-4 sm:grid-cols-3 text-xs">
              {BILLING_TIERS.map((tier) => {
                const plan = BILLING_PLAN_DEFINITIONS[tier];
                const accent =
                  tier === "starter"
                    ? "border-white/10 bg-white/5 text-emerald-400"
                    : tier === "growth"
                    ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-300"
                    : "border-amber-400/60 bg-amber-500/5 text-amber-300";
                return (
                  <div key={tier} className={`rounded-2xl border p-4 ${accent}`}>
                    <p className="text-xs font-semibold">{plan.displayName}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-100">{plan.targetClient}</p>
                    <p className="mt-1 text-xs text-slate-200">{plan.pricingDisplay}</p>
                    <p className="mt-1 text-xs text-slate-300">{plan.capacityHint}</p>
                    <ul className="mt-3 space-y-1 text-slate-100">
                      {plan.homepageHighlights.map((highlight) => (
                        <li key={highlight}>• {highlight}</li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="rounded-full px-6">
                <Link href="/contact">Talk to the Neon team</Link>
              </Button>
              <p className="text-xs text-slate-300">
                Full pricing guide is available in the headmaster dashboard after onboarding.
              </p>
            </div>
          </section>
        </section>

        <aside className="mt-10 w-full max-w-md space-y-6 rounded-2xl border border-white/10 bg-slate-900/70 p-5 lg:mt-0">
          <h2 className="text-sm font-semibold text-slate-100">
            Find my school
          </h2>
          <p className="text-xs text-slate-300">
            Students and parents: search for your tuition centre to join with the correct account.
          </p>
          <form className="space-y-3" onSubmit={onSearch}>
            <div className="space-y-1">
              <Label htmlFor="school-search" className="text-xs">School name or subdomain</Label>
              <Input
                id="school-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. Aleph, aleph.neon.bw"
              />
            </div>
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Searching…" : "Find my school"}
            </Button>
          </form>

          <div className="mt-6 space-y-3 border-t border-white/10 pt-4 text-xs text-slate-300">
            <p className="font-semibold text-slate-100">Why schools pick Neon</p>
            <ul className="space-y-1">
              <li>• Built for Botswana&apos;s connectivity realities.</li>
              <li>• Clean roles: admin, headmaster, tutor, student.</li>
              <li>• Easy onboarding: we migrate your students for you.</li>
            </ul>
          </div>
        </aside>
      </main>
      <footer className="border-t border-white/10 bg-slate-950/70">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-xs text-slate-300">
          <p className="font-serif text-slate-200">Contact: giftjrnakedi@gmail.com</p>
          <p className="font-serif">
            Cell: +267 72161038 | WhatsApp: +267 72161038
          </p>
        </div>
      </footer>
    </div>
  );
}
