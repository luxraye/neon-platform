"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { FormError } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitLead } from "@/app/actions";

export function ContactForm({ plan }: { plan: string | null }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [centre, setCentre] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await submitLead({
        name,
        email,
        phone: phone || undefined,
        institution_name: centre || undefined,
        message: message || undefined,
        plan: plan ?? undefined,
        website,
      });
      if (result.success) setDone(true);
      else setError(result.error);
    });
  };

  if (done) {
    return (
      <div className="space-y-4 rounded-2xl border border-success/30 bg-success/5 p-6">
        <CheckCircle2 className="size-8 text-success" />
        <p className="font-bold">Thanks, {name.split(" ")[0] || "we've got it"}.</p>
        <p className="text-sm text-muted-foreground">We&apos;ll be in touch at {email} to set up your demo.</p>
        <Button asChild variant="outline" className="w-full">
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <FormError message={error} />
      <div className="space-y-2">
        <Label htmlFor="name">Your name</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">
            Phone <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input id="phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="+267" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="centre">Tuition centre</Label>
        <Input id="centre" value={centre} onChange={(e) => setCentre(e.target.value)} placeholder="e.g. Bright Minds Academy" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="message">
          Anything we should know? <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <textarea
          id="message"
          rows={3}
          className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Number of students, subjects, best time to call…"
        />
      </div>
      <div className="hidden" aria-hidden>
        <label htmlFor="website">Website</label>
        <input id="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>
      {plan ? (
        <p className="text-sm text-muted-foreground">
          Interested in: <strong className="capitalize text-foreground">{plan}</strong> plan
        </p>
      ) : null}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Request a demo"}
      </Button>
    </form>
  );
}
