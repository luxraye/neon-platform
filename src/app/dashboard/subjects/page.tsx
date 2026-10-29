"use client";

import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BookOpen,
  ExternalLink,
  FileImage,
  FileText,
  Link2,
  Presentation,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { qMaterials, type MaterialDto } from "@/app/data/queries";
import { useStaffRole } from "@/hooks/use-staff-role";
import { useCohorts } from "@/hooks/use-cohorts";
import { cn } from "@/lib/utils";
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
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge, EmptyState, PageHeader } from "@/components/ui/page";
import { createMaterial, deleteMaterial, uploadMaterialDocument } from "../materials/actions";

const MAX_MB = 25;
const OTHER = "Other";

function kindOf(url: string | null) {
  const path = (url ?? "").split("?")[0].toLowerCase();
  const ext = decodeURIComponent(path).split(".").pop() ?? "";
  if (ext === "pdf") return { label: "PDF", icon: FileText, tone: "text-destructive bg-destructive/10" };
  if (ext === "docx") return { label: "Word", icon: FileText, tone: "text-primary bg-secondary" };
  if (ext === "pptx") return { label: "Slides", icon: Presentation, tone: "text-warning bg-warning/10" };
  if (["png", "jpg", "jpeg"].includes(ext)) return { label: "Image", icon: FileImage, tone: "text-success bg-success/10" };
  return { label: "Link", icon: Link2, tone: "text-muted-foreground bg-muted" };
}

type Draft = { title: string; subject: string; description: string; cohort: string; url: string; file: File | null };
const EMPTY: Draft = { title: "", subject: "", description: "", cohort: "none", url: "", file: null };

export default function MaterialsLibraryPage() {
  const queryClient = useQueryClient();
  const { isStaff, profileData } = useStaffRole();
  const institutionId = profileData?.profile?.institution_id ?? null;
  const { data: cohorts } = useCohorts(institutionId);
  const { data, isLoading } = useQuery({
    queryKey: ["materials", institutionId ?? ""],
    queryFn: () => qMaterials(),
    enabled: !!institutionId,
  });

  const materials = useMemo(() => data ?? [], [data]);
  const subjects = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of materials) {
      const s = m.subject?.trim() || OTHER;
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [materials]);

  const [active, setActive] = useState("all");
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const visible = materials.filter(
    (m) =>
      (active === "all" || (m.subject?.trim() || OTHER) === active) &&
      (!q || m.title.toLowerCase().includes(q) || (m.description ?? "").toLowerCase().includes(q))
  );
  const cohortName = (id: string | null) => (id ? cohorts?.find((c) => c.id === id)?.name ?? "Cohort" : "All cohorts");

  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["materials"] });

  function pickFile(f: File | null) {
    if (!draft) return;
    if (f && f.size > MAX_MB * 1024 * 1024) {
      toast.error(`That file is over ${MAX_MB} MB. Share a link to it instead.`);
      return;
    }
    setDraft({ ...draft, file: f, url: f ? "" : draft.url, title: draft.title || (f ? f.name.replace(/\.[^.]+$/, "") : "") });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    if (!draft.file && !draft.url.trim()) {
      toast.error("Add a file or paste a link.");
      return;
    }
    setSaving(true);
    let res;
    if (draft.file) {
      const fd = new FormData();
      fd.append("file", draft.file);
      fd.append("title", draft.title.trim());
      if (draft.subject.trim()) fd.append("subject", draft.subject.trim());
      if (draft.description.trim()) fd.append("description", draft.description.trim());
      if (draft.cohort !== "none") fd.append("cohort_id", draft.cohort);
      res = await uploadMaterialDocument(fd);
    } else {
      res = await createMaterial({
        title: draft.title,
        content_url: draft.url,
        description: draft.description || undefined,
        subject: draft.subject || undefined,
        cohort_id: draft.cohort === "none" ? undefined : draft.cohort,
      });
    }
    setSaving(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success("Added. Students in that cohort have been notified.");
    setDraft(null);
    refresh();
  }

  async function remove(m: MaterialDto) {
    if (!confirm(`Remove “${m.title}”?`)) return;
    const res = await deleteMaterial(m.id);
    if (!res.success) toast.error(res.error);
    else {
      toast.success("Removed.");
      refresh();
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Materials"
        description="Notes, past papers and slides, grouped by subject. Students see what's shared with their cohort."
        actions={
          isStaff ? (
            <Button onClick={() => setDraft({ ...EMPTY, subject: active !== "all" && active !== OTHER ? active : "" })}>
              <Upload /> Add material
            </Button>
          ) : null
        }
      />

      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search materials" className="pl-9" aria-label="Search materials" />
        </div>
        {subjects.length > 0 ? (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
            {[["all", materials.length] as [string, number], ...subjects].map(([s, n]) => (
              <button
                key={s}
                onClick={() => setActive(s)}
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors",
                  active === s ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"
                )}
              >
                {s === "all" ? "All" : s} <span className="opacity-70">{n}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={materials.length ? "Nothing matches" : "No materials yet"}
          body={materials.length ? "Try another subject or search." : isStaff ? "Upload a PDF, Word file, slides or a photo of notes, or paste a link." : "Your tutors haven't shared anything yet."}
          action={
            isStaff && !materials.length ? (
              <Button onClick={() => setDraft({ ...EMPTY })}>
                <Upload /> Add material
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((m) => {
            const k = kindOf(m.content_url);
            return (
              <article key={m.id} className="group relative flex flex-col rounded-2xl border border-border bg-card p-5 transition-shadow hover:shadow-md">
                <div className="flex items-start gap-3">
                  <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", k.tone)}>
                    <k.icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="line-clamp-2 font-bold leading-snug">{m.title}</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {m.subject || OTHER} · {k.label}
                    </p>
                  </div>
                </div>
                {m.description ? <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{m.description}</p> : null}
                <div className="mt-auto flex items-center justify-between gap-2 pt-4">
                  {isStaff ? <Badge>{cohortName(m.cohort_id)}</Badge> : <span className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>}
                  <div className="flex items-center gap-1">
                    {isStaff ? (
                      <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive" onClick={() => remove(m)} aria-label={`Remove ${m.title}`}>
                        <Trash2 />
                      </Button>
                    ) : null}
                    {m.content_url ? (
                      <Button asChild size="sm" variant="outline">
                        <a href={m.content_url} target="_blank" rel="noopener noreferrer">
                          Open <ExternalLink />
                        </a>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add material</DialogTitle>
            <DialogDescription>PDF, Word, PowerPoint, JPEG or PNG up to {MAX_MB} MB, or a link to anything else.</DialogDescription>
          </DialogHeader>
          {draft ? (
            <form onSubmit={save} className="space-y-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  pickFile(e.dataTransfer.files?.[0] ?? null);
                }}
                onClick={() => fileRef.current?.click()}
                className={cn(
                  "flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors",
                  dragOver ? "border-primary bg-secondary/60" : "border-border hover:bg-muted/60"
                )}
              >
                <Upload className="size-5 text-primary" />
                {draft.file ? (
                  <p className="mt-2 text-sm font-semibold">
                    {draft.file.name} <span className="font-normal text-muted-foreground">· {(draft.file.size / 1024 / 1024).toFixed(1)} MB</span>
                  </p>
                ) : (
                  <p className="mt-2 text-sm">
                    <span className="font-semibold text-primary">Choose a file</span> or drop it here
                  </p>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  className="sr-only"
                  accept=".pdf,.docx,.pptx,.jpg,.jpeg,.png"
                  onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                />
              </div>
              {!draft.file ? (
                <div className="space-y-2">
                  <Label htmlFor="m-url">Or paste a link</Label>
                  <Input id="m-url" type="url" value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} placeholder="https://youtube.com/…" />
                </div>
              ) : (
                <button type="button" className="text-xs font-semibold text-muted-foreground hover:text-foreground" onClick={() => pickFile(null)}>
                  Remove file
                </button>
              )}
              <div className="space-y-2">
                <Label htmlFor="m-title">Title</Label>
                <Input id="m-title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Chapter 3 notes" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="m-subject">Subject</Label>
                  <Input id="m-subject" list="subject-options" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} placeholder="Mathematics" />
                  <datalist id="subject-options">
                    {subjects.filter(([s]) => s !== OTHER).map(([s]) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </div>
                <div className="space-y-2">
                  <Label>Share with</Label>
                  <Select value={draft.cohort} onValueChange={(v) => setDraft({ ...draft, cohort: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">All cohorts</SelectItem>
                      {cohorts?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="m-desc">Note for students</Label>
                <Input id="m-desc" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Optional" />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDraft(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? (draft.file ? "Uploading…" : "Saving…") : "Add material"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
