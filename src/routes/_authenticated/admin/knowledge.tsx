import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/layout/AdminShell";
import { PageHeader, PhaseNote, Panel } from "@/components/common/Primitives";

export const Route = createFileRoute("/_authenticated/admin/knowledge")({
  head: () => ({
    meta: [
      { title: "Knowledge control — Aether" },
      { name: "description", content: "Approve or reject knowledge entries." },
      { property: "og:title", content: "Knowledge control — Aether" },
      { property: "og:description", content: "Approve or reject knowledge entries." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <AdminShell>
      <PageHeader title="Knowledge control" description="Approve or reject knowledge entries." />
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
