"use client";

import { useState } from "react";
import { CircleHelp } from "lucide-react";
import { toast } from "sonner";
import { FEEDBACK_AREAS } from "@/lib/feedback";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedbackType, setFeedbackType] = useState<"challenge" | "recommendation">("challenge");
  const [area, setArea] = useState("navigation");
  const [severity, setSeverity] = useState<"low" | "medium" | "high">("medium");
  const [summary, setSummary] = useState("");
  const [details, setDetails] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);

  const resetForm = () => {
    setFeedbackType("challenge");
    setArea("navigation");
    setSeverity("medium");
    setSummary("");
    setDetails("");
    setScreenshot(null);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const data = new FormData();
    data.set("feedback_type", feedbackType);
    data.set("area", area);
    data.set("severity", severity);
    data.set("summary", summary);
    data.set("details", details);
    if (screenshot) data.set("screenshot", screenshot);
    const { submitUserFeedback } = await import("@/app/dashboard/feedback/actions");
    const result = await submitUserFeedback(data);
    setSubmitting(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Thank you. Your feedback has been recorded.");
    resetForm();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="icon"
          className="fixed bottom-5 right-5 z-40 h-11 w-11 rounded-full shadow-lg"
          aria-label="Open feedback form"
        >
          <CircleHelp className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Challenges and recommendations</DialogTitle>
          <DialogDescription>
            Tell us what is not working well or what should be improved. Select an area to reduce typing.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="feedback-type">Type</Label>
              <select
                id="feedback-type"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={feedbackType}
                onChange={(e) => setFeedbackType(e.target.value as "challenge" | "recommendation")}
              >
                <option value="challenge">Challenge</option>
                <option value="recommendation">Recommendation</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="feedback-severity">Severity</Label>
              <select
                id="feedback-severity"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={severity}
                onChange={(e) => setSeverity(e.target.value as "low" | "medium" | "high")}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="feedback-area">What is this about?</Label>
            <select
              id="feedback-area"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={area}
              onChange={(e) => setArea(e.target.value)}
            >
              {FEEDBACK_AREAS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="feedback-summary">Quick summary</Label>
            <Input
              id="feedback-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Short description of the issue or idea"
              minLength={8}
              maxLength={240}
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="feedback-details">More details (optional)</Label>
            <textarea
              id="feedback-details"
              className="min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Optional details"
              maxLength={3000}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="feedback-screenshot">Screenshot (optional, PNG/JPG/WEBP, max 5MB)</Label>
            <Input
              id="feedback-screenshot"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => setScreenshot(e.target.files?.[0] ?? null)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
