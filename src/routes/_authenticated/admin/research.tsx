import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/layout/AdminShell";
import { PageHeader, PhaseNote, Panel } from "@/components/common/Primitives";

export const Route = createFileRoute("/_authenticated/admin/research")({
  head: () => ({
    meta: [
      { title: "Research control — Aether" },
      { name: "description", content: "Oversight of all research runs." },
      { property: "og:title", content: "Research control — Aether" },
      { property: "og:description", content: "Oversight of all research runs." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <AdminShell>
      <PageHeader title="Research control" description="Oversight of all research runs." />
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
