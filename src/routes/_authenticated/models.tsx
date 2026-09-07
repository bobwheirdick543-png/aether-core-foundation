import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, PhaseNote, Panel } from "@/components/common/Primitives";

export const Route = createFileRoute("/_authenticated/models")({
  head: () => ({
    meta: [
      { title: "Models — Aether" },
      { name: "description", content: "Model roles available to your account." },
      { property: "og:title", content: "Models — Aether" },
      { property: "og:description", content: "Model roles available to your account." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <AppShell>
      <PageHeader title="Models" description="Model roles available to your account." />
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
