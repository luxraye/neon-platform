import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPage } from "@/components/auth/status-page";

export default function UnauthorizedPage() {
  return (
    <StatusPage icon={ShieldAlert} title="That page isn't for your account" body="You're signed in, but this area belongs to a different role.">
      <Button asChild>
        <Link href="/dashboard">Take me to my dashboard</Link>
      </Button>
    </StatusPage>
  );
}
