"use client";

import { useState, useEffect } from "react";
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
import { Card, CardContent } from "@/components/ui/card";
import { createBrowserSupabaseClient } from "@/utils/supabase/client";

type LeadRow = {
  id: string;
  name: string;
  email: string;
  institution_name: string | null;
  message: string | null;
  status: string;
  created_at: string;
};

export function AdminLeadsContent({ leads: initialLeads }: { leads: LeadRow[] }) {
  const router = useRouter();
  const [leads, setLeads] = useState(initialLeads);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [tier, setTier] = useState<"starter" | "growth" | "elite">("starter");
  const [headmasterEmail, setHeadmasterEmail] = useState("");
  const [headmasterPassword, setHeadmasterPassword] = useState("");
  const [headmasterFullName, setHeadmasterFullName] = useState("");
  const [convertingLeadId, setConvertingLeadId] = useState<string | null>(null);
  const [deletingLeadId, setDeletingLeadId] = useState<string | null>(null);

  useEffect(() => {
    setLeads(initialLeads);
  }, [initialLeads]);

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

  const handleDeleteLead = async (leadId: string) => {
    setDeletingLeadId(leadId);
    const { deleteLead } = await import("../actions");
    const result = await deleteLead(leadId);
    setDeletingLeadId(null);
    if (result.success) {
      toast.success("Lead deleted.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const handleProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { provisionInstitution } = await import("../actions");
    const result = await provisionInstitution({
      name,
      subdomain,
      subscription_tier: tier,
      headmaster_email: headmasterEmail,
      headmaster_password: headmasterPassword || undefined,
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
      setConvertingLeadId(null);
      setName("");
      setSubdomain("");
      setHeadmasterEmail("");
      setHeadmasterPassword("");
      setHeadmasterFullName("");
      setTier("starter");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Institution</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-44">Actions</TableHead>
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
                      <div className="flex flex-wrap gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={lead.status === "converted"}
                          onClick={() => openProvisionFromLead(lead)}
                        >
                          {lead.status === "converted" ? "Converted" : "Provision"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          disabled={deletingLeadId === lead.id}
                          onClick={() => handleDeleteLead(lead.id)}
                        >
                          {deletingLeadId === lead.id ? "…" : "Delete"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setConvertingLeadId(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{convertingLeadId ? "Provision from lead" : "Provision New Center"}</DialogTitle>
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
    </>
  );
}
