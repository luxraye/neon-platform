"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useProfile } from "@/hooks/use-profile";
import { getSettingsBackLabel, getSettingsParentPath } from "@/lib/settings-navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changeMyPassword, updateMyAccountProfile } from "../actions";

export default function ProfileSettingsPage() {
  const queryClient = useQueryClient();
  const { data } = useProfile();
  const pathname = usePathname();
  const backHref = getSettingsParentPath(pathname);
  const backLabel = getSettingsBackLabel(pathname);
  const profile = data?.profile;
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Account</h1>
        <p className="text-muted-foreground text-sm">Update your personal details and password.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile details</CardTitle>
          <CardDescription>Name and avatar used in app surfaces.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setSavingProfile(true);
              const result = await updateMyAccountProfile({
                full_name: fullName,
                avatar_url: avatarUrl,
              });
              setSavingProfile(false);
              if (!result.success) {
                toast.error(result.error);
                return;
              }
              toast.success("Profile updated.");
              queryClient.invalidateQueries({ queryKey: ["profile"] });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="full-name">Full name</Label>
              <Input
                id="full-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="avatar-url">Avatar URL (optional)</Label>
              <Input
                id="avatar-url"
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <Button type="submit" disabled={savingProfile}>
              {savingProfile ? "Saving…" : "Save profile"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>Set a new sign-in password.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setSavingPassword(true);
              const result = await changeMyPassword({
                new_password: newPassword,
                confirm_password: confirmPassword,
              });
              setSavingPassword(false);
              if (!result.success) {
                toast.error(result.error);
                return;
              }
              toast.success("Password changed.");
              setNewPassword("");
              setConfirmPassword("");
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input
                id="confirm-password"
                type="password"
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                required
              />
            </div>
            <Button type="submit" disabled={savingPassword}>
              {savingPassword ? "Saving…" : "Change password"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Button asChild variant="outline" size="sm">
        <Link href={backHref}>{backLabel}</Link>
      </Button>
    </div>
  );
}
