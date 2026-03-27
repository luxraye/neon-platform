import { NextRequest, NextResponse } from "next/server";

/**
 * DPOPay webhook scaffold.
 * This endpoint is intentionally non-operational until live credentials are provided.
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get("x-dpopay-signature");
  const rawBody = await request.text();

  if (!signature || !rawBody) {
    return NextResponse.json(
      { ok: false, message: "Missing webhook signature or payload." },
      { status: 400 }
    );
  }

  return NextResponse.json(
    {
      ok: false,
      message:
        "DPOPay webhook scaffold is in architecture-only mode. Signature verification and reconciliation are not active yet.",
    },
    { status: 501 }
  );
}
