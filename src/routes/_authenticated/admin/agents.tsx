import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  Ban,
  CheckCircle2,
  MessageSquare,
  Play,
  Power,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  TestTube2,
  Users,
  Wrench,
} from "lucide-react";
import { AdminShell } from "@/components/layout/AdminShell";
import { PageHeader, PhaseNote, StatusDot, Tag } from "@/components/common/Primitives";
import { Button } from "@/components/ui/button";
import {
  activateAgent,
  getAgentControlPlane,
  rollbackAgentVersion,
  setAgentOperationalState,
  testAgentVersion,
  validateAgentVersion,
} from "@/lib/aether/agent.functions";

export const Route = createFileRoute("/_authenticated/admin/agents")({
  head: () => ({
    meta: [
      { title: "AI agents — Aether" },
      {
        name: "description",
        content: "Operational control, runtime visibility and ecosystem flow for every Aether agent.",
      },
    ],
  }),
  component: Page,
});

const FLOW_NODES = [
  ["User / Task", "Requests enter the Aether runtime."],
  ["Cognitive Orchestrator", "Plans, authorizes and delegates work."],
  ["Specialized Agents", "Research, verification, knowledge, reports, security and modules execute inside their boundaries."],
  ["Durable Runtime", "Queues, workers, retries, leases and recovery keep work alive beyond the browser."],
  ["Evidence / Outputs", "Knowledge, reports, notifications and audited results return through governed paths."],
] as const;

function lifecycleLabel(status: string) {
  if (status === "enabled") return "ACTIVE";
  if (status === "maintenance") return "MAINTENANCE";
  return "DISABLED";
}

function statusTone(status: string): "success" | "warning" | "neutral" {
  if (status === "enabled") return "success";
  if (status === "maintenance") return "warning";
  return "neutral";
}

function Page() {
  const queryClient = useQueryClient();
  const fetchPlane = useServerFn(getAgentControlPlane);
  const activate = useServerFn(activateAgent);
  const setState = useServerFn(setAgentOperationalState);
  const validate = useServerFn(validateAgentVersion);
  const test = useServerFn(testAgentVersion);
  const rollback = useServerFn(rollbackAgentVersion);

  const { data, isLoading, error } = useQuery({
    queryKey: ["agent-control-plane"],
    queryFn: () => fetchPlane({}),
    refetchInterval: 10_000,
  });

  const mutation = useMutation({
    mutationFn: async (job: () => Promise<unknown>) => job(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["agent-control-plane"] });
    },
  });

  const agents = data?.agents ?? [];
  const versions = data?.versions ?? [];
  const permissions = data?.permissions ?? [];
  const runtime = data?.runtime ?? { workers: [], runs: [], handoffs: [], messages: [] };
  const activeAgents = agents.filter((agent: any) => agent.status === "enabled").length;
  const healthyWorkers = runtime.workers.filter(
    (worker: any) =>
      worker.status !== "offline" &&
      worker.last_heartbeat_at &&
      Date.now() - new Date(worker.last_heartbeat_at).getTime() < 120_000,
  ).length;
  const runningRuns = runtime.runs.filter((run: any) => run.status === "running").length;
  const queuedRuns = runtime.runs.filter((run: any) =>
    ["queued", "retrying", "scheduled"].includes(run.status),
  ).length;

  return (
    <AdminShell>
      <div className="animate-in-up space-y-6">
        <PageHeader
          eyebrow="Control plane / Agent ecosystem"
          title="AI Agents"
          description="Operational control for every Aether agent. Activation is one click; the runtime keeps the agent available until you explicitly choose Maintenance or Disable."
          backFallback="/admin"
        />

        <PhaseNote>
          Activation no longer asks for code, JSON or a version number. Aether performs the existing validation
          and test safety gates on the server, persists the lifecycle state, and keeps the agent active until an
          administrator changes its operational state. Browser lifetime does not control agent availability.
        </PhaseNote>

        <section className="panel overflow-hidden">
          <div className="border-b border-border/60 px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Live ecosystem</p>
                <h2 className="mt-1 text-sm font-semibold">How the AI workforce operates</h2>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px]">
                <Tag tone="success">{activeAgents} active</Tag>
                <Tag tone={runningRuns ? "primary" : "neutral"}>{runningRuns} running</Tag>
                <Tag tone={queuedRuns ? "warning" : "neutral"}>{queuedRuns} queued</Tag>
                <Tag tone={healthyWorkers ? "success" : "neutral"}>{healthyWorkers} healthy workers</Tag>
              </div>
            </div>
          </div>

          <div className="grid gap-3 p-5 md:grid-cols-5">
            {FLOW_NODES.map(([title, description], index) => (
              <div key={title} className="flex items-center gap-3 md:block">
                <div className="flex min-w-0 flex-1 items-center gap-3 md:block">
                  <div className="rounded-lg border border-primary/25 bg-primary/5 p-3">
                    <p className="text-xs font-semibold">{title}</p>
                    <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{description}</p>
                  </div>
                </div>
                {index < FLOW_NODES.length - 1 ? (
                  <>
                    <ArrowRight className="hidden h-4 w-4 shrink-0 text-primary/60 md:mx-auto md:my-2 md:block" />
                    <ArrowDown className="h-4 w-4 shrink-0 text-primary/60 md:hidden" />
                  </>
                ) : null}
              </div>
            ))}
          </div>

          <div className="grid gap-2 border-t border-border/60 bg-muted/20 px-5 py-4 text-[11px] text-muted-foreground sm:grid-cols-4">
            <span>Agents: {agents.length}</span>
            <span>Runtime runs observed: {runtime.runs.length}</span>
            <span>Handoffs observed: {runtime.handoffs.length}</span>
            <span>Messages observed: {runtime.messages.length}</span>
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
          <Link
            to="/admin/team"
            className="inline-flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/15"
          >
            <Users className="h-3.5 w-3.5" />
            Open Team workstations
          </Link>
          <Link
            to="/admin/operations"
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted"
          >
            <Activity className="h-3.5 w-3.5" />
            Open runtime operations
          </Link>
          <Button
            size="sm"
            variant="outline"
            disabled={isLoading}
            onClick={() => void queryClient.invalidateQueries({ queryKey: ["agent-control-plane"] })}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>

        {mutation.error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3">
            <p className="text-xs font-medium text-destructive">Agent operation failed</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {mutation.error instanceof Error ? mutation.error.message : "The server rejected the requested operation."}
            </p>
          </div>
        ) : null}

        {isLoading ? (
          <div className="panel p-5">
            <p className="text-sm text-muted-foreground">Loading the Agent Runtime control plane…</p>
          </div>
        ) : error ? (
          <div className="panel p-5">
            <p className="text-sm text-destructive">Could not load the Agent Runtime control plane.</p>
            <p className="mt-2 text-xs text-muted-foreground">
              The page will retry automatically when the backend is available.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {agents.map((agent: any) => {
              const agentVersions = versions.filter((version: any) => version.agent_id === agent.id);
              const latest =
                agentVersions.find((version: any) => version.lifecycle_state === "active") ??
                agentVersions[0];
              const activeVersion = agentVersions.find((version: any) => version.lifecycle_state === "active");
              const agentPermissions = permissions.filter((permission: any) => permission.agent_id === agent.id);
              const agentRuns = runtime.runs.filter(
                (run: any) => run.agent_id === agent.id || run.agent_key === agent.agent_key,
              );
              const currentRuns = agentRuns.filter((run: any) => run.status === "running");
              const queued = agentRuns.filter((run: any) =>
                ["queued", "retrying", "scheduled"].includes(run.status),
              );
              const completed = agentRuns.filter((run: any) => run.status === "completed").length;
              const failed = agentRuns.filter((run: any) => run.status === "failed").length;
              const agentHandoffs = runtime.handoffs.filter(
                (handoff: any) =>
                  handoff.from_agent === agent.agent_key || handoff.to_agent === agent.agent_key,
              );
              const workerIds = new Set(
                agentRuns.filter((run: any) => run.worker_id).map((run: any) => run.worker_id),
              );
              const hasHealthyWorker = runtime.workers.some(
                (worker: any) =>
                  workerIds.has(worker.worker_id) &&
                  worker.status !== "offline" &&
                  worker.last_heartbeat_at &&
                  Date.now() - new Date(worker.last_heartbeat_at).getTime() < 120_000,
              );
              const canMaintain = agent.status === "enabled";
              const canDisable = agent.status === "enabled" || agent.status === "maintenance";
              const canActivate = agent.status !== "enabled";
              const latestVersionId = latest?.id;

              return (
                <article key={agent.id} className="panel overflow-hidden">
                  <div className="border-b border-border/60 px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold">{agent.name}</h3>
                          <Tag tone={statusTone(agent.status)}>{lifecycleLabel(agent.status)}</Tag>
                          {agent.status === "enabled" ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[9px] text-primary">
                              <CheckCircle2 className="h-3 w-3" />
                              24/7 availability
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{agent.purpose}</p>
                      </div>
                      <StatusDot
                        status={
                          agent.status === "enabled"
                            ? "online"
                            : agent.status === "maintenance"
                              ? "maintenance"
                              : "offline"
                        }
                        label={agent.status}
                      />
                    </div>
                  </div>

                  <div className="space-y-4 px-5 py-4">
                    <div className="grid gap-2 sm:grid-cols-4">
                      <div className="rounded-md border bg-muted/20 p-2.5">
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Running</p>
                        <p className="mt-1 text-sm font-semibold">{currentRuns.length}</p>
                      </div>
                      <div className="rounded-md border bg-muted/20 p-2.5">
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Queued</p>
                        <p className="mt-1 text-sm font-semibold">{queued.length}</p>
                      </div>
                      <div className="rounded-md border bg-muted/20 p-2.5">
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Completed</p>
                        <p className="mt-1 text-sm font-semibold">{completed}</p>
                      </div>
                      <div className="rounded-md border bg-muted/20 p-2.5">
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Failed</p>
                        <p className="mt-1 text-sm font-semibold">{failed}</p>
                      </div>
                    </div>

                    <div className="grid gap-2 text-[11px] text-muted-foreground sm:grid-cols-3">
                      <span>Version {activeVersion?.version ?? latest?.version ?? "—"}</span>
                      <span>{agentPermissions.length} permissions</span>
                      <span>{agentHandoffs.length} handoffs</span>
                    </div>

                    <div>
                      <p className="mb-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Tools</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(agent.tools ?? []).map((tool: string) => (
                          <span
                            key={tool}
                            className="rounded-md border bg-elevated/50 px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
                          >
                            {tool}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-md border border-primary/15 bg-primary/5 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Runtime connection</p>
                        <span className="text-[10px] text-muted-foreground">
                          {hasHealthyWorker ? "Worker healthy" : currentRuns.length ? "Worker state unavailable" : "Idle / waiting for work"}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
                        <span className="rounded border px-2 py-1">Orchestrator</span>
                        <ArrowRight className="h-3 w-3 text-primary/60" />
                        <span className="rounded border px-2 py-1">{agent.name}</span>
                        <ArrowRight className="h-3 w-3 text-primary/60" />
                        <span className="rounded border px-2 py-1">Queue</span>
                        <ArrowRight className="h-3 w-3 text-primary/60" />
                        <span className="rounded border px-2 py-1">Worker</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        disabled={mutation.isPending || !canActivate}
                        onClick={() =>
                          mutation.mutate(() =>
                            activate({ data: { agentKey: agent.agent_key } }),
                          )
                        }
                      >
                        <Power className="mr-1.5 h-3.5 w-3.5" />
                        {agent.status === "maintenance" ? "Resume / Activate" : "Activate"}
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        disabled={mutation.isPending || !canMaintain}
                        onClick={() =>
                          mutation.mutate(() =>
                            setState({ data: { agentKey: agent.agent_key, state: "maintenance" } }),
                          )
                        }
                      >
                        <Wrench className="mr-1.5 h-3.5 w-3.5" />
                        Maintenance
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        disabled={mutation.isPending || !canDisable}
                        onClick={() =>
                          mutation.mutate(() =>
                            setState({ data: { agentKey: agent.agent_key, state: "disabled" } }),
                          )
                        }
                      >
                        <Ban className="mr-1.5 h-3.5 w-3.5" />
                        Disable
                      </Button>

                      <Link
                        to="/admin/team/$agentKey"
                        params={{ agentKey: agent.agent_key }}
                        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium hover:bg-muted"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        Open workstation
                      </Link>
                    </div>

                    <details className="rounded-md border border-border/60">
                      <summary className="cursor-pointer px-3 py-2 text-[11px] font-medium">
                        Advanced lifecycle controls
                      </summary>
                      <div className="space-y-3 border-t border-border/60 p-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={mutation.isPending || !latestVersionId || latest?.lifecycle_state !== "draft"}
                            onClick={() =>
                              latestVersionId &&
                              mutation.mutate(() => validate({ data: { versionId: latestVersionId } }))
                            }
                          >
                            <ShieldCheck className="mr-1 h-3 w-3" />
                            Validate
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={mutation.isPending || !latestVersionId || latest?.lifecycle_state !== "validated"}
                            onClick={() =>
                              latestVersionId &&
                              mutation.mutate(() => test({ data: { versionId: latestVersionId } }))
                            }
                          >
                            <TestTube2 className="mr-1 h-3 w-3" />
                            Test
                          </Button>
                        </div>

                        <div className="rounded-md bg-muted/30 p-3">
                          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                            Version history
                          </p>
                          <div className="mt-2 space-y-1.5">
                            {agentVersions.slice(0, 5).map((version: any) => (
                              <div key={version.id} className="flex flex-wrap items-center justify-between gap-2 text-[10px]">
                                <span>
                                  v{version.version} · {version.lifecycle_state}
                                </span>
                                {version.lifecycle_state !== "active" && version.lifecycle_state !== "draft" ? (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={mutation.isPending}
                                    onClick={() =>
                                      mutation.mutate(() =>
                                        rollback({
                                          data: {
                                            agentKey: agent.agent_key,
                                            versionId: version.id,
                                            reason: `Administrator rollback to ${version.version}`,
                                          },
                                        }),
                                      )
                                    }
                                  >
                                    <RotateCcw className="mr-1 h-3 w-3" />
                                    Restore
                                  </Button>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>

                        <p className="text-[10px] leading-relaxed text-muted-foreground">
                          Normal activation never requires this section. Validate and Test remain available for
                          explicit administrator inspection; Activate performs the same safety preflight automatically.
                        </p>
                      </div>
                    </details>

                    <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3 text-[10px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Activity className="h-3 w-3" />
                        {agent.last_activity_at
                          ? `Last runtime activity ${new Date(agent.last_activity_at).toLocaleString()}`
                          : "No activity yet"}
                      </span>
                      <span>{agent.status === "enabled" ? "Remains active until disabled" : "Not accepting ordinary work"}</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <section className="panel">
          <div className="flex items-start gap-3">
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-2">
              <Play className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Operational rule</h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                ACTIVE means the agent is registered as enabled in Aether's persistent control plane and may receive
                authorized work. It does not invent activity: zero tasks means zero tasks. Runtime work is durable and
                observable through the Operations control center.
              </p>
            </div>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
