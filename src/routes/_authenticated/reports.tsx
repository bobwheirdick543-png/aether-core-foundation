import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, PhaseNote, Panel } from "@/components/common/Primitives";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports — Aether" },
      { name: "description", content: "Generated research and analysis reports." },
      { property: "og:title", content: "Reports — Aether" },
      { property: "og:description", content: "Generated research and analysis reports." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <AppShell>
      <PageHeader title="Reports" description="Generated research and analysis reports." />
      <div className="mt-6 space-y-4">
        <PhaseNote>Interface only — backend behaviour lands in a later phase.</PhaseNote>
        <Panel>
          <p className="text-sm text-muted-foreground">
            This surface is part of the Aether foundation build. Data and actions arrive with the
            matching platform phase.
          </p>
        </Panel>
      </div>
    </AppShell>
  );
}
