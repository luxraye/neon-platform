import { createClient } from "@/utils/supabase/server";

/**
 * Temporary debug page: server-side auth + profile resolution.
 * Visit /test-auth to see raw user and profile from the database.
 * If profile is null here, the issue is RLS/Database. If profile exists here but UI shows "—", the issue is client/cache.
 */
export default async function TestAuthPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  let profile = null;
  let profileError = null;
  if (user) {
    const result = await supabase
      .from("profiles")
      .select("id, institution_id, email, role, full_name, cohort_id, created_at")
      .eq("id", user.id)
      .maybeSingle();
    profile = result.data;
    profileError = result.error;
  }

  return (
    <div className="min-h-screen p-6 font-mono text-sm">
      <h1 className="text-xl font-semibold mb-4">Test Auth (Server-side)</h1>
      <p className="text-muted-foreground mb-4">
        If profile is null below, the issue is RLS/Database. If profile exists here but UI shows
        &quot;—&quot;, the issue is client/cache.
      </p>

      <section className="mb-6">
        <h2 className="font-medium mb-2">User (auth.getUser())</h2>
        {userError && (
          <pre className="bg-destructive/10 p-2 rounded text-destructive">
            {JSON.stringify({ message: userError.message }, null, 2)}
          </pre>
        )}
        <pre className="bg-muted p-4 rounded overflow-auto">
          {user ? JSON.stringify({ id: user.id, email: user.email }, null, 2) : "null (not signed in)"}
        </pre>
      </section>

      <section className="mb-6">
        <h2 className="font-medium mb-2">Profile (profiles row for this user)</h2>
        {profileError && (
          <pre className="bg-destructive/10 p-2 rounded text-destructive mb-2">
            {JSON.stringify({ message: profileError.message, code: profileError.code }, null, 2)}
          </pre>
        )}
        <pre className="bg-muted p-4 rounded overflow-auto">
          {profile != null ? JSON.stringify(profile, null, 2) : "null"}
        </pre>
      </section>

      <p className="text-muted-foreground">
        Delete this page (src/app/test-auth/page.tsx) when done debugging.
      </p>
    </div>
  );
}
