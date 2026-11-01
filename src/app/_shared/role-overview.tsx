import { redirect } from "next/navigation";
import { getActor } from "@/lib/auth/identity";
import { HeadmasterOverview } from "./overview/headmaster-overview";
import { TutorOverview } from "./overview/tutor-overview";
import { StudentOverview } from "./overview/student-overview";

export const dynamic = "force-dynamic";

/** Home page for every centre role; each role gets its own dashboard. */
export default async function RoleOverviewPage() {
  const actor = await getActor(["headmaster", "tutor", "student"]);
  if (!actor) redirect("/login");
  if (actor.role === "headmaster") return <HeadmasterOverview actor={actor} />;
  if (actor.role === "tutor") return <TutorOverview actor={actor} />;
  return <StudentOverview actor={actor} />;
}
