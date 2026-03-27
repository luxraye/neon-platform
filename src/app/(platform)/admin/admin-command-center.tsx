"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { LogoutButton } from "@/components/auth/logout-button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { createBrowserSupabaseClient } from "@/utils/supabase/client";
import { calculateTieredMonthlyDue, getTierBaseFee, PER_STUDENT_FEE } from "@/lib/billing";

type InstitutionRow = {
  id: string;
  name: string;
  subdomain: string;
  subscription_tier: string;
  is_trial: boolean;
  trial_ends_at: string | null;
  created_at: string;
};

type FinancialReportRow = {
  id: string;
  institution_id: string;
  report_month: string;
  student_count: number;
  total_revenue_due: number;
  status: string;
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

export function AdminCommandCenter({
  institutions,
  studentCounts,
  financialReports,
  leads,
  initialTab = "institutions",
}: {
  institutions: InstitutionRow[];
  studentCounts: Record<string, number>;
  financialReports: FinancialReportRow[];
  leads: LeadRow[];
  initialTab?: "institutions" | "billing" | "leads";
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"institutions" | "billing" | "leads">(initialTab);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [name, setName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [tier, setTier] = useState<"starter" | "growth" | "elite">("starter");
  const [headmasterEmail, setHeadmasterEmail] = useState("");
  const [headmasterPassword, setHeadmasterPassword] = useState("");
  const [headmasterFullName, setHeadmasterFullName] = useState("");
  const [extendingId, setExtendingId] = useState<string | null>(null);
  const [tierChangingId, setTierChangingId] = useState<string | null>(null);
  const [convertingLeadId, setConvertingLeadId] = useState<string | null>(null);

  function openProvisionFromLead(lead: LeadRow) {
    setName(lead.institution_name?.trim() ?? "");
    setHeadmasterEmail(lead.email);
    setHeadmasterFullName(lead.name);
    setSubdomain(
      (lead.institution_name ?? "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "") || ""
    );
    setHeadmasterPassword("");
    setConvertingLeadId(lead.id);
    setTier("starter");
    setOpen(true);
  }

  function openProvisionManual() {
    setConvertingLeadId(null);
    setName("");
    setSubdomain("");
    setHeadmasterEmail("");
    setHeadmasterPassword("");
    setHeadmasterFullName("");
    setTier("starter");
    setOpen(true);
  }

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel("leads-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "leads" }, () => {
        router.refresh();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

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

  const handleSetTier = async (institutionId: string, tier: "starter" | "growth" | "elite") => {
    setTierChangingId(institutionId);
    const { setInstitutionTier } = await import("./actions");
    const result = await setInstitutionTier(institutionId, tier);
    setTierChangingId(null);
    if (result.success) {
      toast.success("Tier updated.");
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
      headmaster_password: headmasterPassword,
      headmaster_full_name: headmasterFullName || undefined,
      lead_id: convertingLeadId ?? undefined,
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
      setConvertingLeadId(null);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const handleGenerateReport = async () => {
    setReportLoading(true);
    const { generateMonthlyReport } = await import("./actions");
    const result = await generateMonthlyReport();
    setReportLoading(false);
    if (result.success) {
      toast.success("Monthly report generated.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const instByName: Record<string, string> = {};
  institutions.forEach((i) => (instByName[i.id] = i.name));

  return (
    <div className="min-h-screen p-6">
      <header className="flex items-center justify-between border-b pb-4 mb-6">
        <h1 className="text-2xl font-semibold">Admin Command Center</h1>
        <div className="flex items-center gap-2">
          <ThemeToggle className="w-auto" />
          <LogoutButton />
        </div>
      </header>

      <div className="flex gap-2 mb-4">
        <Button
          variant={tab === "institutions" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("institutions")}
        >
          Institutions
        </Button>
        <Button
          variant={tab === "billing" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("billing")}
        >
          Billing
        </Button>
        <Button
          variant={tab === "leads" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("leads")}
        >
          Leads
        </Button>
      </div>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setConvertingLeadId(null);
        }}
      >
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
                {loading ? "Provisioning…" : convertingLeadId ? "Provision from lead" : "Provision"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {tab === "institutions" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button type="button" onClick={openProvisionManual}>
              Provision New Center
            </Button>
          </div>

          <div className="rounded-lg border bg-card">
            <div className="p-4">
              <h2 className="text-lg font-medium">Institutions</h2>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Subdomain</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Trial</TableHead>
                  <TableHead>Trial ends</TableHead>
                  <TableHead className="w-48">Actions</TableHead>
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
                      <TableCell className="font-medium">{inst.name}</TableCell>
                      <TableCell>{inst.subdomain}</TableCell>
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
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleExtendTrial(inst.id)}
                            disabled={extendingId === inst.id}
                          >
                            {extendingId === inst.id ? "…" : "Extend trial"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {tab === "leads" && (
        <div className="space-y-4">
          <h2 className="text-lg font-medium">Leads (contact form inbox)</h2>
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Institution</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No leads yet. Submissions from the landing contact form will appear here.
                    </TableCell>
                  </TableRow>
                ) : (
                  leads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">{lead.name}</TableCell>
                      <TableCell>{lead.email}</TableCell>
                      <TableCell>{lead.institution_name ?? "—"}</TableCell>
                      <TableCell className="max-w-xs truncate">{lead.message ?? "—"}</TableCell>
                      <TableCell className="capitalize">{lead.status}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(lead.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={lead.status === "converted"}
                          onClick={() => openProvisionFromLead(lead)}
                        >
                          {lead.status === "converted" ? "Converted" : "Provision"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {tab === "billing" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Billing (Base tier + ${PER_STUDENT_FEE}/student)</h2>
            <Button onClick={handleGenerateReport} disabled={reportLoading}>
              {reportLoading ? "Generating…" : "Generate monthly report"}
            </Button>
          </div>
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Institution</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead>Base fee</TableHead>
                  <TableHead>Per student (${PER_STUDENT_FEE})</TableHead>
                  <TableHead>Total due</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {institutions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                      No institutions.
                    </TableCell>
                  </TableRow>
                ) : (
                  institutions.map((inst) => {
                    const students = studentCounts[inst.id] ?? 0;
                    const base = getTierBaseFee(inst.subscription_tier);
                    const total = calculateTieredMonthlyDue(students, inst.subscription_tier);
                    return (
                      <TableRow key={inst.id}>
                        <TableCell className="font-medium">{inst.name}</TableCell>
                        <TableCell className="capitalize">{inst.subscription_tier}</TableCell>
                        <TableCell>{students}</TableCell>
                        <TableCell>{base}</TableCell>
                        <TableCell>{students * PER_STUDENT_FEE}</TableCell>
                        <TableCell>{total}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <h2 className="text-lg font-medium">Recent reports</h2>
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Institution</TableHead>
                  <TableHead>Month</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead>Total due</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {financialReports.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                      No reports yet. Generate a monthly report.
                    </TableCell>
                  </TableRow>
                ) : (
                  financialReports.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{instByName[r.institution_id] ?? "—"}</TableCell>
                      <TableCell>{r.report_month}</TableCell>
                      <TableCell>{r.student_count}</TableCell>
                      <TableCell>{r.total_revenue_due.toFixed(2)}</TableCell>
                      <TableCell className="capitalize">{r.status}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}

