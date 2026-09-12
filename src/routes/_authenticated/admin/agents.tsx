import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Activity, RotateCcw, ShieldCheck, TestTube2, Power, Wrench, Ban, Play, MessageSquare, ExternalLink, ArrowRight } from "lucide-react";
import { AdminShell } from "@/components/layout/AdminShell";
import { PageHeader, PhaseNote, StatusDot, Tag } from "@/components/common/Primitives";
import { Button } from "@/components/ui/button";
import { getAgentControlPlane, createAgentVersion, validateAgentVersion, testAgentVersion, activateAgentVersion, setAgentOperationalState, rollbackAgentVersion } from "@/lib/aether/agent.functions";

export const Route = createFileRoute("/_authenticated/admin/agents")({
  head: () => ({
    meta: [
      { title: "AI agents — Aether" },
      { name: "description", content: "Durable Agent SDK contracts, permissions, lifecycle and easy run controls." },
    ],
  }),
  component: Page,
});

/** PDF Phase M ten agents + recycling — progressive workflow stages for visibility */
const WORKFLOW_STAGES = [
  "Intake",
  "Planning",
  "Research",
  "Acquisition",
  "Verification",
  "Curation",
  "Reporting",
  "Delivery",
  "Complete",
] as const;

function ProgressiveStrip({ status }: { status: string }) {
  const activeIndex =
    status === "enabled" ? 4 : status === "maintenance" ? 2 : status === "disabled" ? 0 : 1;
  return (
    <div className="mt-3">
      <p className="mb-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Progressive workflow</p>
      <div className="flex flex-wrap gap-1">
        {WORKFLOW_STAGES.map((stage, i) => (
          <span
            key={stage}
            className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${
              i < activeIndex
                ? "bg-primary/20 text-primary"
                : i === activeIndex
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {stage}
          </span>
        ))}
      </div>
    </div>
  );
}

function Page() {
  const queryClient = useQueryClient();
  const fetchPlane = useServerFn(getAgentControlPlane);
  const createVersion = useServerFn(createAgentVersion);
  const validate = useServerFn(validateAgentVersion);
  const test = useServerFn(testAgentVersion);
  const activate = useServerFn(activateAgentVersion);
  const setState = useServerFn(setAgentOperationalState);
  const rollback = useServerFn(rollbackAgentVersion);
  const { data, isLoading, error } = useQuery({
    queryKey: ["agent-control-plane"],
    queryFn: () => fetchPlane({}),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["agent-control-plane"] });
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [versions, setVersions] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const mutation = useMutation({
    mutationFn: async (job: () => Promise<unknown>) => job(),
    onSuccess: refresh,
  });
  const agents = data?.agents ?? [];
  const versionsFor = (agentId: string) => (data?.versions ?? []).filter((v: any) => v.agent_id === agentId);
  const permsFor = (agentId: string) => (data?.permissions ?? []).filter((p: any) => p.agent_id === agentId);

  return (
    <AdminShell>
      <div className="animate-in-up space-y-6">
        <PageHeader
          eyebrow="Control plane / Phase M"
          title="AI Agents"
          description="Every agent has an independent workstation. Use Open workstation to chat and run work. Configuration (draft → validate → test → activate) stays here."
          backFallback="/admin"
        />
        <PhaseNote>
          Agent permissions are enforced at runtime. Agents cannot grant themselves roles. Each agent has its own chat history and execution timeline (Part 9B direction). Browser lifetime is irrelevant — work is durable.
        </PhaseNote>

        <div className="flex flex-wrap gap-2">
          <Link
            to="/admin/team"
            className="inline-flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/15"
          >
            <Play className="h-3.5 w-3.5" />
            Open Team (all agent workstations)
          </Link>
        </div>

        {isLoading ? (
          <div className="panel p-5">
            <p className="text-sm text-muted-foreground">Loading Agent SDK registry…</p>
          </div>
        ) : error ? (
          <div className="panel p-5">
            <p className="text-sm text-destructive">Could not load the Agent SDK registry.</p>
            <p className="mt-2 text-xs text-muted-foreground">Check backend tables and permissions, then refresh.</p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {agents.map((agent: any) => {
              const av = versionsFor(agent.id);
              const active = av.find((v: any) => v.lifecycle_state === "active");
              const latest = av[0];
              const definition = latest?.definition ?? agent.config;
              const draft = drafts[agent.id] ?? JSON.stringify(definition, null, 2);
              const isOpen = expanded[agent.id] ?? false;
              const agentKey = agent.agent_key as string;

              return (
                <div key={agent.id} className="panel overflow-hidden">
                  <div className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold">{agent.name}</h3>
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

                  <div className="space-y-4 px-5 py-4">
                    {/* Easy-run actions — primary path per PDF */}
                    <div className="flex flex-wrap gap-2">
                      <Link
                        to="/admin/team/$agentKey"
                        params={{ agentKey }}
                        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90"
                      >
                        <Play className="h-3.5 w-3.5" />
                        Open workstation & run
                      </Link>
                      <Link
                        to="/admin/team/$agentKey"
                        params={{ agentKey }}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        Chat with agent
                      </Link>
                    </div>

                    <ProgressiveStrip status={agent.status} />

                    <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                      <span className="rounded border px-2 py-1">{av.length} versions</span>
                      <span className="rounded border px-2 py-1">{permsFor(agent.id).length} permissions</span>
                      <span className="rounded border px-2 py-1">Active: {active?.version ?? "none"}</span>
                    </div>

                    <div>
                      <p className="mb-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Tools</p>
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

                    <button
                      type="button"
                      className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                      onClick={() => setExpanded((s) => ({ ...s, [agent.id]: !isOpen }))}
                    >
                      {isOpen ? "Hide configuration" : "Show configuration (draft → validate → test → activate)"}
                      <ArrowRight className={`h-3 w-3 transition ${isOpen ? "rotate-90" : ""}`} />
                    </button>

                    {isOpen && (
                      <div className="space-y-3 border-t border-border/60 pt-3">
                        <div>
                          <label className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                            New contract version
                          </label>
                          <div className="flex gap-2">
                            <input
                              className="h-9 w-28 rounded-md border bg-background px-2 text-xs"
                              value={versions[agent.id] ?? ""}
                              placeholder="1.1.0"
                              onChange={(e) => setVersions((s) => ({ ...s, [agent.id]: e.target.value }))}
                            />
                            <Button
                              size="sm"
                              disabled={mutation.isPending}
                              onClick={() => {
                                try {
                                  const parsed = JSON.parse(draft);
                                  mutation.mutate(() =>
                                    createVersion({
                                      data: {
                                        agentKey: agent.agent_key,
                                        version: versions[agent.id] || "",
                                        definition: parsed,
                                        reason: "Created from Agent SDK control plane",
                                      },
                                    }),
                                  );
                                } catch {
                                  window.alert("Contract JSON is invalid.");
                                }
                              }}
                            >
                              Create draft
                            </Button>
                          </div>
                        </div>
                        <textarea
                          className="min-h-48 w-full rounded-md border bg-background p-3 font-mono text-[10px] leading-relaxed"
                          value={draft}
                          onChange={(e) => setDrafts((s) => ({ ...s, [agent.id]: e.target.value }))}
                          spellCheck={false}
                        />
                        <div className="flex flex-wrap gap-2">
                          {latest && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={mutation.isPending || latest.lifecycle_state !== "draft"}
                                onClick={() => mutation.mutate(() => validate({ data: { versionId: latest.id } }))}
                              >
                                <ShieldCheck className="mr-1 h-3 w-3" />
                                Validate
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={mutation.isPending || latest.lifecycle_state !== "validated"}
                                onClick={() => mutation.mutate(() => test({ data: { versionId: latest.id } }))}
                              >
                                <TestTube2 className="mr-1 h-3 w-3" />
                                Test
                              </Button>
                              <Button
                                size="sm"
                                disabled={mutation.isPending || latest.lifecycle_state !== "tested"}
                                onClick={() => mutation.mutate(() => activate({ data: { versionId: latest.id } }))}
                              >
                                <Power className="mr-1 h-3 w-3" />
                                Activate
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={mutation.isPending || latest.lifecycle_state !== "active"}
                                onClick={() =>
                                  mutation.mutate(() =>
                                    setState({ data: { versionId: latest.id, state: "maintenance" } }),
                                  )
                                }
                              >
                                <Wrench className="mr-1 h-3 w-3" />
                                Maintenance
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={mutation.isPending || latest.lifecycle_state !== "active"}
                                onClick={() =>
                                  mutation.mutate(() => setState({ data: { versionId: latest.id, state: "disabled" } }))
                                }
                              >
                                <Ban className="mr-1 h-3 w-3" />
                                Disable
                              </Button>
                            </>
                          )}
                        </div>
                        {av.length > 1 && (
                          <div className="border-t pt-3">
                            <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                              Rollback targets
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {av.slice(1, 6).map((v: any) => (
                                <Button
                                  key={v.id}
                                  size="sm"
                                  variant="ghost"
                                  disabled={mutation.isPending || v.lifecycle_state === "draft"}
                                  onClick={() =>
                                    mutation.mutate(() =>
                                      rollback({
                                        data: {
                                          agentKey: agent.agent_key,
                                          versionId: v.id,
                                          reason: `Admin rollback to ${v.version}`,
                                        },
                                      }),
                                    )
                                  }
                                >
                                  <RotateCcw className="mr-1 h-3 w-3" />
                                  {v.version} · {v.lifecycle_state}
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Activity className="h-3 w-3" />
                      {agent.last_activity_at
                        ? new Date(agent.last_activity_at).toLocaleString()
                        : "No activity yet"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
