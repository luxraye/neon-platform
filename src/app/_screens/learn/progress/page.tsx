import { redirect } from "next/navigation";

// Progress now lives on the Results page.
export default function ProgressPage() {
  redirect("/student/results");
}
