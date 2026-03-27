"use client";

import { usePathname } from "next/navigation";
import { useProfile } from "@/hooks/use-profile";

/**
 * Resolves staff (tutor/headmaster) from profile with lowercase normalization
 * and falls back to URL prefix so /tutor/* and /headmaster/* work before profile loads
 * or when metadata casing differs from strict equality checks.
 */
export function useStaffRole() {
  const pathname = usePathname() ?? "";
  const { data: profileData, isLoading } = useProfile();
  const isHeadmasterRoute = pathname.startsWith("/headmaster");
  const isTutorRoute = pathname.startsWith("/tutor");
  const raw =
    profileData?.profile?.role ??
    (profileData?.user?.user_metadata?.role as string | undefined) ??
    null;
  const role = typeof raw === "string" ? raw.trim().toLowerCase() : null;
  const isStaffFromProfile = role === "headmaster" || role === "tutor";
  const isStaff = isStaffFromProfile || isHeadmasterRoute || isTutorRoute;

  return {
    role,
    isStaff,
    isLoading,
    isHeadmasterRoute,
    isTutorRoute,
    profileData,
  };
}
