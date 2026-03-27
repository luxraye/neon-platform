"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createBrowserSupabaseClient } from "@/utils/supabase/client";
import { useProfile } from "@/hooks/use-profile";
import { useCohorts } from "@/hooks/use-cohorts";
import { useForumPosts } from "@/hooks/use-forum-posts";
import { createMaterial, deleteMaterial, uploadMaterialDocument } from "./../materials/actions";
import { useStaffRole } from "@/hooks/use-staff-role";
import { createPost } from "./../community/actions";
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
// No Shadcn Tabs component is available in this repo; use a simple toggle UI instead.
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type MaterialRow = {
  id: string;
  title: string;
  content_url: string | null;
  description: string | null;
  subject: string | null;
  cohort_id: string | null;
  created_at: string;
};

function normalizeSubject(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.trim();
  return t.length ? t : null;
}

export default function SubjectsPage() {
  const queryClient = useQueryClient();
  const supabase = createBrowserSupabaseClient();

  const { data: profileData } = useProfile();
  const { isStaff: canManage } = useStaffRole();

  const [authInstitutionId, setAuthInstitutionId] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      const inst =
        (data.user?.user_metadata?.institution_id as string | undefined) ?? null;
      setAuthInstitutionId(inst);
    });
    return () => {
      mounted = false;
    };
  }, [supabase]);

  const institutionId =
    profileData?.profile?.institution_id ??
    (profileData?.user?.user_metadata?.institution_id as string | undefined) ??
    authInstitutionId;

  const { data: cohorts } = useCohorts(institutionId);

  const [activeSubject, setActiveSubject] = useState<string>("none");
  const [tab, setTab] = useState<"documents" | "announcements">("documents");
  const [subjects, setSubjects] = useState<string[]>([]);

  const [materialDialogOpen, setMaterialDialogOpen] = useState(false);
  const [matTitle, setMatTitle] = useState("");
  const [matContentUrl, setMatContentUrl] = useState("");
  const [matFile, setMatFile] = useState<File | null>(null);
  const [matDescription, setMatDescription] = useState("");
  const [matCohortId, setMatCohortId] = useState("");
  const [matSubmitting, setMatSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [announcementDialogOpen, setAnnouncementDialogOpen] = useState(false);
  const [annTitle, setAnnTitle] = useState("");
  const [annContent, setAnnContent] = useState("");
  const [annSubmitting, setAnnSubmitting] = useState(false);

  const {
    data: announcements,
    isLoading: announcementsLoading,
    isError: announcementsError,
    error: announcementsErr,
  } = useForumPosts(
    institutionId,
    activeSubject && activeSubject !== "none" ? activeSubject : null
  );

  const refreshSubjects = async () => {
    if (!institutionId) {
      setSubjects([]);
      return;
    }
    const { data, error } = await supabase
      .from("materials")
      .select("subject")
      .eq("institution_id", institutionId)
      .order("created_at", { ascending: false });
    if (error) throw error;

    const distinct = Array.from(
      new Set(
        (data ?? [])
          .map((r) => normalizeSubject((r as { subject?: string | null }).subject))
          .filter((x): x is string => !!x)
      )
    );
    setSubjects(distinct);

    if ((activeSubject === "none" || !activeSubject) && distinct.length) setActiveSubject(distinct[0]);
  };

  useEffect(() => {
    // Prime subjects list.
    refreshSubjects().catch(() => {
      toast.error("Failed to load subjects.");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only rerun when institution changes
  }, [institutionId]);

  const activeSubjectResolved = activeSubject === "none" ? "" : activeSubject.trim();

  const [documents, setDocuments] = useState<MaterialRow[] | null>(null);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState<string | null>(null);

  const loadDocuments = async () => {
    if (!institutionId || !activeSubjectResolved) return;
    setDocsLoading(true);
    setDocsError(null);
    const { data, error } = await supabase
      .from("materials")
      .select("id, title, content_url, description, subject, cohort_id, created_at")
      .eq("institution_id", institutionId)
      .eq("subject", activeSubjectResolved)
      .order("created_at", { ascending: false });
    if (error) {
      setDocsError(error.message);
      setDocuments([]);
      setDocsLoading(false);
      return;
    }
    setDocuments((data ?? []) as MaterialRow[]);
    setDocsLoading(false);
  };

  useEffect(() => {
    if (!activeSubjectResolved) return;
    loadDocuments().catch(() => {
      toast.error("Failed to load documents.");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run on subject/institution change only
  }, [institutionId, activeSubjectResolved]);

  const handleCreateMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSubjectResolved) {
      toast.error("Select a subject first.");
      return;
    }
    if (!matTitle.trim()) {
      toast.error("Title is required.");
      return;
    }
    if (!matFile && !matContentUrl.trim()) {
      toast.error("Upload a file or paste a link.");
      return;
    }
    setMatSubmitting(true);
    let result;
    if (matFile) {
      const fd = new FormData();
      fd.append("file", matFile);
      fd.append("title", matTitle.trim());
      fd.append("subject", activeSubjectResolved);
      if (matDescription.trim()) fd.append("description", matDescription.trim());
      if (matCohortId && matCohortId !== "none") fd.append("cohort_id", matCohortId);
      result = await uploadMaterialDocument(fd);
    } else {
      result = await createMaterial({
        title: matTitle,
        content_url: matContentUrl || undefined,
        description: matDescription || undefined,
        subject: activeSubjectResolved,
        cohort_id: matCohortId === "none" || !matCohortId ? undefined : matCohortId,
      });
    }
    setMatSubmitting(false);
    if (result.success) {
      toast.success("Document added.");
      setMaterialDialogOpen(false);
      setMatTitle("");
      setMatContentUrl("");
      setMatFile(null);
      setMatDescription("");
      setMatCohortId("");
      queryClient.invalidateQueries({ queryKey: ["materials", institutionId ?? ""] });
      await refreshSubjects();
      await loadDocuments();
    } else {
      toast.error(result.error);
    }
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSubjectResolved) {
      toast.error("Select a subject first.");
      return;
    }
    if (!annTitle.trim() || !annContent.trim()) {
      toast.error("Title and content are required.");
      return;
    }
    setAnnSubmitting(true);
    const result = await createPost({
      subject: activeSubjectResolved,
      title: annTitle,
      content: annContent,
    });
    setAnnSubmitting(false);
    if (result.success) {
      toast.success("Announcement posted.");
      setAnnouncementDialogOpen(false);
      setAnnTitle("");
      setAnnContent("");
      queryClient.invalidateQueries({
        queryKey: ["forum-posts", institutionId ?? "", activeSubjectResolved ?? ""],
      });
    } else {
      toast.error(result.error);
    }
  };

  const [subjectInput, setSubjectInput] = useState("");
  const handleCreateSubjectLabel = () => {
    const next = subjectInput.trim();
    if (!next) return;
    if (!subjects.includes(next)) setSubjects((s) => [next, ...s]);
    setActiveSubject(next);
    setSubjectInput("");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Subjects</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Create subject areas, then add documents (PDF, Word, PowerPoint, or images) with optional descriptions.
          </p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <Input
              className="w-64"
              value={subjectInput}
              onChange={(e) => setSubjectInput(e.target.value)}
              placeholder="New subject name"
            />
            <Button variant="outline" onClick={handleCreateSubjectLabel} type="button">
              Create subject
            </Button>
          </div>
        )}
      </div>

      <div className="flex gap-4 flex-wrap mb-6">
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground">Subject:</Label>
          <Select
            value={activeSubjectResolved ? activeSubjectResolved : "none"}
            onValueChange={setActiveSubject}
          >
            <SelectTrigger className="w-80">
              <SelectValue placeholder="Select subject" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No subject selected</SelectItem>
              {subjects.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="mb-4 flex gap-2 flex-wrap">
        <Button type="button" variant={tab === "documents" ? "default" : "outline"} onClick={() => setTab("documents")}>
          Documents
        </Button>
        <Button type="button" variant={tab === "announcements" ? "default" : "outline"} onClick={() => setTab("announcements")}>
          Announcements
        </Button>
      </div>

      {tab === "documents" ? (
        <>
          {docsLoading && <p className="text-muted-foreground">Loading documents…</p>}
          {docsError && <p className="text-destructive">Error: {docsError}</p>}

          {!docsLoading && !docsError && (
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Cohort</TableHead>
                    <TableHead>Link</TableHead>
                    {canManage && <TableHead className="w-[100px] text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents?.length ? (
                    documents.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">
                          <div>{m.title}</div>
                          {m.description && (
                            <div className="text-xs text-muted-foreground font-normal mt-0.5">{m.description}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {cohorts?.find((c) => c.id === m.cohort_id)?.name ?? "—"}
                        </TableCell>
                        <TableCell>
                          {m.content_url ? (
                            <a href={m.content_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                              Open
                            </a>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        {canManage && (
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              disabled={deletingId === m.id}
                              onClick={async () => {
                                if (!confirm("Remove this document from the subject?")) return;
                                setDeletingId(m.id);
                                const res = await deleteMaterial(m.id);
                                setDeletingId(null);
                                if (!res.success) {
                                  toast.error(res.error);
                                  return;
                                }
                                toast.success("Document removed.");
                                queryClient.invalidateQueries({ queryKey: ["materials", institutionId ?? ""] });
                                await refreshSubjects();
                                await loadDocuments();
                              }}
                            >
                              {deletingId === m.id ? "…" : "Remove"}
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={canManage ? 4 : 3}
                        className="text-center text-muted-foreground py-8"
                      >
                        {canManage ? (
                          <>
                            No documents yet. Use <strong>Upload document</strong> below — PDF, .docx, .pptx, JPEG, or
                            PNG — or paste a link.
                          </>
                        ) : (
                          "No documents for this subject yet."
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {canManage && activeSubjectResolved && (
            <div className="mt-4 flex justify-end">
              <Dialog open={materialDialogOpen} onOpenChange={setMaterialDialogOpen}>
                <DialogTrigger asChild>
                  <Button>Upload Document</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Upload document</DialogTitle>
                    <DialogDescription>
                      Add a file (PDF, .docx, .pptx, JPEG, PNG) or an external link under “{activeSubjectResolved}”.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateMaterial} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="doc-title">Title</Label>
                      <Input id="doc-title" value={matTitle} onChange={(e) => setMatTitle(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="doc-file">File</Label>
                      <Input
                        id="doc-file"
                        type="file"
                        accept=".pdf,.docx,.pptx,.jpg,.jpeg,.png,application/pdf,image/*"
                        onChange={(e) => {
                          const f = e.target.files?.[0] ?? null;
                          setMatFile(f);
                          if (f) setMatContentUrl("");
                        }}
                      />
                      <p className="text-xs text-muted-foreground">
                        If you upload a file, the link field is ignored.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="doc-url">Or content URL (optional)</Label>
                      <Input
                        id="doc-url"
                        type="url"
                        value={matContentUrl}
                        onChange={(e) => {
                          setMatContentUrl(e.target.value);
                          if (e.target.value.trim()) setMatFile(null);
                        }}
                        placeholder="https://..."
                        disabled={!!matFile}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="doc-desc">Description (optional)</Label>
                      <Input id="doc-desc" value={matDescription} onChange={(e) => setMatDescription(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Cohort (optional)</Label>
                      <Select value={matCohortId} onValueChange={setMatCohortId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Applies to all cohorts" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {cohorts?.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setMaterialDialogOpen(false);
                          setMatFile(null);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={matSubmitting || (!matFile && !matContentUrl.trim())}
                      >
                        {matSubmitting ? "Adding…" : "Add"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <h2 className="text-lg font-medium">Announcements</h2>
            {canManage && activeSubjectResolved && (
              <Dialog open={announcementDialogOpen} onOpenChange={setAnnouncementDialogOpen}>
                <DialogTrigger asChild>
                  <Button>Post Announcement</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>New announcement</DialogTitle>
                    <DialogDescription>
                      Post to the forum under “{activeSubjectResolved}”.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateAnnouncement} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="ann-title">Title</Label>
                      <Input id="ann-title" value={annTitle} onChange={(e) => setAnnTitle(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ann-content">Content</Label>
                      <textarea
                        id="ann-content"
                        className="w-full min-h-32 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm"
                        value={annContent}
                        onChange={(e) => setAnnContent(e.target.value)}
                        required
                      />
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setAnnouncementDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={annSubmitting}>
                        {annSubmitting ? "Posting…" : "Post"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {announcementsLoading && <p className="text-muted-foreground">Loading announcements…</p>}
          {announcementsError && <p className="text-destructive">Error: {announcementsErr?.message}</p>}

          {!announcementsLoading && !announcementsError && (
            <div className="space-y-3">
              {announcements?.length ? (
                announcements.map((p) => (
                  <div key={p.id} className="rounded-lg border bg-card p-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <div className="font-medium">{p.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.subject} · {new Date(p.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <p className="text-sm mt-2 whitespace-pre-wrap">{p.content}</p>
                    <Button variant="ghost" size="sm" className="mt-2" asChild>
                      <a href={`/dashboard/community/${p.id}`}>View & reply</a>
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">No announcements yet for this subject.</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

