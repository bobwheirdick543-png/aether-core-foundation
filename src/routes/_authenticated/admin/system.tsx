import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell } from "@/components/layout/AdminShell";
import { PageHeader, Panel, Tag, StatCard } from "@/components/common/Primitives";
import { getPhaseUSystem } from "@/lib/admin/phase-u.functions";

export const Route = createFileRoute("/_authenticated/admin/system")({
  head: () => ({
    meta: [
      { title: "System — Aether" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

function Page() {
  const load = useServerFn(getPhaseUSystem);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["phase-u-system"],
    queryFn: async () => {
      try {
        return await load({});
      } catch (e) {
        console.error("[admin/system]", e);
        return null;
      }
    },
    refetchInterval: 10000,
    retry: 1,
  });
  const workers = Array.isArray(data?.workers) ? data.workers : [];
  const models = Array.isArray(data?.models) ? data.models : [];
  const agents = Array.isArray(data?.agents) ? data.agents : [];
  const quotas = Array.isArray(data?.quotas) ? data.quotas : [];

  return (
    <AdminShell>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Infrastructure"
          title="System"
          description="Workers, queues, AAX model availability, agent state and runtime quotas."
          backFallback="/admin"
        />
        {isError && (
          <Panel>
            <p className="text-sm text-destructive">System health could not be fully loaded.</p>
          </Panel>
        )}
        {isLoading ? (
          <Panel>
            <p className="text-sm text-muted-foreground">Checking system health…</p>
          </Panel>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label="Healthy workers" value={String(data?.healthyWorkers ?? 0)} />
              <StatCard label="Queue depth" value={String(data?.queueDepth ?? 0)} />
              <StatCard label="Running" value={String(data?.running ?? 0)} />
            </div>
            <Panel>
              <h2 className="text-sm font-semibold">Workers</h2>
              <div className="mt-3 space-y-2">
                {workers.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No worker heartbeats are currently registered. Task execution waits until a worker is online.
                  </p>
                ) : (
                  workers.map((w: any) => (
                    <div
                      key={w.worker_id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2 text-xs"
                    >
                      <span className="font-mono">{w.worker_id}</span>
                      <span className="text-muted-foreground">
                        capacity {w.capacity} · heartbeat{" "}
                        {w.last_heartbeat_at ? new Date(w.last_heartbeat_at).toLocaleString() : "—"}
                      </span>
                      <Tag
                        tone={
                          w.status === "offline"
                            ? "danger"
                            : w.status === "running"
                              ? "primary"
                              : "success"
                        }
                      >
                        {w.status}
                      </Tag>
                    </div>
                  ))
                )}
              </div>
            </Panel>
            <div className="grid gap-4 lg:grid-cols-2">
              <Panel>
                <h2 className="text-sm font-semibold">AAX model availability</h2>
                <div className="mt-3 space-y-2">
                  {models.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No models registered in the control plane.</p>
                  ) : (
                    models.map((m: any) => (
                      <div
                        key={m.model_key ?? m.role_key}
                        className="flex items-center justify-between rounded border px-3 py-2 text-xs"
                      >
                        <div>
                          <p className="font-medium">{m.display_name}</p>
                          <p className="font-mono text-[10px] text-muted-foreground">
                            {m.model_key ?? m.role_key} · {m.provider ?? "unconfigured"} /{" "}
                            {m.provider_model ?? "—"}
                          </p>
                        </div>
                        <Tag
                          tone={
                            m.status === "active" || m.status === "available" || m.release_status === "available"
                              ? "success"
                              : "neutral"
                          }
                        >
                          {m.release_status ?? m.status}
                        </Tag>
                      </div>
                    ))
                  )}
                </div>
              </Panel>
              <Panel>
                <h2 className="text-sm font-semibold">Agent status</h2>
                <div className="mt-3 space-y-2">
                  {agents.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No agents registered.</p>
                  ) : (
                    agents.map((a: any) => (
                      <div
                        key={a.agent_key}
                        className="flex items-center justify-between rounded border px-3 py-2 text-xs"
                      >
                        <span>{a.name}</span>
                        <Tag
                          tone={
                            a.status === "enabled"
                              ? "success"
                              : a.status === "maintenance"
                                ? "warning"
                                : "neutral"
                          }
                        >
                          {a.status}
                        </Tag>
                      </div>
                    ))
                  )}
                </div>
              </Panel>
            </div>
            <Panel>
              <h2 className="text-sm font-semibold">Runtime quotas</h2>
              <div className="mt-3 space-y-2">
                {quotas.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No quotas configured.</p>
                ) : (
                  quotas.map((q: any) => (
                    <div
                      key={`${q.scope_type}-${q.scope_id ?? "platform"}`}
                      className="grid gap-2 rounded border px-3 py-2 text-xs sm:grid-cols-4"
                    >
                      <span>{q.scope_type}</span>
                      <span>concurrent {q.max_concurrent}</span>
                      <span>queue {q.max_queue_depth}</span>
                      <span>runtime {Math.round(Number(q.max_runtime_ms) / 60000)} min</span>
                    </div>
                  ))
                )}
              </div>
            </Panel>
          </>
        )}
      </div>
    </AdminShell>
  );
}
