"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useProfile } from "@/hooks/use-profile";
import { useForumPosts } from "@/hooks/use-forum-posts";
import { createBrowserSupabaseClient } from "@/utils/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createPost } from "./actions";
import { FeatureGate } from "@/components/dashboard/feature-gate";

const SUBJECTS = ["Mathematics", "Science", "English", "General"];

type AuthorMap = Record<string, string>;

function usePostAuthors(postIds: string[]) {
  const supabase = createBrowserSupabaseClient();
  return useQuery({
    queryKey: ["forum-authors", postIds.sort().join(",")],
    queryFn: async (): Promise<AuthorMap> => {
      if (postIds.length === 0) return {};
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", [...new Set(postIds)]);
      const map: AuthorMap = {};
      (data ?? []).forEach((p: { id: string; full_name: string | null; email: string }) => {
        map[p.id] = p.full_name || p.email;
      });
      return map;
    },
    enabled: postIds.length > 0,
  });
}

export default function CommunityPage() {
  const queryClient = useQueryClient();
  const { data: profileData } = useProfile();
  const role =
    (profileData?.profile?.role ??
      (profileData?.user?.user_metadata?.role as string | undefined) ??
      null) as string | null;
  const cohortId =
    profileData?.profile?.cohort_id ??
    (profileData?.user?.user_metadata?.cohort_id as string | undefined) ??
    null;
  const studentBlocked = role === "student" && !cohortId;
  const institutionId =
    profileData?.profile?.institution_id ??
    (profileData?.user?.user_metadata?.institution_id as string | undefined) ??
    null;
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null);
  const { data: posts, isLoading, isError, error } = useForumPosts(
    institutionId,
    subjectFilter
  );
  const authorIds = (posts ?? []).map((p) => p.author_id);
  const { data: authors } = usePostAuthors(authorIds);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (studentBlocked) {
    return (
      <FeatureGate feature="community" fallback={<CommunityUpgradeMessage />}>
        <div className="px-2 sm:px-4">
          <h1 className="text-xl sm:text-2xl font-semibold mb-2">Community</h1>
          <p className="text-muted-foreground">
            You need a cohort assignment before you can access the community forum.
          </p>
        </div>
      </FeatureGate>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const result = await createPost({ subject, title, content });
    setSubmitting(false);
    if (result.success) {
      toast.success("Post created.");
      setDialogOpen(false);
      setTitle("");
      setContent("");
      queryClient.invalidateQueries({ queryKey: ["forum-posts", institutionId ?? "", subjectFilter ?? ""] });
    } else {
      toast.error(result.error);
    }
  };

  return (
    <FeatureGate feature="community" fallback={<CommunityUpgradeMessage />}>
    <div className="min-h-0 w-full px-2 sm:px-4 pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 gap-3">
        <h1 className="text-xl sm:text-2xl font-semibold">Community</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={subjectFilter ?? "all"}
            onValueChange={(v) => setSubjectFilter(v === "all" ? null : v)}
          >
            <SelectTrigger className="w-full min-w-[8rem] sm:w-40 min-h-10 touch-manipulation">
              <SelectValue placeholder="Subject" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All subjects</SelectItem>
              {SUBJECTS.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="min-h-10 touch-manipulation">New post</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New post</DialogTitle>
                <DialogDescription>
                  Post to the community forum. Choose a subject and add title and content.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Select value={subject} onValueChange={setSubject}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUBJECTS.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="post-title">Title</Label>
                  <Input
                    id="post-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Post title"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="post-content">Content</Label>
                  <textarea
                    id="post-content"
                    className="w-full min-h-24 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Write your post..."
                    required
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Posting…" : "Post"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading && <p className="text-muted-foreground text-sm">Loading posts…</p>}
      {isError && <p className="text-destructive text-sm">Error: {error?.message}</p>}
      {!isLoading && !isError && (
        <div className="space-y-4">
          {!posts?.length ? (
            <p className="text-muted-foreground text-sm">No posts yet. Start the conversation.</p>
          ) : (
            posts.map((post) => (
              <Card key={post.id} className="touch-manipulation">
                <CardHeader className="pb-2 px-4 sm:px-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
                    <CardTitle className="text-base">{post.title}</CardTitle>
                    <span className="text-xs text-muted-foreground">{post.subject}</span>
                  </div>
                  <CardDescription>
                    {authors?.[post.author_id] ?? "—"} · {new Date(post.created_at).toLocaleString()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-4 sm:px-6">
                  <p className="text-sm whitespace-pre-wrap">{post.content}</p>
                  <Button variant="ghost" size="sm" className="mt-2 min-h-10" asChild>
                    <a href={`/dashboard/community/${post.id}`}>View & reply</a>
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
    </FeatureGate>
  );
}

function CommunityUpgradeMessage() {
  return (
    <div className="px-2 sm:px-4">
      <h1 className="text-xl font-semibold mb-2">Community</h1>
      <p className="text-muted-foreground">Community forum is available on Growth and Elite plans. Contact your admin to upgrade.</p>
    </div>
  );
}
