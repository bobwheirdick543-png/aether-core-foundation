import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/layout/AdminShell";
import { PageHeader, PhaseNote, Panel } from "@/components/common/Primitives";

export const Route = createFileRoute("/_authenticated/admin/usage")({
  head: () => ({
    meta: [
      { title: "Usage — Aether" },
      { name: "description", content: "Requests, tokens and cost metering." },
      { property: "og:title", content: "Usage — Aether" },
      { property: "og:description", content: "Requests, tokens and cost metering." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <AdminShell>
      <PageHeader title="Usage" description="Requests, tokens and cost metering." />
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
