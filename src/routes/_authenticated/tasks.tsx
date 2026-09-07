import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, PhaseNote, Panel } from "@/components/common/Primitives";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({
    meta: [
      { title: "Tasks — Aether" },
      { name: "description", content: "Long-running background tasks." },
      { property: "og:title", content: "Tasks — Aether" },
      { property: "og:description", content: "Long-running background tasks." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <AppShell>
      <PageHeader title="Tasks" description="Long-running background tasks." />
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
