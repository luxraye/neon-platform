import { SparklesIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function SettingsComingSoonCard() {
  return (
    <Card className="max-w-md border-primary/20 bg-gradient-to-br from-primary/5 via-background to-muted/30 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2 text-primary">
          <SparklesIcon className="size-5 shrink-0" aria-hidden />
          <CardTitle className="text-base font-semibold tracking-tight">More soon</CardTitle>
        </div>
        <CardDescription className="text-sm leading-relaxed">
          Further account and personalization features are on the way. Thanks for your patience.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-xs text-muted-foreground border-t border-border/60 pt-3">
          Institution settings and branding (where available) remain on this page.
        </p>
      </CardContent>
    </Card>
  );
}
