"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { FormError } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestToJoin } from "./actions";

export function JoinForm({ subdomain }: { subdomain: string }) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await requestToJoin(subdomain, { email, full_name: fullName, message, website });
    setSubmitting(false);
    if (result.success) setSent(true);
    else setError(result.error);
  };

  if (sent) {
    return (
      <div className="space-y-4 rounded-2xl border border-success/30 bg-success/5 p-6">
        <CheckCircle2 className="size-8 text-success" />
        <p className="font-bold">Request sent</p>
        <p className="text-sm text-muted-foreground">
          Your headmaster will review it. When it&apos;s approved you&apos;ll get an email at <strong>{email}</strong> with
          a link to set your password.
        </p>
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">Go to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <FormError message={error} />
      <div className="space-y-2">
        <Label htmlFor="join-name">Full name</Label>
        <Input
          id="join-name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="As your centre knows you"
          autoComplete="name"
          required
          maxLength={120}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="join-email">Email</Label>
        <Input
          id="join-email"
          type="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          autoComplete="email"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="join-message">
          Note for the headmaster <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <textarea
          id="join-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="e.g. Form 5, Maths and Physics"
          maxLength={500}
          rows={3}
          className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>
      {/* Honeypot: hidden from people, tempting for bots. */}
      <div className="hidden" aria-hidden>
        <label htmlFor="website">Website</label>
        <input id="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={submitting}>
        {submitting ? "Sending…" : "Send request"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Already approved?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
