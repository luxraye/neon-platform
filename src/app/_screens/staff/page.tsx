"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Copy, GraduationCap, Inbox, Search, UserPlus, Users, X } from "lucide-react";
import { useProfile } from "@/hooks/use-profile";
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
import { Badge, EmptyState, PageHeader, Panel } from "@/components/ui/page";
import {
  approveJoinRequest,
  assignStudentToCohort,
  getStaff,
  hireTutor,
  listJoinRequests,
  provisionStudent,
  rejectJoinRequest,
  removeStudent,
  removeTutor,
  type JoinRequestRow,
} from "./actions";
import { getCohorts } from "../cohorts/actions";

type Tab = "students" | "tutors";
type NewPersonKind = "student" | "tutor" | null;

function initials(name: string | null, email: string) {
  const src = (name || email).trim();
  const parts = src.split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function Avatar({ name, email }: { name: string | null; email: string }) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">
      {initials(name, email)}
    </span>
  );
}

function since(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function suggestPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint32Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export default function StaffPage() {
  const queryClient = useQueryClient();
  const { data: me } = useProfile();
  const isHeadmaster = me?.profile?.role === "headmaster";

  const [tab, setTab] = useState<Tab>("students");
  const [search, setSearch] = useState("");
  const [cohortFilter, setCohortFilter] = useState("all");
  const [newKind, setNewKind] = useState<NewPersonKind>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [approvedLink, setApprovedLink] = useState<{ email: string; link: string } | null>(null);

  const staff = useQuery({ queryKey: ["staff", "list"], queryFn: () => getStaff() });
  const cohortsQ = useQuery({ queryKey: ["staff", "cohorts"], queryFn: getCohorts });
  const requestsQ = useQuery({
    queryKey: ["staff", "requests"],
    queryFn: listJoinRequests,
    enabled: isHeadmaster,
  });

  const cohorts = useMemo(() => (cohortsQ.data ?? []) as { id: string; name: string }[], [cohortsQ.data]);
  const cohortName = useMemo(() => Object.fromEntries(cohorts.map((c) => [c.id, c.name])), [cohorts]);
  const students = staff.data?.students ?? [];
  const tutors = staff.data?.tutors ?? [];
  const requests = requestsQ.data ?? [];

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["staff"] });

  const q = search.trim().toLowerCase();
  const match = (p: { full_name: string | null; email: string }) =>
    !q || (p.full_name ?? "").toLowerCase().includes(q) || p.email.toLowerCase().includes(q);

  const visibleStudents = students.filter(
    (s) =>
      match(s) &&
      (cohortFilter === "all" ||
        (cohortFilter === "none" ? !s.cohort_id : s.cohort_id === cohortFilter))
  );
  const visibleTutors = tutors.filter(match);
  const activeStudents = students.filter((s) => !s.deleted_at).length;
  const unassigned = students.filter((s) => !s.deleted_at && !s.cohort_id).length;

  async function run<T extends { success: boolean }>(id: string, fn: () => Promise<T>, ok: string) {
    setBusyId(id);
    const res = await fn();
    setBusyId(null);
    if (res.success) {
      toast.success(ok);
      refresh();
    } else {
      toast.error((res as unknown as { error: string }).error);
    }
    return res;
  }

  async function approve(r: JoinRequestRow, cohortId: string | null) {
    setBusyId(r.id);
    const res = await approveJoinRequest(r.id, cohortId);
    setBusyId(null);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    refresh();
    if (res.emailed) {
      toast.success(`${r.full_name || r.email} approved. We emailed them a link to set their password.`);
    } else if (res.setupLink) {
      setApprovedLink({ email: res.email, link: res.setupLink });
    } else {
      toast.success(`${r.full_name || r.email} approved. They can use "Forgot password" on the sign-in page.`);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="People"
        description={
          isHeadmaster
            ? "Approve new students, add tutors and keep everyone in the right cohort."
            : "Everyone at your centre."
        }
        actions={
          isHeadmaster ? (
            <>
              <Button variant="outline" onClick={() => setNewKind("tutor")}>
                <GraduationCap /> Add tutor
              </Button>
              <Button onClick={() => setNewKind("student")}>
                <UserPlus /> Add student
              </Button>
            </>
          ) : null
        }
      />

      {isHeadmaster && requests.length > 0 ? (
        <Panel
          title={
            <span id="requests" className="flex items-center gap-2 scroll-mt-24">
              <Inbox className="size-4 text-primary" /> Waiting for approval
              <Badge tone="primary">{requests.length}</Badge>
            </span>
          }
        >
          <ul className="-my-2 divide-y divide-border">
            {requests.map((r) => (
              <JoinRequestItem
                key={r.id}
                request={r}
                cohorts={cohorts}
                busy={busyId === r.id}
                onApprove={(cohortId) => approve(r, cohortId)}
                onReject={() => {
                  if (!confirm(`Decline ${r.full_name || r.email}?`)) return;
                  void run(r.id, () => rejectJoinRequest(r.id), "Request declined.");
                }}
              />
            ))}
          </ul>
        </Panel>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="inline-flex rounded-xl border border-border bg-card p-1" role="tablist">
          {(
            [
              ["students", `Students · ${activeStudents}`],
              ["tutors", `Tutors · ${tutors.filter((t) => !t.deleted_at).length}`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={cn(
                "rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors",
                tab === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email"
            className="pl-9"
            aria-label="Search people"
          />
        </div>
        {tab === "students" ? (
          <Select value={cohortFilter} onValueChange={setCohortFilter}>
            <SelectTrigger className="sm:w-52" aria-label="Filter by cohort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All cohorts</SelectItem>
              <SelectItem value="none">Needs a cohort{unassigned ? ` (${unassigned})` : ""}</SelectItem>
              {cohorts.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      {staff.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : staff.isError ? (
        <EmptyState title="Couldn't load people" body="Check your connection and try again." action={<Button onClick={refresh}>Retry</Button>} />
      ) : tab === "students" ? (
        visibleStudents.length === 0 ? (
          <EmptyState
            icon={Users}
            title={students.length ? "No one matches" : "No students yet"}
            body={
              students.length
                ? "Try a different name or cohort."
                : "Share your join link from the overview page, or add a student yourself."
            }
          />
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border">
            {visibleStudents.map((s) => {
              const removed = !!s.deleted_at;
              return (
                <li key={s.id} className={cn("flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap", removed && "opacity-60")}>
                  <Avatar name={s.full_name} email={s.email} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{s.full_name || s.email}</p>
                    <p className="truncate text-xs text-muted-foreground">{s.email}</p>
                  </div>
                  {removed ? (
                    <Badge tone="danger">Removed · restorable for 72h</Badge>
                  ) : isHeadmaster ? (
                    <>
                      <Select
                        value={s.cohort_id ?? ""}
                        onValueChange={(cohortId) =>
                          run(s.id, () => assignStudentToCohort(s.id, cohortId), "Cohort updated.")
                        }
                        disabled={busyId === s.id}
                      >
                        <SelectTrigger
                          className={cn("w-full sm:w-48", !s.cohort_id && "border-warning/50 text-warning")}
                          aria-label={`Cohort for ${s.full_name || s.email}`}
                        >
                          <SelectValue placeholder="Needs a cohort" />
                        </SelectTrigger>
                        <SelectContent>
                          {cohorts.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive"
                        disabled={busyId === s.id}
                        onClick={() => {
                          if (!confirm(`Remove ${s.full_name || s.email}? An admin can restore them within 72 hours.`)) return;
                          void run(s.id, () => removeStudent(s.id), "Student removed.");
                        }}
                      >
                        Remove
                      </Button>
                    </>
                  ) : s.cohort_id ? (
                    <Badge>{cohortName[s.cohort_id] ?? "Cohort"}</Badge>
                  ) : (
                    <Badge tone="warning">Needs a cohort</Badge>
                  )}
                </li>
              );
            })}
          </ul>
        )
      ) : visibleTutors.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title={tutors.length ? "No one matches" : "No tutors yet"}
          body={tutors.length ? "Try a different name." : "Add your first tutor so they can post materials and run quizzes."}
          action={
            isHeadmaster && !tutors.length ? (
              <Button onClick={() => setNewKind("tutor")}>
                <GraduationCap /> Add tutor
              </Button>
            ) : null
          }
        />
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border">
          {visibleTutors.map((t) => {
            const removed = !!t.deleted_at;
            return (
              <li key={t.id} className={cn("flex items-center gap-3 px-4 py-3", removed && "opacity-60")}>
                <Avatar name={t.full_name} email={t.email} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{t.full_name || t.email}</p>
                  <p className="truncate text-xs text-muted-foreground">{t.email}</p>
                </div>
                {removed ? (
                  <Badge tone="danger">Removed · restorable for 72h</Badge>
                ) : isHeadmaster ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive"
                    disabled={busyId === t.id}
                    onClick={() => {
                      if (!confirm(`Remove ${t.full_name || t.email}? An admin can restore them within 72 hours.`)) return;
                      void run(t.id, () => removeTutor(t.id), "Tutor removed.");
                    }}
                  >
                    Remove
                  </Button>
                ) : (
                  <Badge tone="primary">Tutor</Badge>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <NewPersonDialog
        kind={newKind}
        cohorts={cohorts}
        onClose={() => setNewKind(null)}
        onCreated={() => {
          setNewKind(null);
          refresh();
        }}
      />

      <Dialog open={!!approvedLink} onOpenChange={(o) => !o && setApprovedLink(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Student approved</DialogTitle>
            <DialogDescription>
              We couldn&apos;t email {approvedLink?.email}. Send them this link on WhatsApp so they can choose a
              password. It works once.
            </DialogDescription>
          </DialogHeader>
          {approvedLink ? <CopyField value={approvedLink.link} /> : null}
          <DialogFooter>
            <Button onClick={() => setApprovedLink(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded-lg bg-muted px-3 py-2 text-xs">{value}</code>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            // Clipboard blocked; the value is still visible.
          }
        }}
      >
        {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

function JoinRequestItem({
  request,
  cohorts,
  busy,
  onApprove,
  onReject,
}: {
  request: JoinRequestRow;
  cohorts: { id: string; name: string }[];
  busy: boolean;
  onApprove: (cohortId: string | null) => void;
  onReject: () => void;
}) {
  const [cohortId, setCohortId] = useState("none");
  return (
    <li className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={request.full_name} email={request.email} />
        <div className="min-w-0">
          <p className="truncate font-semibold">
            {request.full_name || request.email}{" "}
            <span className="font-normal text-xs text-muted-foreground">· {since(request.created_at)}</span>
          </p>
          <p className="truncate text-xs text-muted-foreground">{request.email}</p>
          {request.message ? <p className="mt-1 line-clamp-2 text-sm">&ldquo;{request.message}&rdquo;</p> : null}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Select value={cohortId} onValueChange={setCohortId}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Cohort">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Pick cohort later</SelectItem>
            {cohorts.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" disabled={busy} onClick={() => onApprove(cohortId === "none" ? null : cohortId)}>
          <Check /> Approve
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onReject} aria-label="Decline">
          <X />
        </Button>
      </div>
    </li>
  );
}

function NewPersonDialog({
  kind,
  cohorts,
  onClose,
  onCreated,
}: {
  kind: NewPersonKind;
  cohorts: { id: string; name: string }[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [cohortId, setCohortId] = useState("none");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setEmail("");
    setFullName("");
    setPassword("");
    setCohortId("none");
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const res =
      kind === "tutor"
        ? await hireTutor({ email, password, full_name: fullName || undefined })
        : await provisionStudent({
            email,
            password,
            full_name: fullName || undefined,
            cohort_id: cohortId === "none" ? undefined : cohortId,
          });
    setSubmitting(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success(`${kind === "tutor" ? "Tutor" : "Student"} added. Share the email and password with them.`);
    reset();
    onCreated();
  }

  return (
    <Dialog
      open={!!kind}
      onOpenChange={(o) => {
        if (!o) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{kind === "tutor" ? "Add a tutor" : "Add a student"}</DialogTitle>
          <DialogDescription>
            {kind === "tutor"
              ? "Tutors can post materials, run quizzes, mark attendance and talk to students."
              : "For students who can't use the join link. They'll sign in with the details you set here."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="np-name">Full name</Label>
            <Input id="np-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Kagiso Molefe" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="np-email">Email</Label>
            <Input
              id="np-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              required
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="np-password">Starting password</Label>
              <button
                type="button"
                className="text-xs font-semibold text-primary hover:underline"
                onClick={() => setPassword(suggestPassword())}
              >
                Suggest one
              </button>
            </div>
            <Input
              id="np-password"
              type="text"
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              minLength={8}
              required
            />
          </div>
          {kind === "student" ? (
            <div className="space-y-2">
              <Label>Cohort</Label>
              <Select value={cohortId} onValueChange={setCohortId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Pick later</SelectItem>
                  {cohorts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Adding…" : kind === "tutor" ? "Add tutor" : "Add student"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
