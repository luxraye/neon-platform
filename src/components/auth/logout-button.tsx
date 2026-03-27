"use client";

import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";

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

  const handleLogout = async () => {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={handleLogout}
    >
      {children}
    </Button>
  );
}
