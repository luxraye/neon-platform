import { UserX } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { StatusPage } from "@/components/auth/status-page";

export default function DeactivatedPage() {
  return (
    <StatusPage
      icon={UserX}
      title="Your account was removed"
      body={
        <>
          Your centre removed you from Neon. If that was a mistake, ask your headmaster to contact us. We can restore
          accounts within 72 hours of removal.
        </>
      }
    >
      <LogoutButton />
    </StatusPage>
  );
}
