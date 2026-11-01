"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from "firebase/auth";
import { firebaseClientAuth } from "@/lib/firebase/client";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { clearOfflineCache } from "@/lib/offline-cache";
import { FormError } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function friendlyAuthError(code: string | undefined): string {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-email":
      return "That email and password don't match. Check them and try again.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a few minutes, or reset your password.";
    case "auth/user-disabled":
      return "This account has been switched off. Contact your centre.";
    case "auth/network-request-failed":
      return "No connection. Check your internet and try again.";
    default:
      return "Sign-in failed. Please try again.";
  }
}

export function LoginForm({ next }: { next: string | null }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const configured = isFirebaseConfigured();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const auth = await firebaseClientAuth();
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const idToken = await cred.user.getIdToken();
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; home?: string };
      // The server now holds the session in a cookie; drop the browser copy.
      await signOut(auth).catch(() => undefined);
      if (!res.ok || !body.ok) {
        setError(body.error ?? "Sign-in failed. Please try again.");
        return;
      }
      // Start clean so another person's cached data never shows on a shared device.
      queryClient.clear();
      await clearOfflineCache();
      router.replace(next ?? body.home ?? "/dashboard");
      router.refresh();
    } catch (err) {
      setError(friendlyAuthError((err as { code?: string })?.code));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setError(null);
    setNotice(null);
    if (!email.trim()) {
      setError("Type your email above first, then tap “Forgot password”.");
      return;
    }
    try {
      const auth = await firebaseClientAuth();
      await sendPasswordResetEmail(auth, email.trim());
    } catch {
      // Same message either way, so nobody can probe which emails have accounts.
    }
    setNotice("If that email has a Neon account, a reset link is on its way.");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {!configured ? (
        <FormError message="Sign-in isn't set up yet: the Firebase settings are missing on this server." />
      ) : null}
      <FormError message={error} />
      {notice ? (
        <p role="status" className="rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-sm text-success">
          {notice}
        </p>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          inputMode="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          disabled={loading}
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <button type="button" onClick={handleReset} className="text-xs font-medium text-primary hover:underline">
            Forgot password?
          </button>
        </div>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          disabled={loading}
        />
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={loading || !configured || !email || !password}>
        {loading ? "Signing in…" : "Sign in"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        New student?{" "}
        <Link href="/#find-centre" className="font-medium text-primary hover:underline">
          Find your centre to join
        </Link>
      </p>
    </form>
  );
}
