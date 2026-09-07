import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/layout/AdminShell";
import { PageHeader, PhaseNote, Panel } from "@/components/common/Primitives";

export const Route = createFileRoute("/_authenticated/admin/models")({
  head: () => ({
    meta: [
      { title: "AI models — Aether" },
      { name: "description", content: "Provider configuration and routing rules." },
      { property: "og:title", content: "AI models — Aether" },
      { property: "og:description", content: "Provider configuration and routing rules." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <AdminShell>
      <PageHeader title="AI models" description="Provider configuration and routing rules." />
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
