/**
 * Transactional email via Resend HTTP API (no SDK required).
 * Set RESEND_API_KEY and RESEND_FROM (verified sender in Resend).
 */

const RESEND_API = "https://api.resend.com/emails";

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM?.trim());
}

export async function sendTransactionalEmail(input: {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim();
  if (!key || !from) {
    console.warn("[email] RESEND_API_KEY or RESEND_FROM missing; skipping send.");
    return { ok: false, error: "Email not configured." };
  }

  const to = Array.isArray(input.to) ? input.to : [input.to];
  const valid = to.map((e) => e.trim()).filter((e) => e.length > 0);
  if (!valid.length) {
    return { ok: false, error: "No recipients." };
  }

  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: valid,
        subject: input.subject,
        text: input.text,
        ...(input.html ? { html: input.html } : {}),
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[email] Resend error:", res.status, errText);
      return { ok: false, error: errText || `HTTP ${res.status}` };
    }

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[email] send failed:", msg);
    return { ok: false, error: msg };
  }
}
