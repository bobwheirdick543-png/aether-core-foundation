import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bot } from "lucide-react";
import { AdminShell } from "@/components/layout/AdminShell";
import { PageHeader, Panel, Tag, StatCard, EmptyState } from "@/components/common/Primitives";
import { getTeamOverview } from "@/lib/admin/console.functions";

export const Route = createFileRoute("/_authenticated/admin/team")({
  head: () => ({
    meta: [
      { title: "Team — Aether admin" },
      { name: "description", content: "The internal Aether agent workforce, permissions and telemetry." },
      { property: "og:title", content: "Team — Aether admin" },
      { property: "og:description", content: "The internal Aether agent workforce, permissions and telemetry." },
    ],
  }),
  component: Page,
});

function Page() {
  const fetchTeam = useServerFn(getTeamOverview);
  const { data, isLoading } = useQuery({ queryKey: ["admin-team"], queryFn: () => fetchTeam({}) });

  const team = data?.team ?? [];
  const active = team.filter((a) => a.status === "enabled").length;

  return (
    <AdminShell>
      <div className="animate-in-up space-y-6">
        <PageHeader
          eyebrow="Team"
          title="Internal workforce"
          description="Every agent that works inside Aether, with its real permissions and measured activity. No fabricated metrics."
          backFallback="/admin"
        />

        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Agents defined" value={String(team.length)} />
          <StatCard label="Active" value={String(active)} />
          <StatCard label="Recorded runs" value={String(data?.totalRuns ?? 0)} hint="From real execution history" />
        </div>

        {isLoading ? (
          <Panel><p className="text-sm text-muted-foreground">Loading the team…</p></Panel>
        ) : team.length === 0 ? (
          <EmptyState title="No agents defined yet" description="Agents appear here as soon as they are registered in the platform." icon={<Bot className="h-5 w-5" />} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {team.map((agent) => (
              <Panel key={agent.id} className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">{agent.name}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{agent.description}</p>
                  </div>
                  <Tag tone={agent.status === "enabled" ? "success" : "neutral"}>{agent.status}</Tag>
                </div>

                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Purpose</p>
                  <p className="mt-1 text-xs text-muted-foreground">{agent.purpose}</p>
                </div>

                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Permissions</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {agent.permissions.length === 0 ? <span className="text-xs text-muted-foreground">No permissions granted.</span> : agent.permissions.map((p) => (
                      <Tag key={p.permission} tone={p.allowed ? (p.requires_approval ? "warning" : "primary") : "neutral"}>
                        {p.permission}{p.requires_approval ? " · approval" : ""}
                      </Tag>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-border/60 p-3 text-xs">
                  {agent.telemetry.hasData ? (
                    <div className="grid grid-cols-3 gap-2">
                      <div><p className="text-muted-foreground">Runs</p><p className="font-medium">{agent.telemetry.totalRuns}</p></div>
                      <div><p className="text-muted-foreground">Succeeded</p><p className="font-medium">{agent.telemetry.succeeded}</p></div>
                      <div><p className="text-muted-foreground">Failed</p><p className="font-medium">{agent.telemetry.failed}</p></div>
                    </div>
                  ) : <p className="text-muted-foreground">No execution data recorded yet — statistics appear once this agent runs.</p>}
                </div>

                <Link
                  to="/admin/team/$agentKey"
                  params={{ agentKey: agent.agent_key }}
                  className="inline-flex rounded-md border border-admin/25 px-3 py-2 text-xs font-medium text-foreground hover:bg-admin/10"
                >
                  Open workstation
                </Link>
              </Panel>
            ))}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
