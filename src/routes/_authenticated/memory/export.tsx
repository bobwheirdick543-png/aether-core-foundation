import { createFileRoute } from "@tanstack/react-router";
import { Download, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, Panel } from "@/components/common/Primitives";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/memory/export")({
  head: () => ({ meta: [{ title: "Export Memory — Aether" }] }),
  component: Page,
});

function Page() {
  return <AppShell><PageHeader title="Export memory" description="Download a complete, authenticated JSON copy of your Aether memory records, candidates and provenance events." /><div className="mt-6 max-w-2xl"><Panel><div className="flex items-start gap-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40 text-primary"><ShieldCheck className="h-5 w-5" /></div><div><h2 className="text-sm font-semibold">Private memory export</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">The export is generated on the server for your authenticated account. It includes active and historical memory records, learning candidates and the provenance events associated with them.</p><div className="mt-4"><Button asChild><a href="/api/aax/memory/export"><Download className="mr-2 h-4 w-4" />Download JSON export</a></Button></div></div></div></Panel></div></AppShell>;
}
