"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { clearOfflineCache } from "@/lib/offline-cache";

type LogoutButtonProps = {
  variant?: "default" | "outline" | "ghost" | "secondary" | "link" | "destructive";
  size?: "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg";
  className?: string;
  children?: React.ReactNode;
};

export function LogoutButton({
  variant = "outline",
  size = "default",
  className,
  children = "Log out",
}: LogoutButtonProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const handleLogout = async () => {
    setBusy(true);
    try {
      await fetch("/api/auth/session", { method: "DELETE" });
    } finally {
      queryClient.clear();
      await clearOfflineCache();
      router.replace("/login");
      router.refresh();
    }
  };

  return (
    <Button type="button" variant={variant} size={size} className={className} onClick={handleLogout} disabled={busy}>
      {busy ? "Signing out…" : children}
    </Button>
  );
}
