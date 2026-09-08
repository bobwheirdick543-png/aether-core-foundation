import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell } from "@/components/layout/AdminShell";
import { PageHeader, StatCard, Panel, Tag } from "@/components/common/Primitives";
import { getAdminOverview } from "@/lib/admin/console.functions";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Admin — Aether" },
      { name: "description", content: "Aether platform control center." },
      { property: "og:title", content: "Admin — Aether" },
      { property: "og:description", content: "Aether platform control center." },
    ],
  }),
  component: Page,
});

function Page() {
  const fetchOverview = useServerFn(getAdminOverview);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => fetchOverview({}),
  });

  const c = data?.counts;
  const stats = [
    { label: "Accounts", value: c?.users, hint: `${c?.admins ?? 0} administrator(s)` } as const,
    { label: "Projects", value: c?.projects },
    { label: "Conversations", value: c?.conversations },
    { label: "Tasks", value: c?.tasks, hint: `${c?.activeTasks ?? 0} active` },
    { label: "Execution runs", value: c?.runs },
    { label: "Research runs", value: c?.research },
    { label: "Knowledge entries", value: c?.knowledge, hint: `${c?.approvedKnowledge ?? 0} in production` },
    { label: "Reports", value: c?.reports },
  ];

  return (
    <AdminShell>
      <div className="animate-in-up space-y-6">
        <PageHeader
          eyebrow="Control plane"
          title="Overview"
          description="Live platform counters read directly from the database."
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <StatCard
              key={s.label}
              label={s.label}
              value={isLoading ? "—" : String(s.value ?? 0)}
              {...(!isLoading && s.hint ? { hint: s.hint } : {})}
            />
          ))}
        </div>

        <section>
          <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Recent activity
          </h2>
          <Panel className="space-y-0 p-0">
            {isLoading ? (
              <p className="px-5 py-4 text-sm text-muted-foreground">Loading activity…</p>
            ) : (data?.audit?.length ?? 0) === 0 ? (
              <p className="px-5 py-4 text-sm text-muted-foreground">
                No activity has been recorded yet.
              </p>
            ) : (
              data!.audit.map((l, i) => (
                <div
                  key={l.id}
                  className={`flex items-start gap-3 px-5 py-3 text-xs ${
                    i < data!.audit.length - 1 ? "border-b border-border/50" : ""
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
                  <Tag tone="neutral">audit</Tag>
                </div>
              ))
            )}
          </Panel>
        </section>
      </div>
    </AdminShell>
  );
}
