"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
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
import { hireTutor, provisionStudent, assignStudentToCohort, getStaff, removeTutor, removeStudent } from "./actions";
import { getCohorts } from "../cohorts/actions";

type TutorProfile = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  deleted_at?: string | null;
};

type StudentProfile = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  cohort_id: string | null;
  deleted_at?: string | null;
};

function useTutors(institutionId: string | null) {
  const supabase = createBrowserSupabaseClient();
  return useQuery({
    queryKey: ["staff", "tutors", institutionId ?? ""],
    queryFn: async (): Promise<TutorProfile[]> => {
      if (!institutionId) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, role, deleted_at")
        .eq("institution_id", institutionId)
        .eq("role", "tutor")
        .or(`deleted_at.is.null,deleted_at.gte.${new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TutorProfile[];
    },
    enabled: !!institutionId,
  });
}

function useStudents(institutionId: string | null) {
  const supabase = createBrowserSupabaseClient();
  return useQuery({
    queryKey: ["staff", "students", institutionId ?? ""],
    queryFn: async (): Promise<StudentProfile[]> => {
      if (!institutionId) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, role, cohort_id, deleted_at")
        .eq("institution_id", institutionId)
        .eq("role", "student")
        .or(`deleted_at.is.null,deleted_at.gte.${new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as StudentProfile[];
    },
    enabled: !!institutionId,
  });
}

const useStaffFromServer = (
  enabled: boolean,
  institutionId: string | null,
  provisionedEmails: string[],
  staffRefreshNonce: number
) =>
  useQuery({
    queryKey: ["staff", "list", institutionId ?? "", staffRefreshNonce, provisionedEmails.join("|")],
    queryFn: () => getStaff(institutionId ?? "", provisionedEmails),
    // getStaff() uses service-role identity internally; it does not need client-side profile institution_id.
    enabled,
  });

export default function StaffPage() {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { data: profileData } = useProfile();
  const [authInstitutionId, setAuthInstitutionId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    supabase.auth.getUser().then(({ data }) => {
      const inst = (data.user?.user_metadata?.institution_id as string | undefined) ?? null;
      setAuthInstitutionId(inst);
    });
  }, []);

  const institutionId =
    profileData?.profile?.institution_id ??
    (profileData?.user?.user_metadata?.institution_id as string | undefined) ??
    authInstitutionId ??
    null;
  const isHeadmasterRoute = pathname != null && pathname.startsWith("/headmaster");
  const [provisionedEmails, setProvisionedEmails] = useState<string[]>([]);
  const [staffRefreshNonce, setStaffRefreshNonce] = useState(0);

  // For headmasters, use server-side cohorts so RLS doesn't hide options in the provisioning dropdown.
  const { data: cohortsFromServer } = useQuery({
    queryKey: ["staff", "cohorts", "server"],
    queryFn: getCohorts,
    enabled: !!isHeadmasterRoute,
  });

  const clientCohortsQuery = useCohorts(institutionId);
  const cohorts = isHeadmasterRoute ? cohortsFromServer : clientCohortsQuery.data;

  const { data: staffPayload, isLoading: staffLoading, isError: staffIsError, error: staffError } = useStaffFromServer(
    !!isHeadmasterRoute,
    institutionId,
    provisionedEmails,
    staffRefreshNonce
  );
  const clientTutors = useTutors(institutionId);
  const clientStudents = useStudents(institutionId);

  const tutors = isHeadmasterRoute ? (staffPayload?.tutors ?? null) : clientTutors.data ?? null;
  const tutorsLoading = isHeadmasterRoute ? staffLoading : clientTutors.isLoading;
  const tutorsError = isHeadmasterRoute ? staffIsError : clientTutors.isError;
  const tutorsErr = isHeadmasterRoute ? staffError : clientTutors.error;
  const students = isHeadmasterRoute ? (staffPayload?.students ?? null) : clientStudents.data ?? null;
  const studentsLoading = isHeadmasterRoute ? staffLoading : clientStudents.isLoading;
  const studentsError = isHeadmasterRoute ? staffIsError : clientStudents.isError;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [studentDialogOpen, setStudentDialogOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [studentPassword, setStudentPassword] = useState("");
  const [studentFullName, setStudentFullName] = useState("");
  const [studentCohortId, setStudentCohortId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [studentSubmitting, setStudentSubmitting] = useState(false);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [removingTutorId, setRemovingTutorId] = useState<string | null>(null);
  const [removingStudentId, setRemovingStudentId] = useState<string | null>(null);

  const isHeadmaster =
    profileData?.profile?.role === "headmaster" || (pathname != null && pathname.startsWith("/headmaster"));
  const unassignedStudents =
    students?.filter((s) => !s.cohort_id && !s.deleted_at) ?? [];

  const handleHire = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const result = await hireTutor({ email, password, full_name: fullName });
    setSubmitting(false);
    if (result.success) {
      toast.success("Tutor hired. They can sign in with the email and password you set.");
      setProvisionedEmails([result.provisionedEmail]);
      setStaffRefreshNonce((n) => n + 1);
      setDialogOpen(false);
      setEmail("");
      setPassword("");
      setFullName("");
      // Also invalidate by prefix so any other staff queries update immediately.
      queryClient.invalidateQueries({ queryKey: ["staff"] });
    } else {
      toast.error(result.error);
    }
  };

  const handleProvisionStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setStudentSubmitting(true);
    const result = await provisionStudent({
      email: studentEmail,
      password: studentPassword,
      full_name: studentFullName || undefined,
      cohort_id: studentCohortId === "none" ? undefined : studentCohortId || undefined,
    });
    setStudentSubmitting(false);
    if (result.success) {
      toast.success("Student account created. They can sign in with the email and password you set.");
      setProvisionedEmails([result.provisionedEmail]);
      setStaffRefreshNonce((n) => n + 1);
      setStudentDialogOpen(false);
      setStudentEmail("");
      setStudentPassword("");
      setStudentFullName("");
      setStudentCohortId("");
      queryClient.invalidateQueries({ queryKey: ["staff"] });
    } else {
      toast.error(result.error);
    }
  };

  const handleRemoveTutor = async (profileId: string) => {
    if (!confirm("Remove this tutor? They can be restored by an admin within 72 hours.")) return;
    setRemovingTutorId(profileId);
    const result = await removeTutor(profileId);
    setRemovingTutorId(null);
    if (result.success) {
      toast.success("Tutor marked for removal. Admin can restore within 72 hours.");
      setStaffRefreshNonce((n) => n + 1);
      queryClient.invalidateQueries({ queryKey: ["staff"] });
    } else toast.error(result.error);
  };

  const handleRemoveStudent = async (profileId: string) => {
    if (!confirm("Remove this student? They can be restored by an admin within 72 hours.")) return;
    setRemovingStudentId(profileId);
    const result = await removeStudent(profileId);
    setRemovingStudentId(null);
    if (result.success) {
      toast.success("Student marked for removal. Admin can restore within 72 hours.");
      setStaffRefreshNonce((n) => n + 1);
      queryClient.invalidateQueries({ queryKey: ["staff"] });
    } else toast.error(result.error);
  };

  const handleAssign = async (studentId: string, cohortId: string) => {
    setAssigningId(studentId);
    const result = await assignStudentToCohort(studentId, cohortId);
    setAssigningId(null);
    if (result.success) {
      toast.success("Student assigned to cohort.");
      setStaffRefreshNonce((n) => n + 1);
      queryClient.invalidateQueries({ queryKey: ["staff"] });
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Staff</h1>
        {isHeadmasterRoute && (
          <Button
            variant="outline"
            onClick={() => setStaffRefreshNonce((n) => n + 1)}
          >
            Refresh List
          </Button>
        )}
        {isHeadmaster && (
          <div className="flex gap-2">
            <Dialog open={studentDialogOpen} onOpenChange={setStudentDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">Provision New Student</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Provision New Student</DialogTitle>
                  <DialogDescription>
                    Create a student account for your institution. Optionally assign to a cohort now.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleProvisionStudent} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="student-email">Email</Label>
                    <Input
                      id="student-email"
                      type="email"
                      value={studentEmail}
                      onChange={(e) => setStudentEmail(e.target.value)}
                      placeholder="student@example.com"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="student-password">Password</Label>
                    <Input
                      id="student-password"
                      type="password"
                      value={studentPassword}
                      onChange={(e) => setStudentPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="student-name">Full name (optional)</Label>
                    <Input
                      id="student-name"
                      value={studentFullName}
                      onChange={(e) => setStudentFullName(e.target.value)}
                      placeholder="Student Name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Cohort (optional)</Label>
                    <Select value={studentCohortId} onValueChange={setStudentCohortId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Assign to cohort later" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None yet</SelectItem>
                        {cohorts?.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setStudentDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={studentSubmitting}>
                      {studentSubmitting ? "Creating…" : "Provision Student"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>Provision New Tutor</Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Provision New Tutor</DialogTitle>
                <DialogDescription>
                  Create a tutor account for your institution. They will sign in with the email and password you set and see Materials, Quizzes, Attendance, and Community.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleHire} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="tutor-email">Email</Label>
                  <Input
                    id="tutor-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tutor@example.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tutor-password">Password</Label>
                  <Input
                    id="tutor-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tutor-name">Full name (optional)</Label>
                  <Input
                    id="tutor-name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jane Doe"
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
                    {submitting ? "Creating…" : "Provision Tutor"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        )}
      </div>

      {/* Tutors */}
      <section className="mb-8">
        <h2 className="text-lg font-medium mb-3">Tutors</h2>
        {tutorsLoading && <p className="text-muted-foreground">Loading…</p>}
        {tutorsError && (
          <p className="text-destructive">Error: {tutorsErr?.message}</p>
        )}
        {!tutorsLoading && !tutorsError && (
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  {isHeadmaster && <TableHead className="w-24">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {!tutors?.length ? (
                  <TableRow>
                    <TableCell colSpan={isHeadmaster ? 3 : 2} className="text-center text-muted-foreground py-6">
                      No tutors yet. {isHeadmaster ? "Use Hire Tutor to add one." : ""}
                    </TableCell>
                  </TableRow>
                ) : (
                  tutors.map((t) => {
                    const isRemoved = !!(t as { deleted_at?: string | null }).deleted_at;
                    return (
                      <TableRow
                        key={t.id}
                        className={isRemoved ? "opacity-60 bg-muted/30" : undefined}
                      >
                        <TableCell className="font-medium">{t.full_name ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{t.email}</TableCell>
                        {isHeadmaster && (
                          <TableCell>
                            {isRemoved ? (
                              <span className="text-xs text-muted-foreground">Removed — admin can restore within 72h</span>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                disabled={removingTutorId === t.id}
                                onClick={() => handleRemoveTutor(t.id)}
                              >
                                {removingTutorId === t.id ? "…" : "Remove"}
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* New Students (Pending Assignment) */}
      {isHeadmaster && unassignedStudents.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-medium mb-3">New Students (Pending Assignment)</h2>
          <p className="text-sm text-muted-foreground mb-3">
            Assign these students to a cohort so they can access materials and quizzes.
          </p>
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="w-48">Assign to cohort</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unassignedStudents.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.full_name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{s.email}</TableCell>
                    <TableCell>
                      <Select
                        onValueChange={(cohortId) => handleAssign(s.id, cohortId)}
                        disabled={assigningId === s.id}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Choose cohort" />
                        </SelectTrigger>
                        <SelectContent>
                          {cohorts?.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {/* Students */}
      <section>
        <h2 className="text-lg font-medium mb-3">Students</h2>
        {studentsLoading && <p className="text-muted-foreground">Loading…</p>}
        {studentsError && <p className="text-destructive">Error loading students.</p>}
        {!studentsLoading && !studentsError && (
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Cohort</TableHead>
                  {isHeadmaster && <TableHead className="w-48">Assign</TableHead>}
                  {isHeadmaster && <TableHead className="w-24">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {!students?.length ? (
                  <TableRow>
                    <TableCell colSpan={isHeadmaster ? 5 : 3} className="text-center text-muted-foreground py-6">
                      No students yet. Share your join link: /join/[subdomain]
                    </TableCell>
                  </TableRow>
                ) : (
                  students.map((s) => {
                    const isRemoved = !!(s as { deleted_at?: string | null }).deleted_at;
                    return (
                      <TableRow
                        key={s.id}
                        className={isRemoved ? "opacity-60 bg-muted/30" : undefined}
                      >
                        <TableCell className="font-medium">{s.full_name ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{s.email}</TableCell>
                        <TableCell>
                          {cohorts?.find((c) => c.id === s.cohort_id)?.name ?? (
                            <span className="text-amber-600 dark:text-amber-400">Unassigned</span>
                          )}
                        </TableCell>
                        {isHeadmaster && (
                          <TableCell>
                            {isRemoved ? (
                              "—"
                            ) : !s.cohort_id ? (
                              <Select
                                onValueChange={(cohortId) => handleAssign(s.id, cohortId)}
                                disabled={assigningId === s.id}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Assign cohort" />
                                </SelectTrigger>
                                <SelectContent>
                                  {cohorts?.map((c) => (
                                    <SelectItem key={c.id} value={c.id}>
                                      {c.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                        )}
                        {isHeadmaster && (
                          <TableCell>
                            {isRemoved ? (
                              <span className="text-xs text-muted-foreground">Removed — admin can restore within 72h</span>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                disabled={removingStudentId === s.id}
                                onClick={() => handleRemoveStudent(s.id)}
                              >
                                {removingStudentId === s.id ? "…" : "Remove"}
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
