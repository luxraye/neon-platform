"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageSquare, MessagesSquare, Send } from "lucide-react";
import { useProfile } from "@/hooks/use-profile";
import { useForumPosts } from "@/hooks/use-forum-posts";
import { qPeopleNames } from "@/app/data/queries";
import { roleRoot } from "@/lib/role-root";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar } from "@/components/ui/avatar";
import { Badge, EmptyState, PageHeader } from "@/components/ui/page";
import { createPost } from "./actions";
import { FeatureGate } from "@/components/dashboard/feature-gate";

const SUBJECTS = ["General", "Mathematics", "Science", "English", "Setswana", "Accounting", "Geography", "History"];

export default function CommunityPage() {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { data: me } = useProfile();
  const role = me?.profile?.role ?? null;
  const institutionId = me?.profile?.institution_id ?? null;
  const studentBlocked = role === "student" && !me?.profile?.cohort_id;
  const base = `${roleRoot(role, pathname)}/community`;

  const [subjectFilter, setSubjectFilter] = useState<string | null>(null);
  const { data: posts, isLoading } = useForumPosts(institutionId, subjectFilter);
  const authorIds = [...new Set((posts ?? []).map((p) => p.author_id))];
  const { data: authors } = useQuery({
    queryKey: ["forum-authors", authorIds.sort().join(",")],
    queryFn: () => qPeopleNames(authorIds),
    enabled: authorIds.length > 0,
  });

  const [composing, setComposing] = useState(false);
  const [subject, setSubject] = useState("General");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const res = await createPost({ subject, title, content });
    setSubmitting(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success("Posted.");
    setTitle("");
    setContent("");
    setComposing(false);
    queryClient.invalidateQueries({ queryKey: ["forum-posts"] });
  }

  if (studentBlocked) {
    return (
      <div className="space-y-6">
        <PageHeader title="Community" />
        <EmptyState icon={MessagesSquare} title="Not in a class yet" body="You can join the conversation once your centre places you in a cohort." />
      </div>
    );
  }

  return (
    <FeatureGate feature="community" fallback={<CommunityUpgradeMessage />}>
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader title="Community" description="Ask questions, share tips and get help from tutors and classmates." />

        <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-4">
          <div className="flex gap-3">
            <Avatar name={me?.profile?.full_name} email={me?.user?.email} seed={me?.user?.id} />
            <div className="min-w-0 flex-1 space-y-3">
              {composing ? (
                <>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title, e.g. How do I balance this equation?" required autoFocus />
                  <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Add the details…" required />
                  <div className="flex flex-wrap items-center gap-2">
                    {SUBJECTS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSubject(s)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs font-semibold",
                          subject === s ? "border-primary bg-secondary text-secondary-foreground" : "border-border text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={() => setComposing(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={submitting}>
                      <Send /> {submitting ? "Posting…" : "Post"}
                    </Button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setComposing(true)}
                  className="h-10 w-full rounded-full border border-border bg-muted/50 px-4 text-left text-sm text-muted-foreground hover:bg-muted"
                >
                  Ask a question or share something…
                </button>
              )}
            </div>
          </div>
        </form>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {[null, ...SUBJECTS].map((s) => (
            <button
              key={s ?? "all"}
              onClick={() => setSubjectFilter(s)}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold",
                subjectFilter === s ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              {s ?? "Everything"}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : !posts?.length ? (
          <EmptyState icon={MessagesSquare} title="Quiet in here" body="Be the first to post something." />
        ) : (
          <ul className="space-y-3">
            {posts.map((p) => (
              <li key={p.id}>
                <Link href={`${base}/${p.id}`} className="block rounded-2xl border border-border bg-card p-4 transition-shadow hover:shadow-md sm:p-5">
                  <div className="flex items-center gap-3">
                    <Avatar name={authors?.[p.author_id]} seed={p.author_id} className="size-8" />
                    <p className="min-w-0 flex-1 truncate text-sm">
                      <span className="font-semibold">{authors?.[p.author_id] ?? "Member"}</span>
                      <span className="text-muted-foreground"> · {timeAgo(p.created_at)}</span>
                    </p>
                    <Badge tone="primary">{p.subject}</Badge>
                  </div>
                  <h2 className="mt-3 font-bold leading-snug">{p.title}</h2>
                  <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">{p.content}</p>
                  <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <MessageSquare className="size-3.5" /> Reply
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </FeatureGate>
  );
}

function CommunityUpgradeMessage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Community" />
      <EmptyState icon={MessagesSquare} title="Not on your plan" body="Ask your centre's headmaster about upgrading." />
    </div>
  );
}
