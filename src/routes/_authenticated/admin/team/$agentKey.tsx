import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, Bot, CheckCircle2, Clock3, XCircle } from "lucide-react";
import { AdminShell } from "@/components/layout/AdminShell";
import { PageHeader, Panel, StatCard, Tag } from "@/components/common/Primitives";
import { getAgentWorkspace } from "@/lib/admin/console.functions";

export const Route = createFileRoute("/_authenticated/admin/team/$agentKey")({
  head: () => ({
    meta: [
      { title: "Agent workstation — Aether admin" },
      { name: "description", content: "Individual internal Aether agent workstation and telemetry." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

function Page() {
  const { agentKey } = Route.useParams();
  const fetchWorkspace = useServerFn(getAgentWorkspace);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-agent-workspace", agentKey],
    queryFn: () => fetchWorkspace({ data: { agentKey } }),
  });

  if (isLoading) {
    return <AdminShell><Panel><p className="text-sm text-muted-foreground">Loading agent workstation…</p></Panel></AdminShell>;
  }

  if (error || !data) {
    return <AdminShell><Panel><p className="text-sm text-muted-foreground">This agent workstation could not be loaded.</p></Panel></AdminShell>;
  }

  const { agent, permissions, tasks, runs, telemetry } = data;

  return (
    <AdminShell>
      <div className="animate-in-up space-y-6">
        <PageHeader
          eyebrow="Agent workstation"
          title={agent.name}
          description={agent.description}
          backFallback="/admin/team"
        />

        <div className="flex flex-wrap items-center gap-2">
          <Tag tone={agent.status === "enabled" ? "success" : "neutral"}>{agent.status}</Tag>
          <span className="font-mono text-xs text-muted-foreground">{agent.agent_key}</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Runs" value={String(telemetry.totalRuns)} />
          <StatCard label="Succeeded" value={String(telemetry.succeeded)} />
          <StatCard label="Failed" value={String(telemetry.failed)} />
          <StatCard label="Waiting approval" value={String(telemetry.waiting)} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold">Mission</h2>
              <p className="mt-1 text-xs text-muted-foreground">{agent.purpose}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Tools</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(agent.tools ?? []).map((tool) => <Tag key={tool} tone="primary">{tool}</Tag>)}
              </div>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Permissions</p>
              <div className="mt-2 space-y-1.5">
                {permissions.map((permission) => (
                  <div key={permission.permission} className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-xs">
                    <span>{permission.permission}</span>
                    <Tag tone={permission.allowed ? (permission.requires_approval ? "warning" : "success") : "neutral"}>
                      {permission.allowed ? (permission.requires_approval ? "approval" : "allowed") : "denied"}
                    </Tag>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          <Panel>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              <h2 className="text-sm font-semibold">Execution analysis</h2>
            </div>
            <div className="mt-4 space-y-3 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Average duration</span><span>{telemetry.avgDurationMs == null ? "No data" : `${Math.round(telemetry.avgDurationMs / 1000)}s`}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Last activity</span><span>{agent.last_activity_at ? new Date(agent.last_activity_at).toLocaleString() : "No activity"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Recorded tasks</span><span>{tasks.length}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Recorded runs shown</span><span>{runs.length}</span></div>
            </div>
          </Panel>
        </div>

        <Panel>
          <div className="flex items-center gap-2">
            <Clock3 className="h-4 w-4" />
            <h2 className="text-sm font-semibold">Tasks</h2>
          </div>
          <div className="mt-4 space-y-2">
            {tasks.length === 0 ? (
              <p className="text-xs text-muted-foreground">No tasks have been recorded for this agent.</p>
            ) : tasks.map((task) => (
              <div key={task.id} className="rounded-md border border-border/60 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="text-xs font-medium">{task.title}</p><p className="mt-1 text-[11px] text-muted-foreground">{task.kind}</p></div>
                  <Tag tone="neutral">{task.status}</Tag>
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground">Progress: {task.progress}% · Created {new Date(task.created_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            <h2 className="text-sm font-semibold">Run history & outputs</h2>
          </div>
          <div className="mt-4 space-y-3">
            {runs.length === 0 ? (
              <p className="text-xs text-muted-foreground">No execution data recorded yet. This workstation will populate from real runs.</p>
            ) : runs.map((run) => (
              <div key={run.id} className="rounded-md border border-border/60 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs font-medium">
                    {run.status === "completed" ? <CheckCircle2 className="h-3.5 w-3.5" /> : run.status === "failed" ? <XCircle className="h-3.5 w-3.5" /> : <Activity className="h-3.5 w-3.5" />}
                    {run.status}
                  </div>
                  <span className="text-[10px] text-muted-foreground">{new Date(run.created_at).toLocaleString()}</span>
                </div>
                {run.error ? <p className="mt-2 text-xs text-destructive">{run.error}</p> : null}
                {run.outputs ? <pre className="mt-2 max-h-48 overflow-auto rounded bg-muted/40 p-2 text-[10px] text-muted-foreground">{JSON.stringify(run.outputs, null, 2)}</pre> : null}
              </div>
            ))}
          </div>
        </Panel>

        <Link to="/admin/team" className="inline-flex text-xs text-primary hover:underline">← Back to Team</Link>
      </div>
    </AdminShell>
  );
}
