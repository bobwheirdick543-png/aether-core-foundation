import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell } from "@/components/layout/AdminShell";
import { PageHeader, Panel } from "@/components/common/Primitives";
import { getAdminActivity } from "@/lib/admin/console.functions";

export const Route = createFileRoute("/_authenticated/admin/logs")({
  head: () => ({
    meta: [
      { title: "Logs — Aether" },
      { name: "description", content: "System and audit logs." },
      { property: "og:title", content: "Logs — Aether" },
      { property: "og:description", content: "System and audit logs." },
    ],
  }),
  component: Page,
});

function Page() {
  const fetchActivity = useServerFn(getAdminActivity);
  const { data, isLoading } = useQuery({ queryKey: ["admin-activity"], queryFn: () => fetchActivity({}) });

  return (
    <AdminShell>
      <div className="animate-in-up space-y-6">
        <PageHeader title="Logs" description="The recorded audit trail for this platform." />
        <Panel className="space-y-0 p-0">
          {isLoading ? (
            <p className="px-5 py-4 text-sm text-muted-foreground">Loading logs…</p>
          ) : (data?.length ?? 0) === 0 ? (
            <p className="px-5 py-4 text-sm text-muted-foreground">Nothing has been recorded yet.</p>
          ) : (
            data!.map((l, i) => (
              <div
                key={l.id}
                className={`flex items-start gap-3 px-5 py-3 text-xs ${
                  i < data!.length - 1 ? "border-b border-border/50" : ""
                }`}
              >
                <span className="shrink-0 font-mono text-muted-foreground">
                  {new Date(l.created_at).toLocaleString()}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="font-medium">{l.action}</span>
                  <p className="mt-0.5 truncate text-muted-foreground">
                    {l.target_type ?? "—"} {l.target_id ? `· ${l.target_id}` : ""}
                  </p>
                </div>
              </div>
            ))
          )}
        </Panel>
      </div>
    </AdminShell>
  );
}
