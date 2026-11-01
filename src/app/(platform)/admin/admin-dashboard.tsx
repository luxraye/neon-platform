"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, Copy, Inbox, Plus, RotateCcw, Search, Trash2, UserX, Users } from "lucide-react";
import { Badge, EmptyState, PageHeader, Panel, StatCard } from "@/components/ui/page";

type InstitutionRow = {
  id: string;
  name: string;
  subdomain: string;
  subscription_tier: string;
  is_trial: boolean;
  trial_ends_at: string | null;
  created_at: string;
};

type LeadRow = {
  id: string;
  name: string;
  email: string;
  institution_name: string | null;
  message: string | null;
  status: string;
  created_at: string;
};

type PendingDeletionRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  institution_id: string | null;
  deleted_at: string;
  deleted_by: string | null;
};

const RECOVERY_HOURS = 72;

export function AdminDashboard({
  institutions,
  studentCounts,
  leads,
  unreadLeadsCount,
  pendingDeletions = [],
}: {
  institutions: InstitutionRow[];
  studentCounts: Record<string, number>;
  leads: LeadRow[];
  unreadLeadsCount: number;
  pendingDeletions?: PendingDeletionRow[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [tier, setTier] = useState<"starter" | "growth" | "elite">("starter");
  const [headmasterEmail, setHeadmasterEmail] = useState("");
  const [headmasterPassword, setHeadmasterPassword] = useState("");
  const [headmasterFullName, setHeadmasterFullName] = useState("");
  const [extendingId, setExtendingId] = useState<string | null>(null);
  const [tierChangingId, setTierChangingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteModalId, setDeleteModalId] = useState<string | null>(null);
  const [confirmTypedName, setConfirmTypedName] = useState("");
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [search, setSearch] = useState("");

  function openProvisionManual() {
    setName("");
    setSubdomain("");
    setHeadmasterEmail("");
    setHeadmasterPassword("");
    setHeadmasterFullName("");
    setTier("starter");
    setOpen(true);
  }

  const totalStudents = Object.values(studentCounts).reduce((a, b) => a + b, 0);

  const handleRestore = async (profileId: string) => {
    setRestoringId(profileId);
    const { restoreProfile } = await import("./actions");
    const result = await restoreProfile(profileId);
    setRestoringId(null);
    if (result.success) {
      toast.success("Profile restored. They can sign in again.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const isRecoverable = (deletedAt: string) => {
    const at = new Date(deletedAt).getTime();
    const cutoff = Date.now() - RECOVERY_HOURS * 60 * 60 * 1000;
    return at > cutoff;
  };
  const recoverableUntil = (deletedAt: string) => {
    const d = new Date(deletedAt);
    d.setHours(d.getHours() + RECOVERY_HOURS);
    return d;
  };

  const handleExtendTrial = async (institutionId: string) => {
    setExtendingId(institutionId);
    const { extendTrial } = await import("./actions");
    const result = await extendTrial(institutionId);
    setExtendingId(null);
    if (result.success) {
      toast.success("Trial extended by 7 days.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const handleSetTier = async (institutionId: string, tierValue: "starter" | "growth" | "elite") => {
    setTierChangingId(institutionId);
    const { setInstitutionTier } = await import("./actions");
    const result = await setInstitutionTier(institutionId, tierValue);
    setTierChangingId(null);
    if (result.success) {
      toast.success("Tier updated.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const handleDelete = async (inst: InstitutionRow) => {
    if (confirmTypedName.trim() !== inst.name) {
      toast.error(`Type "${inst.name}" to confirm deletion.`);
      return;
    }
    setDeletingId(inst.id);
    const { deleteInstitution } = await import("./actions");
    const result = await deleteInstitution(inst.id);
    setDeletingId(null);
    setDeleteModalId(null);
    setConfirmTypedName("");
    if (result.success) {
      toast.success("Institution deleted. Associated profiles were unlinked.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const handleProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { provisionInstitution } = await import("./actions");
    const result = await provisionInstitution({
      name,
      subdomain,
      subscription_tier: tier,
      headmaster_email: headmasterEmail,
      headmaster_password: headmasterPassword || undefined,
      headmaster_full_name: headmasterFullName || undefined,
    });
    setLoading(false);
    if (result.success) {
      setCreated({ email: headmasterEmail, password: result.tempPassword ?? "" });
      setOpen(false);
      setName("");
      setSubdomain("");
      setTier("starter");
      setHeadmasterEmail("");
      setHeadmasterPassword("");
      setHeadmasterFullName("");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const q = search.trim().toLowerCase();
  const visible = institutions.filter((i) => !q || i.name.toLowerCase().includes(q) || i.subdomain.includes(q));
  const trials = institutions.filter((i) => i.is_trial).length;
  const deleting = institutions.find((i) => i.id === deleteModalId) ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Neon HQ"
        description="Every centre on the platform, their plans and trials."
        actions={
          <Button type="button" onClick={openProvisionManual}>
            <Plus /> New centre
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard tone="primary" icon={Building2} label="Centres" value={institutions.length} hint={`${trials} on trial`} />
        <StatCard icon={Users} label="Active students" value={totalStudents.toLocaleString()} hint="Across all centres" />
        <StatCard icon={Inbox} label="Open leads" value={unreadLeadsCount} hint={`${leads.length} total`} href="/admin/leads" tone={unreadLeadsCount ? "warning" : "default"} />
        <StatCard icon={UserX} label="Pending removals" value={pendingDeletions.length} hint="Restorable for 72 hours" tone={pendingDeletions.length ? "warning" : "default"} />
      </div>

      <Panel
        title="Centres"
        action={
          <div className="relative w-44 sm:w-60">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" className="h-8 pl-8 text-sm" aria-label="Search centres" />
          </div>
        }
      >
        {visible.length === 0 ? (
          <EmptyState icon={Building2} title={institutions.length ? "No match" : "No centres yet"} body={institutions.length ? "Try another name." : "Create the first centre and its headmaster account."} />
        ) : (
          <ul className="-my-2 divide-y divide-border">
            {visible.map((inst) => {
              const trialEnds = inst.trial_ends_at ? new Date(inst.trial_ends_at) : null;
              const trialExpired = trialEnds ? trialEnds.getTime() < Date.now() : false;
              return (
                <li key={inst.id} className="flex flex-col gap-3 py-3 md:flex-row md:items-center">
                  <Link href={`/admin/institutions/${inst.id}`} className="group flex min-w-0 flex-1 items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary font-bold text-primary">
                      {inst.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold group-hover:text-primary">{inst.name}</span>
                      <span className="block truncate font-mono text-xs text-muted-foreground">/join/{inst.subdomain}</span>
                    </span>
                  </Link>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="w-24 text-sm">
                      <strong>{studentCounts[inst.id] ?? 0}</strong> <span className="text-muted-foreground">students</span>
                    </span>
                    {inst.is_trial ? (
                      <Badge tone={trialExpired ? "danger" : "warning"}>
                        {trialExpired ? "Trial ended" : `Trial to ${trialEnds?.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) ?? "?"}`}
                      </Badge>
                    ) : null}
                    <Select
                      value={inst.subscription_tier}
                      onValueChange={(v) => handleSetTier(inst.id, v as "starter" | "growth" | "elite")}
                      disabled={tierChangingId === inst.id}
                    >
                      <SelectTrigger className="h-8 w-28" aria-label={`Plan for ${inst.name}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="starter">Starter</SelectItem>
                        <SelectItem value="growth">Growth</SelectItem>
                        <SelectItem value="elite">Elite</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" onClick={() => handleExtendTrial(inst.id)} disabled={extendingId === inst.id}>
                      {extendingId === inst.id ? "…" : inst.is_trial ? "+7 days" : "Start trial"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={`Delete ${inst.name}`}
                      onClick={() => {
                        setDeleteModalId(inst.id);
                        setConfirmTypedName("");
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {pendingDeletions.length > 0 ? (
        <Panel title="Removed accounts">
          <p className="mb-3 text-sm text-muted-foreground">Headmasters removed these people. You can restore them for 72 hours.</p>
          <ul className="-my-2 divide-y divide-border">
            {pendingDeletions.map((p) => {
              const recoverable = isRecoverable(p.deleted_at);
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      {p.full_name || p.email} <span className="text-xs font-normal capitalize text-muted-foreground">· {p.role}</span>
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {p.email} ·{" "}
                      {recoverable
                        ? `restorable until ${recoverableUntil(p.deleted_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
                        : "window closed"}
                    </p>
                  </div>
                  {recoverable ? (
                    <Button variant="outline" size="sm" disabled={restoringId === p.id} onClick={() => handleRestore(p.id)}>
                      <RotateCcw /> {restoringId === p.id ? "Restoring…" : "Restore"}
                    </Button>
                  ) : (
                    <Badge tone="danger">Expired</Badge>
                  )}
                </li>
              );
            })}
          </ul>
        </Panel>
      ) : null}

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleteModalId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleting?.name}?</DialogTitle>
            <DialogDescription>
              This deletes the centre, its cohorts, materials, quizzes, results and every staff and student account. It can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="confirm-name">Type the centre name to confirm</Label>
            <Input id="confirm-name" value={confirmTypedName} onChange={(e) => setConfirmTypedName(e.target.value)} placeholder={deleting?.name} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteModalId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!deleting || deletingId === deleting.id || confirmTypedName.trim() !== deleting.name}
              onClick={() => deleting && handleDelete(deleting)}
            >
              {deleting && deletingId === deleting.id ? "Deleting…" : "Delete forever"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!created} onOpenChange={(o) => !o && setCreated(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Centre created</DialogTitle>
            <DialogDescription>
              Send these sign-in details to the headmaster. The password isn&apos;t shown again; they can change it in Settings.
            </DialogDescription>
          </DialogHeader>
          {created ? (
            <div className="space-y-2 rounded-xl bg-muted/60 p-4 font-mono text-sm">
              <p>
                <span className="text-muted-foreground">Email </span>
                {created.email}
              </p>
              <p>
                <span className="text-muted-foreground">Password </span>
                {created.password}
              </p>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={async () => {
                if (!created) return;
                try {
                  await navigator.clipboard.writeText(
                    `Sign in to Neon at ${window.location.origin}/login\nEmail: ${created.email}\nPassword: ${created.password}`
                  );
                  toast.success("Copied.");
                } catch {
                  toast.error("Couldn't copy. Select the text instead.");
                }
              }}
            >
              <Copy /> Copy message
            </Button>
            <Button onClick={() => setCreated(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New centre</DialogTitle>
            <DialogDescription>
              Creates the centre and its headmaster account. You get the sign-in details to send them.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleProvision} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="inst-name">Institution name</Label>
              <Input
                id="inst-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Academy"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inst-subdomain">Join link name</Label>
              <Input
                id="inst-subdomain"
                value={subdomain}
                onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/\s/g, "-"))}
                placeholder="acme"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Tier</Label>
              <Select value={tier} onValueChange={(v) => setTier(v as typeof tier)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="growth">Growth</SelectItem>
                  <SelectItem value="elite">Elite</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <hr className="border-border" />
            <div className="space-y-2">
              <Label htmlFor="hm-email">Headmaster email</Label>
              <Input
                id="hm-email"
                type="email"
                value={headmasterEmail}
                onChange={(e) => setHeadmasterEmail(e.target.value)}
                placeholder="headmaster@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hm-password">Temporary password</Label>
              <Input
                id="hm-password"
                type="password"
                value={headmasterPassword}
                onChange={(e) => setHeadmasterPassword(e.target.value)}
                placeholder="Leave blank to auto-generate"
              />
              <p className="text-xs text-muted-foreground">
                If left blank, Neon will generate a strong temporary password.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hm-name">Headmaster full name (optional)</Label>
              <Input
                id="hm-name"
                value={headmasterFullName}
                onChange={(e) => setHeadmasterFullName(e.target.value)}
                placeholder="Jane Doe"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Creating…" : "Create centre"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
