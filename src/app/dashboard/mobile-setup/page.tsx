"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

export default function MobileSetupPage() {
  const [origin, setOrigin] = useState<string>("");

  useEffect(() => {
    setOrigin(typeof window !== "undefined" ? window.location.origin : "");
  }, []);

  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="text-2xl font-semibold">Add Neon to your phone</h1>
      <p className="text-muted-foreground">
        Install Neon on your home screen for quick access to materials and quizzes.
      </p>

      <div className="flex flex-col items-center gap-6 rounded-xl border bg-card p-6">
        {origin ? (
          <div className="rounded-lg border bg-white p-4">
            <QRCodeSVG value={origin} size={200} level="M" includeMargin />
          </div>
        ) : (
          <div className="h-[232px] w-[232px] animate-pulse rounded-lg bg-muted" />
        )}

        <ol className="list-inside list-decimal space-y-3 text-left text-sm">
          <li>Scan this code with your phone&apos;s camera.</li>
          <li>
            Tap the <strong>Share</strong> button (iOS) or <strong>Menu</strong> (⋮) (Android).
          </li>
          <li>Select <strong>Add to Home Screen</strong>.</li>
        </ol>

        <p className="text-center text-xs text-muted-foreground">
          After adding, open Neon from your home screen like any app.
        </p>
      </div>
    </div>
  );
}
