import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/layout/AdminShell";
import { PageHeader, Panel } from "@/components/common/Primitives";

export const Route = createFileRoute("/_authenticated/admin/model-routing")({
  head: () => ({ meta: [{ title: "Model routing — Aether" }, { name: "robots", content: "noindex" }] }),
  component: Page,
});

function Page() {
  return (
    <AdminShell>
      <div className="space-y-6">
        <PageHeader
          eyebrow="AAX"
          title="Model routing"
          description="Legacy product-role routing controls have been retired. Aether Ascension remains the model orchestration path."
          backFallback="/admin/models"
        />
        <Panel>
          <p className="text-sm text-muted-foreground">
            The retired Aether product-role controls are no longer exposed here. Use Aether Ascension for model orchestration.
          </p>
        </Panel>
      </div>
    </AdminShell>
  );
}
