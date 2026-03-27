import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-xl border bg-card p-6 text-center">
        <h1 className="text-xl font-semibold">Unauthorized</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You don&apos;t have permission to view that page.
        </p>
        <div className="mt-4">
          <Link className="text-sm text-primary hover:underline" href="/dashboard">
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

