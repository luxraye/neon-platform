import { redirect } from "next/navigation";
import { getUserIdentity } from "@/utils/supabase/get-user-identity";

export const dynamic = "force-dynamic";

/** Resolves role via unified identity and sends users to their isolated dashboard. */
export default async function DashboardEntryRedirect() {
  const identity = await getUserIdentity();
  if (!identity) redirect("/login");

  switch (identity.role) {
    case "admin":
      redirect("/admin");
    case "headmaster":
      redirect("/headmaster");
    case "tutor":
      redirect("/tutor");
    case "student":
      redirect("/student");
    default:
      redirect("/login");
  }
}
