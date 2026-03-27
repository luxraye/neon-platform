"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function InstitutionDetailClient({
  institutionId,
  institutionName,
  subscriptionTier,
  isTrial,
  trialEndsAt,
}: {
  institutionId: string;
  institutionName: string;
  subscriptionTier: string;
  isTrial: boolean;
  trialEndsAt: string | null;
}) {
  const router = useRouter();
  const [tierChanging, setTierChanging] = useState(false);
  const [extending, setExtending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [confirmName, setConfirmName] = useState("");

  const handleSetTier = async (tier: "starter" | "growth" | "elite") => {
    setTierChanging(true);
    const { setInstitutionTier } = await import("../../actions");
    const result = await setInstitutionTier(institutionId, tier);
    setTierChanging(false);
    if (result.success) {
      toast.success("Tier updated.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const handleExtendTrial = async () => {
    setExtending(true);
    const { extendTrial } = await import("../../actions");
    const result = await extendTrial(institutionId);
    setExtending(false);
    if (result.success) {
      toast.success("Trial extended by 7 days.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const handleDelete = async () => {
    if (confirmName.trim() !== institutionName) {
      toast.error(`Type "${institutionName}" to confirm.`);
      return;
    }
    setDeleting(true);
    const { deleteInstitution } = await import("../../actions");
    const result = await deleteInstitution(institutionId);
    setDeleting(false);
    if (result.success) {
      toast.success("Institution deleted.");
      router.replace("/admin");
    } else {
      toast.error(result.error);
    }
  };

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="text-base">Admin actions</CardTitle>
        <CardDescription>Tier, trial, and danger zone</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Tier:</span>
            <Select
              value={subscriptionTier}
              onValueChange={(v) => handleSetTier(v as "starter" | "growth" | "elite")}
              disabled={tierChanging}
            >
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="starter">Starter</SelectItem>
                <SelectItem value="growth">Growth</SelectItem>
                <SelectItem value="elite">Elite</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={handleExtendTrial} disabled={extending}>
            {extending ? "…" : isTrial ? "Extend trial by 7 days" : "Start trial"}
          </Button>
        </div>

        <div className="border-t pt-4">
          <p className="text-sm font-medium text-destructive mb-2">Danger zone</p>
          {!showDeleteConfirm ? (
            <Button variant="outline" size="sm" className="text-destructive" onClick={() => setShowDeleteConfirm(true)}>
              Delete institution
            </Button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Type <strong>{institutionName}</strong> to confirm. This will remove the institution and unlink all
                users.
              </p>
              <Input
                placeholder="Institution name"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                className="max-w-xs"
              />
              <div className="flex gap-2">
                <Button variant="destructive" size="sm" disabled={deleting} onClick={handleDelete}>
                  {deleting ? "Deleting…" : "Confirm delete"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setShowDeleteConfirm(false); setConfirmName(""); }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
