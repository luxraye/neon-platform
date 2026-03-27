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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogoutButton } from "@/components/auth/logout-button";
import { ThemeToggle } from "@/components/theme/theme-toggle";

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
      toast.success(
        `Center provisioned. Send this temporary password to the headmaster: ${result.tempPassword}`,
        { duration: 10000 }
      );
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

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Command Center</h1>
          <p className="text-muted-foreground text-sm">Overview and institution management</p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle className="w-auto justify-start" />
          <LogoutButton />
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Institutions</CardTitle>
            <CardDescription>Active centers</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{institutions.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Total students</CardTitle>
            <CardDescription>Across all institutions</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{totalStudents}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Leads</CardTitle>
            <CardDescription>
              <Link href="/admin/leads" className="text-primary hover:underline">
                {unreadLeadsCount > 0 ? `${unreadLeadsCount} new` : "Inbox"}
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{leads.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-lg">Institutions</CardTitle>
            <CardDescription>View details, extend trial, or remove a center</CardDescription>
          </div>
          <Button type="button" onClick={openProvisionManual}>
            Provision New Center
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Subdomain</TableHead>
                <TableHead>Students</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Trial</TableHead>
                <TableHead>Trial ends</TableHead>
                <TableHead className="w-56">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {institutions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No institutions yet. Use &quot;Provision New Center&quot; to add one.
                  </TableCell>
                </TableRow>
              ) : (
                institutions.map((inst) => (
                  <TableRow key={inst.id}>
                    <TableCell className="font-medium">
                      <Link href={`/admin/institutions/${inst.id}`} className="text-primary hover:underline">
                        {inst.name}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground">{inst.subdomain}</TableCell>
                    <TableCell>{studentCounts[inst.id] ?? 0}</TableCell>
                    <TableCell>
                      <Select
                        value={inst.subscription_tier}
                        onValueChange={(v) => handleSetTier(inst.id, v as "starter" | "growth" | "elite")}
                        disabled={tierChangingId === inst.id}
                      >
                        <SelectTrigger className="w-24 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="starter">Starter</SelectItem>
                          <SelectItem value="growth">Growth</SelectItem>
                          <SelectItem value="elite">Elite</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {inst.is_trial ? (
                        <span className="text-amber-600 dark:text-amber-400">Trial</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {inst.trial_ends_at ? new Date(inst.trial_ends_at).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/admin/institutions/${inst.id}`}>View</Link>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExtendTrial(inst.id)}
                          disabled={extendingId === inst.id}
                        >
                          {extendingId === inst.id ? "…" : inst.is_trial ? "Extend trial" : "Start trial"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            setDeleteModalId(inst.id);
                            setConfirmTypedName("");
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                      {deleteModalId === inst.id && (
                        <div className="mt-2 flex flex-col gap-2 rounded border border-destructive/50 bg-destructive/5 p-2">
                          <p className="text-xs text-muted-foreground">
                            Type <strong>{inst.name}</strong> to confirm. This will remove the institution and unlink all
                            users. It cannot be undone.
                          </p>
                          <Input
                            className="h-8"
                            placeholder="Institution name"
                            value={confirmTypedName}
                            onChange={(e) => setConfirmTypedName(e.target.value)}
                          />
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={deletingId === inst.id || confirmTypedName.trim() !== inst.name}
                              onClick={() => handleDelete(inst)}
                            >
                              {deletingId === inst.id ? "Deleting…" : "Confirm delete"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setDeleteModalId(null);
                                setConfirmTypedName("");
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {pendingDeletions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pending deletions</CardTitle>
            <CardDescription>
              Accounts removed by headmasters. Restore within 72 hours to recover access.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Removed at</TableHead>
                  <TableHead>Recoverable until</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingDeletions.map((p) => {
                  const recoverable = isRecoverable(p.deleted_at);
                  const until = recoverableUntil(p.deleted_at);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.full_name ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{p.email}</TableCell>
                      <TableCell className="capitalize">{p.role}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(p.deleted_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {recoverable
                          ? until.toLocaleString()
                          : <span className="text-destructive">Expired</span>}
                      </TableCell>
                      <TableCell>
                        {recoverable ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={restoringId === p.id}
                            onClick={() => handleRestore(p.id)}
                          >
                            {restoringId === p.id ? "…" : "Restore"}
                          </Button>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Provision New Center</DialogTitle>
            <DialogDescription>
              Create a new institution and invite a headmaster. You will share the temporary password with them.
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
              <Label htmlFor="inst-subdomain">Subdomain</Label>
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
                {loading ? "Provisioning…" : "Provision"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
