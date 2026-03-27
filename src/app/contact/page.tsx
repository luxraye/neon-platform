"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { submitLead } from "@/app/actions";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [centre, setCentre] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await submitLead({
        name,
        email,
        institution_name: centre || undefined,
        message: message || undefined,
      });
      if (result.success) {
        toast.success("Request received. An admin will contact you shortly.");
        setName("");
        setEmail("");
        setCentre("");
        setMessage("");
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-12">
        <Link href="/" className="text-sm text-muted-foreground underline">
          ← Back
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">
          Get started with Neon
        </h1>
        <p className="mt-2 text-muted-foreground">
          Neon is currently onboarded manually to ensure every tuition centre is set up correctly.
        </p>

        <form
          className="mt-8 space-y-4 rounded-xl border bg-card p-6"
          onSubmit={handleSubmit}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="centre">Tuition centre</Label>
            <Input id="centre" value={centre} onChange={(e) => setCentre(e.target.value)} placeholder="e.g. Aleph Tuition" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message (optional)</Label>
            <textarea
              id="message"
              className="w-full min-h-24 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Number of students, subjects offered, any requirements…"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Submitting…" : "Submit request"}
            </Button>
            <Button asChild type="button" variant="outline">
              <a href="/login">Already onboarded? Sign in</a>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

