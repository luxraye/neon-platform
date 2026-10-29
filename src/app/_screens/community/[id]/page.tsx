"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Send, WifiOff } from "lucide-react";
import { qForumComments, qForumPost, qPeopleNames } from "@/app/data/queries";
import { useProfile } from "@/hooks/use-profile";
import { useOnline } from "@/hooks/use-online";
import { roleRoot } from "@/lib/role-root";
import { timeAgo } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar } from "@/components/ui/avatar";
import { Badge, EmptyState } from "@/components/ui/page";
import { createComment } from "../actions";
import { db } from "@/lib/db";

async function flushPendingReplies(queryClient: ReturnType<typeof useQueryClient>) {
  const pending = await db.pending_forum_replies.orderBy("created_at").toArray();
  let sent = 0;
  for (const r of pending) {
    const res = await createComment({ post_id: r.post_id, content: r.content });
    if (res.success) {
      sent += 1;
      await db.pending_forum_replies.delete(r.id);
      queryClient.invalidateQueries({ queryKey: ["forum-comments", r.post_id] });
    }
  }
  if (sent) toast.success(sent === 1 ? "Your saved reply was sent." : `${sent} saved replies were sent.`);
}

export default function PostDetailPage() {
  const params = useParams();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { data: me } = useProfile();
  const postId = params.id as string;
  const back = `${roleRoot(me?.profile?.role, pathname)}/community`;

  const { data: post, isLoading } = useQuery({
    queryKey: ["forum-post", postId],
    queryFn: () => qForumPost(postId),
    enabled: !!postId,
  });
  const { data: comments } = useQuery({
    queryKey: ["forum-comments", postId],
    queryFn: () => qForumComments(postId),
    enabled: !!postId,
  });
  const ids = [...new Set([...(post ? [post.author_id] : []), ...(comments ?? []).map((c) => c.author_id)])];
  const { data: authors } = useQuery({
    queryKey: ["forum-authors", [...ids].sort().join(",")],
    queryFn: () => qPeopleNames(ids),
    enabled: ids.length > 0,
  });

  const [reply, setReply] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const online = useOnline();

  // Send any replies saved while offline as soon as we're connected.
  useEffect(() => {
    if (online) void flushPendingReplies(queryClient);
  }, [online, queryClient]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = reply.trim();
    if (!content) return;
    if (!online) {
      await db.pending_forum_replies.add({ id: crypto.randomUUID(), post_id: postId, content, created_at: Date.now() });
      setReply("");
      toast.success("Saved. It sends when you're back online.");
      return;
    }
    setSubmitting(true);
    const res = await createComment({ post_id: postId, content });
    setSubmitting(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    setReply("");
    queryClient.invalidateQueries({ queryKey: ["forum-comments", postId] });
  }

  const backLink = (
    <Link href={back} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" /> Community
    </Link>
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        {backLink}
        <div className="h-48 animate-pulse rounded-2xl bg-muted" />
      </div>
    );
  }
  if (!post) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        {backLink}
        <EmptyState title="Post not found" body="It may have been removed." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {backLink}

      <article className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <Avatar name={authors?.[post.author_id]} seed={post.author_id} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{authors?.[post.author_id] ?? "Member"}</p>
            <p className="text-xs text-muted-foreground">{timeAgo(post.created_at)}</p>
          </div>
          <Badge tone="primary">{post.subject}</Badge>
        </div>
        <h1 className="mt-4 text-xl font-extrabold sm:text-2xl">{post.title}</h1>
        <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed">{post.content}</p>
      </article>

      <section>
        <h2 className="mb-3 text-sm font-bold text-muted-foreground">
          {comments?.length ? `${comments.length} ${comments.length === 1 ? "reply" : "replies"}` : "No replies yet"}
        </h2>
        <ul className="space-y-3">
          {(comments ?? []).map((c) => (
            <li key={c.id} className="flex gap-3">
              <Avatar name={authors?.[c.author_id]} seed={c.author_id} className="size-8" />
              <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-3">
                <p className="text-xs">
                  <span className="font-semibold">{authors?.[c.author_id] ?? "Member"}</span>
                  <span className="text-muted-foreground"> · {timeAgo(c.created_at)}</span>
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{c.content}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <form onSubmit={send} className="sticky bottom-20 rounded-2xl border border-border bg-card p-3 shadow-lg lg:bottom-4">
        {!online ? (
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-warning">
            <WifiOff className="size-3.5" /> You&apos;re offline. Your reply is saved and sent later.
          </p>
        ) : null}
        <div className="flex items-end gap-2">
          <Textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Write a reply…"
            className="min-h-11 resize-none border-0 bg-transparent px-1 focus-visible:ring-0"
            rows={1}
            aria-label="Reply"
          />
          <Button type="submit" size="icon" disabled={submitting || !reply.trim()} aria-label="Send reply">
            <Send />
          </Button>
        </div>
      </form>
    </div>
  );
}
