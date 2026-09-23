import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell } from "@/components/layout/AdminShell";
import { PageHeader, Panel, StatCard, Tag } from "@/components/common/Primitives";
import { getPhaseUUsage } from "@/lib/admin/phase-u.functions";

export const Route = createFileRoute("/_authenticated/admin/usage")({
  head: () => ({
    meta: [
      { title: "Usage — Aether" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

function Page() {
  const load = useServerFn(getPhaseUUsage);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["phase-u-usage"],
    queryFn: async () => {
      try {
        return await load({});
      } catch (e) {
        console.error("[admin/usage]", e);
        return null;
      }
    },
    refetchInterval: 30000,
    retry: 1,
  });

  const modelMetrics = Array.isArray(data?.modelMetrics) ? data.modelMetrics : Array.isArray((data as any)?.data?.modelMetrics) ? (data as any).data.modelMetrics : [];
  const agentMetrics = Array.isArray(data?.agentMetrics) ? data.agentMetrics : Array.isArray((data as any)?.data?.agentMetrics) ? (data as any).data.agentMetrics : [];

  return (
    <AdminShell>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Telemetry"
          title="Usage"
          description="Real request, latency, runtime and AAX model/agent telemetry. Empty data remains empty."
          backFallback="/admin"
        />
        {isError && (
          <Panel>
            <p className="text-sm text-destructive">Telemetry could not be fully loaded.</p>
          </Panel>
        )}
        {isLoading ? (
          <Panel>
            <p className="text-sm text-muted-foreground">Loading telemetry…</p>
          </Panel>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="API requests" value={String(data?.requests ?? 0)} />
              <StatCard
                label="API errors"
                value={String(data?.errors ?? 0)}
                hint={`${data?.errorRate ?? 0}% error rate`}
              />
              <StatCard label="Avg API latency" value={`${data?.avgLatencyMs ?? 0} ms`} />
              <StatCard
                label="Task runs"
                value={String(data?.runs ?? 0)}
                hint={`${data?.completedRuns ?? 0} completed`}
              />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Panel>
                <h2 className="text-sm font-semibold">AAX model telemetry</h2>
                <div className="mt-3 space-y-2">
                  {modelMetrics.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No model telemetry recorded.</p>
                  ) : (
                    modelMetrics.slice(0, 30).map((m: any, i: number) => (
                      <div
                        key={`${m.model_role ?? m.model_key ?? i}-${i}`}
                        className="flex items-center justify-between rounded border px-3 py-2 text-xs"
                      >
                        <span className="font-medium">
                          {m.display_name ?? m.model_key ?? m.model_role ?? "AAX"}
                        </span>
                        <span className="text-muted-foreground">
                          {m.request_count} requests · {m.productivity_percent}% productivity
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </Panel>
              <Panel>
                <h2 className="text-sm font-semibold">Agent telemetry</h2>
                <div className="mt-3 space-y-2">
                  {agentMetrics.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No agent telemetry recorded.</p>
                  ) : (
                    agentMetrics.slice(0, 30).map((m: any, i: number) => (
                      <div
                        key={`${m.agent_key}-${i}`}
                        className="flex items-center justify-between rounded border px-3 py-2 text-xs"
                      >
                        <span className="font-medium">{m.agent_key}</span>
                        <Tag tone="neutral">{m.productivity_percent}%</Tag>
                      </div>
                    ))
                  )}
                </div>
              </Panel>
            </div>
          </>
        )}
      </div>
    </AdminShell>
  );
}
