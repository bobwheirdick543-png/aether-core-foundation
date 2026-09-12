import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell } from "@/components/layout/AdminShell";
import { PageHeader, Panel, Tag } from "@/components/common/Primitives";
import { getPhaseUResearch } from "@/lib/admin/phase-u.functions";

export const Route = createFileRoute("/_authenticated/admin/research")({
  head: () => ({
    meta: [
      { title: "Research control — Aether" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

function Page() {
  const load = useServerFn(getPhaseUResearch);
  const { data = [], isLoading, isError } = useQuery({
    queryKey: ["phase-u-research"],
    queryFn: async () => {
      try {
        return await load({});
      } catch (e) {
        console.error("[admin/research]", e);
        return [];
      }
    },
    refetchInterval: 15000,
    retry: 1,
  });

  return (
    <AdminShell>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Research governance"
          title="Research control"
          description="Durable research sessions, sources, verification state and failures."
          backFallback="/admin"
        />
        <Panel>
          <p className="text-xs text-muted-foreground">
            Research remains candidate material until verification and approval. This console exposes
            persisted runtime state only — no fabricated sources or claims.
          </p>
        </Panel>
        {isError && (
          <Panel>
            <p className="text-sm text-destructive">Some research data could not be loaded.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              The page remains usable. Check backend tables and permissions if this persists.
            </p>
          </Panel>
        )}
        {isLoading ? (
          <Panel>
            <p className="text-sm text-muted-foreground">Loading research runs…</p>
          </Panel>
        ) : (
          <Panel className="space-y-0 p-0">
            {data.length === 0 ? (
              <p className="px-5 py-5 text-sm text-muted-foreground">No research sessions recorded.</p>
            ) : (
              data.map((r: any, i: number) => (
                <div
                  key={r.id}
                  className={`px-5 py-4 ${i < data.length - 1 ? "border-b border-border/50" : ""}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.query}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        owner {r.owner_id} · {r.source_count ?? 0} sources ·{" "}
                        {new Date(r.created_at).toLocaleString()}
                      </p>
                    </div>
                    <Tag
                      tone={
                        r.status === "completed"
                          ? "success"
                          : r.status === "failed"
                            ? "danger"
                            : r.status === "running"
                              ? "primary"
                              : "neutral"
                      }
                    >
                      {r.status}
                    </Tag>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Task {r.task_id ?? "—"} · Run {r.run_id ?? "—"} · diversity {r.diversity_score ?? "—"}
                  </div>
                </div>
              ))
            )}
          </Panel>
        )}
      </div>
    </AdminShell>
  );
}
