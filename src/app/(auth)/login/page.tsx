import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
  return (
    <AuthShell title="Welcome back" subtitle="Sign in with the email your centre registered for you.">
      <LoginForm next={safeNext} />
    </AuthShell>
  );
}
