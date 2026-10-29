"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MoreHorizontal, Pencil, Plus, Trash2, Users, UsersRound } from "lucide-react";
import { useProfile } from "@/hooks/use-profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge, EmptyState, PageHeader, Panel } from "@/components/ui/page";
import { createCohort, deleteCohort, getCohorts, updateCohort } from "./actions";
import { assignStudentToCohort, getStaff } from "../staff/actions";

type Cohort = { id: string; name: string; description: string | null; created_at: string };
type Editing = { id: string | null; name: string; description: string } | null;

export default function CohortsPage() {
  const queryClient = useQueryClient();
  const { data: me } = useProfile();
  const role = me?.profile?.role;
  const canManage = role === "headmaster" || role === "tutor";

  const cohortsQ = useQuery({ queryKey: ["cohorts", "list"], queryFn: getCohorts });
  const staffQ = useQuery({ queryKey: ["staff", "list"], queryFn: () => getStaff(), enabled: canManage });

  const cohorts = (cohortsQ.data ?? []) as Cohort[];
  const students = useMemo(() => (staffQ.data?.students ?? []).filter((s) => !s.deleted_at), [staffQ.data]);
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of students) if (s.cohort_id) m[s.cohort_id] = (m[s.cohort_id] ?? 0) + 1;
    return m;
  }, [students]);
  const unassigned = students.filter((s) => !s.cohort_id);

  const [editing, setEditing] = useState<Editing>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Cohort | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["cohorts"] });
    queryClient.invalidateQueries({ queryKey: ["staff"] });
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    const payload = { name: editing.name, description: editing.description };
    const res = editing.id ? await updateCohort(editing.id, payload) : await createCohort(payload);
    setSaving(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success(editing.id ? "Cohort updated." : "Cohort created.");
    setEditing(null);
    refresh();
  }

  async function confirmDelete() {
    if (!deleting) return;
    setSaving(true);
    const res = await deleteCohort(deleting.id);
    setSaving(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success("Cohort deleted.");
    setDeleting(null);
    refresh();
  }

  async function assign(studentId: string, cohortId: string) {
    setBusyId(studentId);
    const res = await assignStudentToCohort(studentId, cohortId);
    setBusyId(null);
    if (!res.success) toast.error(res.error);
    else {
      toast.success("Student placed.");
      refresh();
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cohorts"
        description="Group students into classes. Materials, quizzes and timetable slots can target a cohort."
        actions={
          canManage ? (
            <Button onClick={() => setEditing({ id: null, name: "", description: "" })}>
              <Plus /> New cohort
            </Button>
          ) : null
        }
      />

      {canManage && unassigned.length > 0 && cohorts.length > 0 ? (
        <Panel
          title={
            <span className="flex items-center gap-2">
              Needs a cohort <Badge tone="warning">{unassigned.length}</Badge>
            </span>
          }
        >
          <p className="mb-3 text-sm text-muted-foreground">
            These students can&apos;t see materials or quizzes until they&apos;re in a cohort.
          </p>
          <ul className="-my-2 divide-y divide-border">
            {unassigned.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 py-2.5 sm:flex-nowrap">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{s.full_name || s.email}</p>
                  <p className="truncate text-xs text-muted-foreground">{s.email}</p>
                </div>
                <Select onValueChange={(v) => assign(s.id, v)} disabled={busyId === s.id}>
                  <SelectTrigger className="w-full sm:w-48" aria-label={`Cohort for ${s.full_name || s.email}`}>
                    <SelectValue placeholder="Place in…" />
                  </SelectTrigger>
                  <SelectContent>
                    {cohorts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {cohortsQ.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : cohorts.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="No cohorts yet"
          body="Create one for each class or grade, for example “Form 5 Science”."
          action={
            canManage ? (
              <Button onClick={() => setEditing({ id: null, name: "", description: "" })}>
                <Plus /> New cohort
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cohorts.map((c) => (
            <article key={c.id} className="relative flex flex-col rounded-2xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-2">
                <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-primary">
                  <UsersRound className="size-5" />
                </span>
                {canManage ? (
                  <div className="relative">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Options for ${c.name}`}
                      onClick={() => setMenuFor(menuFor === c.id ? null : c.id)}
                    >
                      <MoreHorizontal />
                    </Button>
                    {menuFor === c.id ? (
                      <div
                        className="absolute right-0 z-10 mt-1 w-36 overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-lg"
                        onMouseLeave={() => setMenuFor(null)}
                      >
                        <button
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-muted"
                          onClick={() => {
                            setMenuFor(null);
                            setEditing({ id: c.id, name: c.name, description: c.description ?? "" });
                          }}
                        >
                          <Pencil className="size-4" /> Rename
                        </button>
                        <button
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            setMenuFor(null);
                            setDeleting(c);
                          }}
                        >
                          <Trash2 className="size-4" /> Delete
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <h2 className="mt-4 text-lg font-bold">{c.name}</h2>
              <p className="mt-1 line-clamp-2 flex-1 text-sm text-muted-foreground">
                {c.description || "No description"}
              </p>
              {canManage ? (
                <p className="mt-4 flex items-center gap-1.5 text-sm font-semibold">
                  <Users className="size-4 text-primary" />
                  {counts[c.id] ?? 0} {(counts[c.id] ?? 0) === 1 ? "student" : "students"}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Rename cohort" : "New cohort"}</DialogTitle>
            <DialogDescription>Use a name students will recognise, like their class or grade.</DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cohort-name">Name</Label>
              <Input
                id="cohort-name"
                value={editing?.name ?? ""}
                onChange={(e) => setEditing((p) => (p ? { ...p, name: e.target.value } : p))}
                placeholder="Form 5 Science"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cohort-desc">Description</Label>
              <Input
                id="cohort-desc"
                value={editing?.description ?? ""}
                onChange={(e) => setEditing((p) => (p ? { ...p, description: e.target.value } : p))}
                placeholder="Optional"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : editing?.id ? "Save" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleting?.name}?</DialogTitle>
            <DialogDescription>
              Students in this cohort will need a new one. Materials, quizzes and timetable slots for it are deleted too.
              This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={saving} onClick={confirmDelete}>
              {saving ? "Deleting…" : "Delete cohort"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
