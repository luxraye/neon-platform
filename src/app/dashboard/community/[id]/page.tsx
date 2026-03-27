"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createBrowserSupabaseClient } from "@/utils/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createComment } from "../actions";
import { db } from "@/lib/db";

type Comment = {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  created_at: string;
};

type Post = {
  id: string;
  title: string;
  subject: string;
  content: string;
  author_id: string;
  created_at: string;
};

function usePost(postId: string | null) {
  const supabase = createBrowserSupabaseClient();
  return useQuery({
    queryKey: ["forum-post", postId ?? ""],
    queryFn: async (): Promise<Post | null> => {
      if (!postId) return null;
      const { data, error } = await supabase
        .from("forum_posts")
        .select("id, title, subject, content, author_id, created_at")
        .eq("id", postId)
        .maybeSingle();
      if (error) throw error;
      return data as Post | null;
    },
    enabled: !!postId,
  });
}

function useComments(postId: string | null) {
  const supabase = createBrowserSupabaseClient();
  return useQuery({
    queryKey: ["forum-comments", postId ?? ""],
    queryFn: async (): Promise<Comment[]> => {
      if (!postId) return [];
      const { data, error } = await supabase
        .from("forum_comments")
        .select("id, post_id, author_id, content, created_at")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Comment[];
    },
    enabled: !!postId,
  });
}

function useAuthors(ids: string[]) {
  const supabase = createBrowserSupabaseClient();
  return useQuery({
    queryKey: ["forum-authors", ids.sort().join(",")],
    queryFn: async (): Promise<Record<string, string>> => {
      if (ids.length === 0) return {};
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", [...new Set(ids)]);
      const map: Record<string, string> = {};
      (data ?? []).forEach((p: { id: string; full_name: string | null; email: string }) => {
        map[p.id] = p.full_name || p.email;
      });
      return map;
    },
    enabled: ids.length > 0,
  });
}

async function flushPendingReplies(queryClient: ReturnType<typeof useQueryClient>) {
  const pending = await db.pending_forum_replies.orderBy("created_at").toArray();
  for (const r of pending) {
    const result = await createComment({ post_id: r.post_id, content: r.content });
    if (result.success) {
      await db.pending_forum_replies.delete(r.id);
      queryClient.invalidateQueries({ queryKey: ["forum-comments", r.post_id] });
    }
  }
  if (pending.length > 0) {
    toast.success(pending.length === 1 ? "Queued reply sent." : `${pending.length} queued replies sent.`);
  }
}

export default function PostDetailPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const postId = params.id as string;
  const { data: post, isLoading: postLoading, isError: postError } = usePost(postId);
  const { data: comments } = useComments(postId);
  const authorIds = [
    ...(post ? [post.author_id] : []),
    ...(comments ?? []).map((c) => c.author_id),
  ];
  const { data: authors } = useAuthors(authorIds);
  const [reply, setReply] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      flushPendingReplies(queryClient);
    };
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    if (navigator.onLine) flushPendingReplies(queryClient);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [queryClient]);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim()) return;
    const content = reply.trim();
    setReply("");

    if (!isOnline) {
      await db.pending_forum_replies.add({
        id: crypto.randomUUID(),
        post_id: postId,
        content,
        created_at: Date.now(),
      });
      toast.success("Reply queued. It will be sent when you're back online.");
      return;
    }

    setSubmitting(true);
    const result = await createComment({ post_id: postId, content });
    setSubmitting(false);
    if (result.success) {
      toast.success("Reply posted.");
      queryClient.invalidateQueries({ queryKey: ["forum-comments", postId] });
    } else {
      toast.error(result.error);
    }
  };

  if (postLoading || !post) {
    return (
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/community">← Community</Link>
        </Button>
        <p className="mt-4 text-muted-foreground">{postLoading ? "Loading…" : "Post not found."}</p>
      </div>
    );
  }
  if (postError) {
    return (
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/community">← Community</Link>
        </Button>
        <p className="mt-4 text-destructive">Failed to load post.</p>
      </div>
    );
  }

  return (
    <div className="px-2 sm:px-4 pb-6">
      <Button variant="ghost" size="sm" className="min-h-10 touch-manipulation" asChild>
        <Link href="/dashboard/community">← Community</Link>
      </Button>

      <Card className="mt-4">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle>{post.title}</CardTitle>
          <CardDescription>
            {post.subject} · {authors?.[post.author_id] ?? "—"} · {new Date(post.created_at).toLocaleString()}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <p className="whitespace-pre-wrap text-sm">{post.content}</p>
        </CardContent>
      </Card>

      <div className="mt-6">
        <h2 className="text-base sm:text-lg font-medium mb-3">Replies</h2>
        <div className="space-y-3">
          {(comments ?? []).map((c) => (
            <Card key={c.id}>
              <CardContent className="pt-4 px-4 sm:px-6">
                <p className="text-sm text-muted-foreground mb-1">
                  {authors?.[c.author_id] ?? "—"} · {new Date(c.created_at).toLocaleString()}
                </p>
                <p className="text-sm whitespace-pre-wrap">{c.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <form onSubmit={handleReply} className="mt-4 space-y-2">
          <Label htmlFor="reply">Reply</Label>
          <textarea
            id="reply"
            className="w-full min-h-20 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder={!isOnline ? "You're offline. Reply will be sent when you're back online." : "Write a reply..."}
          />
          {!isOnline && (
            <p className="text-xs text-muted-foreground">Replies are queued and will sync when you reconnect.</p>
          )}
          <Button type="submit" disabled={submitting} className="min-h-10 touch-manipulation">
            {submitting ? "Posting…" : !isOnline ? "Queue reply" : "Post reply"}
          </Button>
        </form>
      </div>
    </div>
  );
}
