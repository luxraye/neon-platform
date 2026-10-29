import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-ink text-white/60">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-[1.5fr_1fr_1fr]">
        <div className="space-y-3">
          <Logo tone="light" />
          <p className="max-w-xs text-sm">
            Student management for tuition centres in Botswana. Made in Gaborone.
          </p>
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-semibold text-white">Product</p>
          <Link href="/#features" className="block hover:text-white">Features</Link>
          <Link href="/#pricing" className="block hover:text-white">Pricing</Link>
          <Link href="/contact" className="block hover:text-white">Book a demo</Link>
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-semibold text-white">Account</p>
          <Link href="/login" className="block hover:text-white">Sign in</Link>
          <Link href="/#find-centre" className="block hover:text-white">Join your centre</Link>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs">
          © {new Date().getFullYear()} Neon. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
