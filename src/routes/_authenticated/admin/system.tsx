import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/layout/AdminShell";
import { PageHeader, PhaseNote, Panel } from "@/components/common/Primitives";

export const Route = createFileRoute("/_authenticated/admin/system")({
  head: () => ({
    meta: [
      { title: "System — Aether" },
      { name: "description", content: "Runtime status and configuration." },
      { property: "og:title", content: "System — Aether" },
      { property: "og:description", content: "Runtime status and configuration." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <AdminShell>
      <PageHeader title="System" description="Runtime status and configuration." />
      <div className="mt-6 space-y-4">
        <PhaseNote>Admin interface only — controls activate with the matching platform phase.</PhaseNote>
        <Panel>
          <p className="text-sm text-muted-foreground">
            This surface is part of the Aether foundation build. Data and actions arrive with the
            matching platform phase.
          </p>
        </Panel>
      </div>
    </AdminShell>
  );
}
