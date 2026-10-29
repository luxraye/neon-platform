"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImageUp, KeyRound, Palette, UserRound } from "lucide-react";
import { useProfile } from "@/hooks/use-profile";
import { useFeatureAccess } from "@/components/dashboard/feature-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar } from "@/components/ui/avatar";
import { Badge, PageHeader, Panel } from "@/components/ui/page";
import { LogoMark } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { changeMyPassword, updateInstitutionBranding, updateMyAccountProfile } from "./actions";

const SWATCHES = ["#4b2ee8", "#0e7490", "#15803d", "#b45309", "#be123c", "#0e1024"];

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { data: me } = useProfile();
  const profile = me?.profile;
  const institution = me?.institution;
  const isHeadmaster = profile?.role === "headmaster";
  const canBrand = useFeatureAccess("custom_branding");

  const [fullName, setFullName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [pw, setPw] = useState({ next: "", confirm: "" });
  const [savingPw, setSavingPw] = useState(false);
  const [color, setColor] = useState("#4b2ee8");
  const [savingBrand, setSavingBrand] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFullName(profile?.full_name ?? "");
  }, [profile?.full_name]);
  useEffect(() => {
    if (institution?.primary_color) setColor(institution.primary_color);
  }, [institution?.primary_color]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["profile"] });

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setSavingName(true);
    const res = await updateMyAccountProfile({ full_name: fullName });
    setSavingName(false);
    if (!res.success) return toast.error(res.error);
    toast.success("Name saved.");
    refresh();
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setSavingPw(true);
    const res = await changeMyPassword({ new_password: pw.next, confirm_password: pw.confirm });
    setSavingPw(false);
    if (!res.success) return toast.error(res.error);
    toast.success("Password changed. Use it next time you sign in.");
    setPw({ next: "", confirm: "" });
  }

  async function saveColor() {
    setSavingBrand(true);
    const res = await updateInstitutionBranding({ primary_color: color });
    setSavingBrand(false);
    if (!res.success) return toast.error(res.error);
    toast.success("Colour saved.");
    refresh();
  }

  async function uploadLogo(file: File | undefined) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast.error("Use an image under 2 MB.");
    setSavingBrand(true);
    const res = await updateInstitutionBranding({ logo_file: file });
    setSavingBrand(false);
    if (logoRef.current) logoRef.current.value = "";
    if (!res.success) return toast.error(res.error);
    toast.success("Logo updated.");
    refresh();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Settings" description="Your account and how Neon looks for you." />

      <Panel title={<span className="flex items-center gap-2"><UserRound className="size-4 text-primary" /> Your account</span>}>
        <div className="mb-5 flex items-center gap-3">
          <Avatar name={profile?.full_name} email={me?.user?.email} seed={me?.user?.id} className="size-12 text-sm" />
          <div className="min-w-0">
            <p className="truncate font-semibold">{profile?.full_name || "No name yet"}</p>
            <p className="truncate text-sm text-muted-foreground">{me?.user?.email}</p>
          </div>
          <Badge tone="primary" className="ml-auto capitalize">{profile?.role}</Badge>
        </div>
        <form onSubmit={saveName} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="full-name">Full name</Label>
            <Input id="full-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" />
          </div>
          <Button type="submit" variant="outline" disabled={savingName || fullName.trim() === (profile?.full_name ?? "")}>
            {savingName ? "Saving…" : "Save"}
          </Button>
        </form>
      </Panel>

      <Panel title={<span className="flex items-center gap-2"><KeyRound className="size-4 text-primary" /> Password</span>}>
        <form onSubmit={savePassword} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pw-new">New password</Label>
              <Input id="pw-new" type="password" autoComplete="new-password" minLength={8} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} placeholder="At least 8 characters" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw-confirm">Type it again</Label>
              <Input id="pw-confirm" type="password" autoComplete="new-password" minLength={8} value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required />
            </div>
          </div>
          <Button type="submit" disabled={savingPw}>
            {savingPw ? "Saving…" : "Change password"}
          </Button>
        </form>
      </Panel>

      <Panel title="Appearance">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Light or dark mode on this device.</p>
          <ThemeToggle className="border border-border" />
        </div>
      </Panel>

      {isHeadmaster ? (
        <Panel
          title={<span className="flex items-center gap-2"><Palette className="size-4 text-primary" /> Centre branding</span>}
          action={canBrand ? null : <Badge tone="neon">Elite</Badge>}
        >
          {!canBrand ? (
            <p className="text-sm text-muted-foreground">
              Put your own logo and colour on Neon for your staff and students. Available on the Elite plan.
            </p>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                {institution?.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- remote logo
                  <img src={institution.logo_url} alt="Centre logo" className="size-16 rounded-2xl border border-border bg-white object-contain p-1" />
                ) : (
                  <LogoMark className="size-16" />
                )}
                <div className="space-y-1">
                  <Button variant="outline" size="sm" disabled={savingBrand} onClick={() => logoRef.current?.click()}>
                    <ImageUp /> {institution?.logo_url ? "Replace logo" : "Upload logo"}
                  </Button>
                  <p className="text-xs text-muted-foreground">Square PNG or JPG, under 2 MB.</p>
                </div>
                <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => uploadLogo(e.target.files?.[0])} />
              </div>

              <div className="space-y-3">
                <Label>Brand colour</Label>
                <div className="flex flex-wrap items-center gap-2">
                  {SWATCHES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className="size-9 rounded-full ring-offset-2 ring-offset-card transition-shadow"
                      style={{ backgroundColor: c, boxShadow: color.toLowerCase() === c ? `0 0 0 2px var(--card), 0 0 0 4px ${c}` : undefined }}
                      aria-label={`Use ${c}`}
                    />
                  ))}
                  <label className="relative flex size-9 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-border text-xs text-muted-foreground">
                    +
                    <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Custom colour" />
                  </label>
                  <Input value={color} onChange={(e) => setColor(e.target.value)} className="w-28 font-mono" aria-label="Hex colour" />
                </div>
                <div className="flex items-center gap-3 rounded-xl bg-muted/60 p-3">
                  <span className="text-xs text-muted-foreground">Preview</span>
                  <span className="rounded-lg px-3 py-1.5 text-sm font-semibold text-white" style={{ backgroundColor: color }}>
                    Button
                  </span>
                  <span className="text-sm font-semibold" style={{ color }}>
                    Link
                  </span>
                </div>
                <Button onClick={saveColor} disabled={savingBrand || color === institution?.primary_color}>
                  {savingBrand ? "Saving…" : "Save colour"}
                </Button>
              </div>
            </div>
          )}
        </Panel>
      ) : null}
    </div>
  );
}
