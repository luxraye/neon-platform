import { notFound } from "next/navigation";
import { getInstitutionBySubdomain } from "./actions";
import { JoinForm } from "./join-form";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ subdomain: string }>;
};

export default async function JoinPage({ params }: Props) {
  const { subdomain } = await params;
  const institution = await getInstitutionBySubdomain(subdomain);

  if (!institution) {
    notFound();
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 bg-muted/30"
      style={{ ["--brand-primary" as string]: institution.primary_color ?? "#0f172a" }}
    >
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center flex flex-col items-center">
          {institution.logo_url ? (
            <img
              src={institution.logo_url}
              alt={`${institution.name} logo`}
              className="h-14 w-14 rounded object-contain border border-border bg-white mb-2"
            />
          ) : null}
          <h1 className="text-2xl font-semibold" style={{ color: "var(--brand-primary)" }}>
            {institution.name}
          </h1>
          <p className="text-muted-foreground mt-1">
            Create your student account to join.
          </p>
        </div>
        <JoinForm subdomain={subdomain} primaryColor={institution.primary_color ?? "#0f172a"} />
      </div>
    </div>
  );
}
