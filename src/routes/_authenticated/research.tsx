import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, PhaseNote, Panel } from "@/components/common/Primitives";

export const Route = createFileRoute("/_authenticated/research")({
  head: () => ({
    meta: [
      { title: "Research — Aether" },
      { name: "description", content: "Web research runs and their sources." },
      { property: "og:title", content: "Research — Aether" },
      { property: "og:description", content: "Web research runs and their sources." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <AppShell>
      <PageHeader title="Research" description="Web research runs and their sources." />
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
