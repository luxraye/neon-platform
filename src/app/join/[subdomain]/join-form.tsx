"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { signUpForInstitution } from "./actions";

export function JoinForm({ subdomain, primaryColor }: { subdomain: string; primaryColor?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const result = await signUpForInstitution(subdomain, {
      email,
      password,
      full_name: fullName || undefined,
    });
    setSubmitting(false);
    if (result.success) {
      toast.success("Account created. Sign in to continue.");
      router.push("/login");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <Card style={{ borderColor: primaryColor ? `${primaryColor}33` : undefined }}>
      <CardHeader>
        <CardTitle>Join</CardTitle>
        <CardDescription>
          Enter your details. A headmaster will assign you to a cohort to access materials and quizzes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="join-email">Email</Label>
            <Input
              id="join-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="join-password">Password</Label>
            <Input
              id="join-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="join-name">Full name (optional)</Label>
            <Input
              id="join-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
            />
          </div>
          <Button
            type="submit"
            className="w-full text-white"
            style={{ backgroundColor: primaryColor ?? "#0f172a" }}
            disabled={submitting}
          >
            {submitting ? "Creating account…" : "Create account"}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground mt-4 text-center">
          Already have an account?{" "}
          <a href="/login" className="underline">Sign in</a>
        </p>
      </CardContent>
    </Card>
  );
}
