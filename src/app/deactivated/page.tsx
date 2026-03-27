import { LogoutButton } from "@/components/auth/logout-button";

export default function DeactivatedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-xl border bg-card p-6 text-center space-y-4">
        <h1 className="text-xl font-semibold">Account deactivated</h1>
        <p className="text-sm text-muted-foreground">
          Your account has been removed from your institution. A platform admin can restore your access within 72 hours
          of removal. After that, recovery may no longer be possible.
        </p>
        <p className="text-sm text-muted-foreground">
          If you believe this was a mistake, contact your institution headmaster or the platform administrator.
        </p>
        <div className="pt-2">
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}
