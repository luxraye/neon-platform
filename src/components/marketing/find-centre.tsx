"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { findSchool } from "@/app/actions";

/** Students type their centre's name and land on its join page. */
export function FindCentre() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    startTransition(async () => {
      const result = await findSchool(q);
      if (!result) {
        toast.error("We couldn't find that centre. Check the spelling, or ask your centre for its join link.");
        return;
      }
      router.push(`/join/${result.subdomain}`);
    });
  };

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-md items-center gap-2" role="search">
      <label htmlFor="find-centre" className="sr-only">
        Your centre&apos;s name
      </label>
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/40" aria-hidden />
        <input
          id="find-centre"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Your centre's name"
          className="h-12 w-full rounded-xl border border-white/15 bg-white/5 pl-9 pr-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-neon/60 focus:ring-2 focus:ring-neon/30"
          autoComplete="off"
        />
      </div>
      <Button type="submit" size="lg" variant="ink" className="bg-white text-ink hover:bg-white/90" disabled={pending}>
        {pending ? "Searching…" : "Find"}
      </Button>
    </form>
  );
}
