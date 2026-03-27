import { redirect } from "next/navigation";
import Image from "next/image";
import HeadmasterSidebar from "@/components/navigation/HeadmasterSidebar";
import { getUserIdentity } from "@/utils/supabase/get-user-identity";

export const dynamic = "force-dynamic";

export default async function HeadmasterLayout({ children }: { children: React.ReactNode }) {
  const identity = await getUserIdentity();
  if (!identity) redirect("/login");

  if (identity.deleted_at) redirect("/deactivated");
  if (identity.role !== "headmaster") redirect("/unauthorized");
  if (!identity.institution_id) redirect("/unauthorized");

  const title = identity.institution_name ? `Headmaster: ${identity.institution_name}` : "Headmaster";

  return (
    <div
      className="flex min-h-screen bg-background"
      style={{ ["--brand-primary" as string]: identity.institution_primary_color ?? "#0f172a" } as React.CSSProperties}
    >
      <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-card">
        <div className="flex h-16 items-center gap-3 border-b border-border px-4">
          {identity.institution_logo_url ? (
            <div className="h-11 w-11 shrink-0 rounded-xl border border-border/70 bg-card p-1 shadow-sm">
              <Image
                src={identity.institution_logo_url}
                alt="Institution logo"
                width={40}
                height={40}
                unoptimized
                className="h-full w-full rounded-lg object-cover"
              />
            </div>
          ) : (
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-semibold text-white shadow-sm"
              style={{ backgroundColor: "var(--brand-primary)" }}
              aria-hidden
            >
              N
            </div>
          )}
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{title}</div>
          </div>
        </div>
        <div className="min-h-0 flex-1">
          <HeadmasterSidebar institutionName={identity.institution_name} />
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}

