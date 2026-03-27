"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useProfile } from "@/hooks/use-profile";
import { FeatureGate } from "@/components/dashboard/feature-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateInstitutionBranding } from "./actions";

export default function SettingsPage() {
  const pathname = usePathname() ?? "";
  const queryClient = useQueryClient();
  const { data: profileData } = useProfile();
  const institution = profileData?.institution as { primary_color?: string; logo_url?: string } | undefined;
  const profileHref = pathname.startsWith("/headmaster")
    ? "/headmaster/settings/profile"
    : pathname.startsWith("/tutor")
      ? "/tutor/profile"
      : "/student/settings/profile";
  const [primaryColor, setPrimaryColor] = useState(institution?.primary_color ?? "#0f172a");
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleColorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const result = await updateInstitutionBranding({ primary_color: primaryColor });
    setSubmitting(false);
    if (result.success) {
      toast.success("Primary color updated.");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    } else {
      toast.error(result.error);
    }
  };

  const handleLogoSubmit = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubmitting(true);
    const result = await updateInstitutionBranding({ logo_file: file });
    setSubmitting(false);
    if (result.success) {
      toast.success("Logo updated.");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      if (fileInputRef.current) fileInputRef.current.value = "";
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-2">Settings</h1>
      <p className="text-muted-foreground mb-6">Account personalization and institution options.</p>

      <div className="mb-8">
        <div className="rounded-lg border bg-card p-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-base font-medium">Your account</h2>
            <p className="text-sm text-muted-foreground">
              Edit your name/avatar and change your password.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href={profileHref}>Open profile settings</Link>
          </Button>
        </div>
      </div>

      <FeatureGate feature="custom_branding" fallback={<BrandingUpgradeMessage />}>
        <div className="space-y-8 max-w-md">
          <div className="space-y-2">
            <h2 className="text-lg font-medium">Branding preview</h2>
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-3 mb-3">
                {institution?.logo_url ? (
                  <img
                    src={institution.logo_url}
                    alt="Institution logo preview"
                    className="h-10 w-10 rounded object-contain border border-border bg-white"
                  />
                ) : (
                  <div
                    className="h-10 w-10 rounded text-white text-sm font-semibold flex items-center justify-center"
                    style={{ backgroundColor: primaryColor }}
                  >
                    N
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium">{profileData?.institution?.name ?? "Institution"}</p>
                  <p className="text-xs text-muted-foreground">Primary: {primaryColor}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" className="text-white" style={{ backgroundColor: primaryColor }}>
                  Primary button
                </Button>
                <Button type="button" size="sm" variant="outline">
                  Secondary
                </Button>
              </div>
            </div>
          </div>

          <form onSubmit={handleColorSubmit} className="space-y-4">
            <h2 className="text-lg font-medium">Branding (Elite)</h2>
            <div className="space-y-2">
              <Label htmlFor="primary_color">Primary color</Label>
              <div className="flex gap-2 items-center">
                <input
                  id="primary_color"
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-10 w-14 rounded border border-input cursor-pointer"
                />
                <Input
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  placeholder="#0f172a"
                  className="font-mono"
                />
              </div>
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Save color"}
            </Button>
          </form>

          <div className="space-y-2">
            <Label>Logo</Label>
            {institution?.logo_url && (
              <div className="mb-2">
                <img
                  src={institution.logo_url}
                  alt="Institution logo"
                  className="h-16 w-16 rounded object-contain border border-border"
                />
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoSubmit}
              disabled={submitting}
              className="text-sm"
            />
            <p className="text-xs text-muted-foreground">Upload an image to replace the logo. Used in the sidebar.</p>
          </div>
        </div>
      </FeatureGate>
    </div>
  );
}

function BrandingUpgradeMessage() {
  return (
    <p className="text-muted-foreground">
      Custom branding (logo and primary color) is available on the Elite plan. Contact your platform admin to upgrade.
    </p>
  );
}
