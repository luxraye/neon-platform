import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPage } from "@/components/auth/status-page";

export default function NotFound() {
  return (
    <StatusPage icon={Compass} title="Page not found" body="The link may be old, or the page has moved.">
      <Button asChild variant="outline">
        <Link href="/">Home</Link>
      </Button>
      <Button asChild>
        <Link href="/dashboard">My dashboard</Link>
      </Button>
    </StatusPage>
  );
}
