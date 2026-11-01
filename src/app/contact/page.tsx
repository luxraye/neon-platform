import type { Metadata } from "next";
import { CalendarCheck, MessageSquare, Rocket } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = { title: "Book a demo" };

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan } = await searchParams;
  return (
    <AuthShell
      title="Book a free demo"
      subtitle="Tell us about your centre. We'll reply within one working day to arrange a time."
      aside={
        <div className="space-y-6">
          <p className="text-3xl font-extrabold leading-tight">
            From demo to <span className="text-neon">running classes</span>.
          </p>
          <ul className="space-y-4 text-white/70">
            <li className="flex gap-3"><MessageSquare className="size-5 shrink-0 text-neon" /> A short call about how your centre works today</li>
            <li className="flex gap-3"><CalendarCheck className="size-5 shrink-0 text-neon" /> A live walkthrough with your own cohorts</li>
            <li className="flex gap-3"><Rocket className="size-5 shrink-0 text-neon" /> We set up your centre and free trial</li>
          </ul>
        </div>
      }
    >
      <ContactForm plan={plan ?? null} />
    </AuthShell>
  );
}
