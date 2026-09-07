import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, PhaseNote, Panel } from "@/components/common/Primitives";

export const Route = createFileRoute("/_authenticated/knowledge")({
  head: () => ({
    meta: [
      { title: "Knowledge — Aether" },
      { name: "description", content: "Collections, entries and approval stages." },
      { property: "og:title", content: "Knowledge — Aether" },
      { property: "og:description", content: "Collections, entries and approval stages." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <AppShell>
      <PageHeader title="Knowledge" description="Collections, entries and approval stages." />
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
