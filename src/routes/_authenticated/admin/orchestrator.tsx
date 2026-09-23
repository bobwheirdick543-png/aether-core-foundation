import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell } from "@/components/layout/AdminShell";
import { PageHeader, Panel, Tag, PhaseNote } from "@/components/common/Primitives";
import { getAdminOrchestrationPlans, getOrchestratorConfigHistory } from "@/lib/admin/console.functions";
import { activateOrchestratorConfig } from "@/lib/admin/orchestrator.functions";

export const Route = createFileRoute("/_authenticated/admin/orchestrator")({
  head: () => ({
    meta: [
      { title: "Orchestrator — Aether admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

function Page() {
  const queryClient = useQueryClient();
  const fetchHistory = useServerFn(getOrchestratorConfigHistory);
  const fetchPlans = useServerFn(getAdminOrchestrationPlans);
  const activate = useServerFn(activateOrchestratorConfig);

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ["admin-orchestrator-configs"],
    queryFn: () => fetchHistory({}),
  });
  const { data: plans = [] } = useQuery({
    queryKey: ["admin-orchestrator-plans"],
    queryFn: () => fetchPlans({}),
  });

  const configList = Array.isArray(configs) ? configs : Array.isArray((configs as any)?.configs) ? (configs as any).configs : Array.isArray((configs as any)?.data) ? (configs as any).data : [];
  const planList = Array.isArray(plans) ? plans : Array.isArray((plans as any)?.plans) ? (plans as any).plans : Array.isArray((plans as any)?.data) ? (plans as any).data : [];

  const activateMutation = useMutation({
    mutationFn: (configId: string) => activate({ data: { configId } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-orchestrator-configs"] }),
  });

  const activeConfig = configList.find((c) => c.status === "active") ?? null;

  return (
    <AdminShell>
      <div className="animate-in-up space-y-6">
        <PageHeader
          eyebrow="Orchestrator"
          title="Control center"
          description="Administrator-only orchestration policy, trace history and activation controls. Policy is defined in the repository; this surface only activates versioned configs and shows real traces."
          backFallback="/admin"
        />

        <PhaseNote>
          Raw JSON configuration editing has been removed. Orchestration policy lives in the codebase. Use
          Configuration history below only to activate an already-versioned config if needed.
        </PhaseNote>

        {activeConfig ? (
          <Panel className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold">Active policy</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  v{activeConfig.version} · {activeConfig.change_note || "No change note"} ·{" "}
                  {new Date(activeConfig.created_at).toLocaleString()}
                </p>
              </div>
              <Tag tone="success">ACTIVE</Tag>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Policy is read-only here. Changes are made in the repository and deployed with the app.
            </p>
          </Panel>
        ) : (
          <Panel>
            <p className="text-sm text-muted-foreground">
              No active orchestrator config is marked in the database. Repository defaults still apply at
              runtime.
            </p>
          </Panel>
        )}

        <Panel>
          <div>
            <h2 className="text-sm font-semibold">Orchestration trace</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Recent plans with persisted event counts. Opened plans retain task/run/step provenance.
            </p>
          </div>
          <div className="mt-4 space-y-2">
            {planList.length === 0 ? (
              <p className="text-xs text-muted-foreground">No orchestration plans recorded yet.</p>
            ) : (
              planList.map((plan) => (
                <div key={plan.id} className="rounded-md border border-border/60 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium">{plan.title}</p>
                      <p className="mt-1 text-[10px] font-mono text-muted-foreground">{plan.id}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Tag
                        tone={
                          plan.risk_level === "high" || plan.risk_level === "critical"
                            ? "warning"
                            : "neutral"
                        }
                      >
                        {plan.risk_level}
                      </Tag>
                      <Tag tone={plan.status === "completed" ? "success" : "neutral"}>{plan.status}</Tag>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
                    <span>Intent: {plan.intent}</span>
                    <span>Events: {plan.eventCount}</span>
                    <span>Approval: {plan.approval_status}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel>
          <div>
            <h2 className="text-sm font-semibold">Configuration history</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Versioned configs only. Activate an existing version if required — do not edit JSON here.
            </p>
          </div>
          <div className="mt-4 space-y-2">
            {isLoading ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : configList.length === 0 ? (
              <p className="text-xs text-muted-foreground">No config versions recorded yet.</p>
            ) : (
              configList.map((config) => (
                <div key={config.id} className="rounded-md border border-border/60 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">v{config.version}</span>
                      <Tag tone={config.status === "active" ? "success" : "neutral"}>{config.status}</Tag>
                    </div>
                    {config.status !== "active" && (
                      <button
                        type="button"
                        disabled={activateMutation.isPending}
                        onClick={() => void activateMutation.mutateAsync(config.id)}
                        className="rounded-md border border-admin/25 px-3 py-1.5 text-xs hover:bg-admin/10"
                      >
                        Activate
                      </button>
                    )}
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {config.change_note || "No change note"} ·{" "}
                    {new Date(config.created_at).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>
    </AdminShell>
  );
}
