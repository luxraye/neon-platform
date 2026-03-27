"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useProfile } from "@/hooks/use-profile";
import { useCohorts } from "@/hooks/use-cohorts";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createCohort, deleteCohort, getCohorts, updateCohort } from "./actions";
import { assignStudentToCohort, getStaff } from "../staff/actions";

export default function CohortsPage() {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { data: profileData } = useProfile();
  const institutionId = profileData?.profile?.institution_id ?? null;
  const isHeadmasterRoute = pathname != null && pathname.startsWith("/headmaster");
  const isTutorRoute = pathname != null && pathname.startsWith("/tutor");
  const { data: cohortsFromServer, isLoading: cohortsServerLoading } = useQuery({
    queryKey: ["cohorts", "list"],
    queryFn: getCohorts,
    enabled: !!isHeadmasterRoute || !!isTutorRoute,
  });
  const clientCohorts = useCohorts(institutionId);
  const isStaffRoute = isHeadmasterRoute || isTutorRoute;
  const cohorts = isStaffRoute ? (cohortsFromServer ?? null) : clientCohorts.data ?? null;
  const isLoading = isStaffRoute ? cohortsServerLoading : clientCohorts.isLoading;
  const isError = clientCohorts.isError;
  const error = clientCohorts.error;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Tutor-only: assign unassigned students to cohorts
  const { data: staffPayload } = useQuery({
    queryKey: ["staff", "cohorts-assignment", institutionId ?? ""],
    queryFn: () => getStaff(institutionId ?? "", []),
    enabled: !!isTutorRoute,
  });
  const unassignedStudents =
    (staffPayload?.students ?? []).filter((s) => !s.cohort_id) ?? [];

  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assigningStudentId, setAssigningStudentId] = useState<string | null>(null);
  const [assignmentCohortId, setAssignmentCohortId] = useState<string>("");
  const [assigning, setAssigning] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const canCreateCohorts =
    profileData?.profile?.role === "headmaster" ||
    profileData?.profile?.role === "tutor" ||
    isHeadmasterRoute ||
    isTutorRoute;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const result = await createCohort({ name, description });
    setSubmitting(false);
    if (result.success) {
      toast.success("Cohort created.");
      setDialogOpen(false);
      setName("");
      setDescription("");
      queryClient.invalidateQueries({ queryKey: ["cohorts", institutionId ?? ""] });
      queryClient.invalidateQueries({ queryKey: ["cohorts", "list"] });
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit cohort</DialogTitle>
            <DialogDescription>Update the cohort name or description.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!editingId) return;
              setEditSubmitting(true);
              const result = await updateCohort(editingId, {
                name: editName,
                description: editDescription,
              });
              setEditSubmitting(false);
              if (!result.success) {
                toast.error(result.error);
                return;
              }
              toast.success("Cohort updated.");
              setEditOpen(false);
              setEditingId(null);
              queryClient.invalidateQueries({ queryKey: ["cohorts", institutionId ?? ""] });
              queryClient.invalidateQueries({ queryKey: ["cohorts", "list"] });
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="edit-cohort-name">Name</Label>
              <Input
                id="edit-cohort-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-cohort-desc">Description (optional)</Label>
              <Input
                id="edit-cohort-desc"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={editSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={editSubmitting}>
                {editSubmitting ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete cohort?</DialogTitle>
            <DialogDescription>
              This cannot be undone. Students linked to this cohort may need to be reassigned first.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleteSubmitting}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteSubmitting}
              onClick={async () => {
                if (!deletingId) return;
                setDeleteSubmitting(true);
                const result = await deleteCohort(deletingId);
                setDeleteSubmitting(false);
                if (!result.success) {
                  toast.error(result.error);
                  return;
                }
                toast.success("Cohort deleted.");
                setDeleteOpen(false);
                setDeletingId(null);
                queryClient.invalidateQueries({ queryKey: ["cohorts", institutionId ?? ""] });
                queryClient.invalidateQueries({ queryKey: ["cohorts", "list"] });
              }}
            >
              {deleteSubmitting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Cohorts</h1>
        {canCreateCohorts && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>Create Cohort</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Cohort</DialogTitle>
                <DialogDescription>
                  Add a new cohort for your institution.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cohort-name">Name</Label>
                  <Input
                    id="cohort-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Class of 2025"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cohort-desc">Description (optional)</Label>
                  <Input
                    id="cohort-desc"
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
                    {submitting ? "Creating…" : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isTutorRoute && (
        <div className="rounded-lg border bg-card p-4 mb-6">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <h2 className="text-lg font-medium">Assign Students to Cohorts</h2>
            <p className="text-sm text-muted-foreground">
              Tutors can assign unassigned students so they can access materials/quizzes.
            </p>
          </div>

          {!unassignedStudents.length ? (
            <p className="text-muted-foreground">No unassigned students.</p>
          ) : (
            <div className="space-y-3">
              {unassignedStudents.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-medium">{s.full_name ?? s.email}</div>
                    <div className="text-xs text-muted-foreground">{s.email}</div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setAssigningStudentId(s.id);
                      setAssignmentCohortId("");
                      setAssignDialogOpen(true);
                    }}
                  >
                    Assign
                  </Button>
                </div>
              ))}
            </div>
          )}

          <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Assign student</DialogTitle>
                <DialogDescription>
                  Choose a cohort for this student.
                </DialogDescription>
              </DialogHeader>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!assigningStudentId) return;
                  if (!assignmentCohortId) {
                    toast.error("Select a cohort.");
                    return;
                  }
                  setAssigning(true);
                  const result = await assignStudentToCohort(assigningStudentId, assignmentCohortId);
                  setAssigning(false);
                  if (!result.success) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success("Student assigned.");
                  setAssignDialogOpen(false);
                  setAssigningStudentId(null);
                  queryClient.invalidateQueries({ queryKey: ["staff", "cohorts-assignment"] });
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label>Cohort</Label>
                  <Select value={assignmentCohortId} onValueChange={setAssignmentCohortId}>
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

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setAssignDialogOpen(false)} disabled={assigning}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={assigning}>
                    {assigning ? "Assigning…" : "Assign"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {isLoading && (
        <p className="text-muted-foreground">Loading cohorts…</p>
      )}
      {isError && (
        <p className="text-destructive">Error: {error?.message}</p>
      )}
      {!isLoading && !isError && (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Created</TableHead>
                {canCreateCohorts && <TableHead className="w-[140px] text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {!cohorts?.length ? (
                <TableRow>
                  <TableCell
                    colSpan={canCreateCohorts ? 4 : 3}
                    className="text-center text-muted-foreground py-8"
                  >
                    No cohorts yet. {canCreateCohorts ? "Create one to get started." : ""}
                  </TableCell>
                </TableRow>
              ) : (
                cohorts.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.description ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString()}
                    </TableCell>
                    {canCreateCohorts && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingId(c.id);
                              setEditName(c.name);
                              setEditDescription(c.description ?? "");
                              setEditOpen(true);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              setDeletingId(c.id);
                              setDeleteOpen(true);
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    )}
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
