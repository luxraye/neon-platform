"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Download, Share, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page";

const noop = () => () => {};

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export default function MobileSetupPage() {
  const origin = useSyncExternalStore(noop, () => window.location.origin, () => "");
  const standalone = useSyncExternalStore(noop, () => window.matchMedia("(display-mode: standalone)").matches, () => false);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [accepted, setAccepted] = useState(false);
  const installed = standalone || accepted;

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Install Neon" description="Put Neon on your home screen. It opens like an app and keeps working when your data runs out." />

      {installed ? (
        <div className="rounded-2xl border border-success/30 bg-success/10 p-5 text-sm font-semibold text-success">You&apos;re already using the installed app. 🎉</div>
      ) : prompt ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl bg-ink p-6 text-white sm:flex-row sm:items-center sm:justify-between">
          <p className="font-semibold">Your phone can install Neon in one tap.</p>
          <Button
            variant="neon"
            onClick={async () => {
              await prompt.prompt();
              const choice = await prompt.userChoice;
              if (choice.outcome === "accepted") setAccepted(true);
              setPrompt(null);
            }}
          >
            <Download /> Install
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 font-bold">
            <Smartphone className="size-4 text-primary" /> Android
          </h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Open Neon in Chrome.</li>
            <li>Tap the ⋮ menu at the top right.</li>
            <li>
              Tap <strong className="text-foreground">Install app</strong> or <strong className="text-foreground">Add to Home screen</strong>.
            </li>
          </ol>
        </section>
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 font-bold">
            <Share className="size-4 text-primary" /> iPhone
          </h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Open Neon in Safari.</li>
            <li>Tap the Share button at the bottom.</li>
            <li>
              Tap <strong className="text-foreground">Add to Home Screen</strong>.
            </li>
          </ol>
        </section>
      </div>

      <section className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-6 text-center sm:flex-row sm:text-left">
        {origin ? (
          <div className="rounded-xl bg-white p-3">
            <QRCodeSVG value={origin} size={140} level="M" />
          </div>
        ) : (
          <div className="size-[164px] animate-pulse rounded-xl bg-muted" />
        )}
        <div>
          <h2 className="font-bold">On a computer right now?</h2>
          <p className="mt-1 text-sm text-muted-foreground">Point your phone&apos;s camera at this code to open Neon there, then follow the steps above.</p>
        </div>
      </section>
    </div>
  );
}
