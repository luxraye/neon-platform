import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { getInstitutionBySubdomain } from "./actions";
import { JoinForm } from "./join-form";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ subdomain: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { subdomain } = await params;
  const institution = await getInstitutionBySubdomain(subdomain);
  return { title: institution ? `Join ${institution.name}` : "Join a centre" };
}

export default async function JoinPage({ params }: Props) {
  const { subdomain } = await params;
  const institution = await getInstitutionBySubdomain(subdomain);
  if (!institution) notFound();

  return (
    <AuthShell
      title={`Join ${institution.name}`}
      subtitle="Send a request to your centre. Once the headmaster approves it, we'll email you a link to set your password."
      aside={
        <div className="space-y-5">
          {institution.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote logo from storage
            <img
              src={institution.logo_url}
              alt={`${institution.name} logo`}
              className="size-16 rounded-2xl bg-white object-contain p-1.5"
            />
          ) : null}
          <p className="text-3xl font-extrabold leading-tight">{institution.name}</p>
          <ol className="space-y-3 text-white/70">
            <li className="flex gap-3"><span className="font-mono text-neon">01</span> Send your request</li>
            <li className="flex gap-3"><span className="font-mono text-neon">02</span> The headmaster approves it</li>
            <li className="flex gap-3"><span className="font-mono text-neon">03</span> Set your password from the email and sign in</li>
          </ol>
        </div>
      }
    >
      <JoinForm subdomain={institution.subdomain} />
    </AuthShell>
  );
}
