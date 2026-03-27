"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useProfile } from "@/hooks/use-profile";
import { useCohorts } from "@/hooks/use-cohorts";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createMaterial } from "./actions";

type Material = {
  id: string;
  title: string;
  content_url: string | null;
  description: string | null;
  subject: string | null;
  cohort_id: string | null;
  created_at: string;
};

function useMaterials(institutionId: string | null) {
  const supabase = createBrowserSupabaseClient();
  return useQuery({
    queryKey: ["materials", institutionId ?? ""],
    queryFn: async (): Promise<Material[]> => {
      if (!institutionId) return [];
      const { data, error } = await supabase
        .from("materials")
        .select("id, title, content_url, description, subject, cohort_id, created_at")
        .eq("institution_id", institutionId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Material[];
    },
    enabled: !!institutionId,
  });
}

export default function MaterialsPage() {
  const queryClient = useQueryClient();
  const { data: profileData } = useProfile();
  const role =
    (profileData?.profile?.role ??
      (profileData?.user?.user_metadata?.role as string | undefined) ??
      undefined) as string | undefined;
  const institutionId =
    profileData?.profile?.institution_id ??
    (profileData?.user?.user_metadata?.institution_id as string | undefined) ??
    null;
  const { data: cohorts } = useCohorts(institutionId);
  const { data: materials, isLoading, isError, error } = useMaterials(institutionId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [contentUrl, setContentUrl] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [cohortId, setCohortId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const canManage =
    role === "headmaster" || role === "tutor";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const result = await createMaterial({
      title,
      content_url: contentUrl || undefined,
      description: description || undefined,
      subject: subject || undefined,
      cohort_id: cohortId || undefined,
    });
    setSubmitting(false);
    if (result.success) {
      toast.success("Material added.");
      setDialogOpen(false);
      setTitle("");
      setContentUrl("");
      setDescription("");
      setSubject("");
      setCohortId("");
      queryClient.invalidateQueries({ queryKey: ["materials", institutionId ?? ""] });
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Materials</h1>
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>Upload Material</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Material</DialogTitle>
                <DialogDescription>
                  Add a material and assign it to a cohort so students can access it.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="mat-title">Title</Label>
                  <Input
                    id="mat-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Chapter 1 Notes"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mat-url">Content URL (optional)</Label>
                  <Input
                    id="mat-url"
                    type="url"
                    value={contentUrl}
                    onChange={(e) => setContentUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cohort</Label>
                  <Select value={cohortId} onValueChange={setCohortId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select cohort" />
                    </SelectTrigger>
                    <SelectContent>
                      {cohorts?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mat-subject">Subject (optional)</Label>
                  <Input
                    id="mat-subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Mathematics"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mat-desc">Description (optional)</Label>
                  <Input
                    id="mat-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description"
                  />
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Adding…" : "Add Material"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading && <p className="text-muted-foreground">Loading materials…</p>}
      {isError && (
        <p className="text-destructive">Error: {error?.message}</p>
      )}
      {!isLoading && !isError && (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Cohort</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Link</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!materials?.length ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No materials yet. {canManage ? "Upload one to get started." : ""}
                  </TableCell>
                </TableRow>
              ) : (
                materials.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.title}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {cohorts?.find((c) => c.id === m.cohort_id)?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {m.subject ?? "—"}
                    </TableCell>
                    <TableCell>
                      {m.content_url ? (
                        <a
                          href={m.content_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline"
                        >
                          Open
                        </a>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
