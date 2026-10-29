import "server-only";

import { adminAuth } from "@/lib/firebase/admin";

/**
 * Account management on Firebase Auth, used by provisioning, staff and join flows.
 * Every function returns `{ data, error }` instead of throwing, so callers can roll back.
 */

type Err = { message: string } | null;

function messageFor(e: unknown): string {
  const code = (e as { code?: string })?.code ?? "";
  if (code === "auth/email-already-exists") return "An account with this email already exists.";
  if (code === "auth/invalid-password") return "Password must be at least 6 characters.";
  if (code === "auth/invalid-email") return "That email address is not valid.";
  if (code === "auth/user-not-found") return "Account not found.";
  return (e as { message?: string })?.message ?? "Account operation failed.";
}

export async function createAuthUser(input: {
  email: string;
  password: string;
  fullName?: string | null;
  emailVerified?: boolean;
}): Promise<{ data: { id: string } | null; error: Err }> {
  try {
    const user = await adminAuth().createUser({
      email: input.email.trim().toLowerCase(),
      password: input.password,
      displayName: input.fullName?.trim() || undefined,
      emailVerified: input.emailVerified ?? true,
    });
    return { data: { id: user.uid }, error: null };
  } catch (e) {
    return { data: null, error: { message: messageFor(e) } };
  }
}

export async function deleteAuthUser(uid: string): Promise<{ error: Err }> {
  try {
    await adminAuth().deleteUser(uid);
    return { error: null };
  } catch (e) {
    return { error: { message: messageFor(e) } };
  }
}

export async function updateAuthUser(
  uid: string,
  patch: { password?: string; email?: string; fullName?: string | null; disabled?: boolean }
): Promise<{ error: Err }> {
  try {
    await adminAuth().updateUser(uid, {
      password: patch.password,
      email: patch.email?.trim().toLowerCase(),
      displayName: patch.fullName === undefined ? undefined : patch.fullName?.trim() || null,
      disabled: patch.disabled,
    });
    if (patch.password || patch.disabled) {
      await adminAuth().revokeRefreshTokens(uid);
    }
    return { error: null };
  } catch (e) {
    return { error: { message: messageFor(e) } };
  }
}

export async function findAuthUserByEmail(email: string): Promise<{ id: string } | null> {
  try {
    const user = await adminAuth().getUserByEmail(email.trim().toLowerCase());
    return { id: user.uid };
  } catch {
    return null;
  }
}

/** A one-time link the user opens to choose their own password. */
export async function passwordSetupLink(email: string): Promise<string | null> {
  try {
    const continueUrl = `${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000"}/login`;
    return await adminAuth().generatePasswordResetLink(email.trim().toLowerCase(), { url: continueUrl });
  } catch {
    return null;
  }
}

export function temporaryPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  const body = Buffer.from(bytes).toString("base64url");
  return `Neon-${body}`;
}
