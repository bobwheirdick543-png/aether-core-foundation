import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/layout/AdminShell";
import { PageHeader, Panel } from "@/components/common/Primitives";

export const Route = createFileRoute("/_authenticated/admin/projects")({
  head: () => ({
    meta: [
      { title: "Projects — Aether" },
      { name: "description", content: "All projects and modules." },
      { property: "og:title", content: "Projects — Aether" },
      { property: "og:description", content: "All projects and modules." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <AdminShell>
      <PageHeader title="Projects" description="All projects and modules." />
      <div className="mt-6 space-y-4">
        <Panel>
          <p className="text-sm text-muted-foreground">
            Project administration uses the same server-authorized project, ownership and module boundaries as the user workspace. This overview does not fabricate project activity; live project data appears when authorized records exist.
          </p>
        </Panel>
      </div>
    </AdminShell>
  );
}
