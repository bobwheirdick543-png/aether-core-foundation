import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Settings2, Activity, ListChecks } from "lucide-react";
import { AdminShell } from "@/components/layout/AdminShell";
import { PageHeader, Tag, PhaseNote, StatusDot } from "@/components/common/Primitives";
import { Button } from "@/components/ui/button";
import { getAdminAgentIntelligence } from "@/lib/admin/aax-admin.functions";

export const Route = createFileRoute("/_authenticated/admin/agents")({
  head: () => ({ meta: [
    { title: "AI agents — Aether" },
    { name: "description", content: "Aether internal agents, permissions and real performance statistics." },
    { property: "og:title", content: "AI agents — Aether" },
  ] }),
  component: Page,
});

function Page() {
  const fetchAgents = useServerFn(getAdminAgentIntelligence);
  const { data, isLoading } = useQuery({ queryKey: ["admin-agent-intelligence"], queryFn: () => fetchAgents({}) });
  return <AdminShell><div className="animate-in-up space-y-6">
    <PageHeader eyebrow="Control plane" title="AI Agents" description="Internal Aether agents with explicit responsibilities, tools, permissions and real measured intelligence. Only the admin can see these internal statistics." backFallback="/admin" />
    <PhaseNote>Statistics are evidence-backed and unbounded. No artificial 0–100 ceiling and no fabricated learning gains are displayed.</PhaseNote>
    {isLoading ? <div className="panel"><p className="text-sm text-muted-foreground">Loading agent intelligence…</p></div> : <div className="grid gap-4 lg:grid-cols-2">{(data?.agents ?? []).map((agent) => <div key={agent.id} className="panel group overflow-hidden transition-all duration-200 hover:border-admin/40"><div className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-4"><div><h3 className="text-sm font-semibold tracking-tight">{agent.name}</h3><p className="mt-0.5 text-xs text-muted-foreground">{agent.purpose}</p></div><StatusDot status={agent.status === "enabled" ? "online" : agent.status === "maintenance" ? "maintenance" : "offline"} label={agent.status} /></div><div className="space-y-4 px-5 py-4"><p className="text-sm leading-relaxed text-muted-foreground">{agent.description}</p><div><p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Tools</p><div className="flex flex-wrap gap-1.5">{agent.tools.map((tool) => <span key={tool} className="rounded-md border border-border/60 bg-elevated/50 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">{tool}</span>)}</div></div><div className="rounded-lg border border-border/60 bg-elevated/30 p-3"><p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Current measured statistics</p>{agent.statistics.length === 0 ? <p className="mt-2 text-xs text-muted-foreground">No measured statistic exists yet. Aether will not invent one.</p> : <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">{agent.statistics.slice().sort((a,b) => a.metric_key.localeCompare(b.metric_key)).map((stat) => <div key={stat.metric_key}><p className="text-[10px] capitalize text-muted-foreground">{stat.metric_key.replaceAll("_", " ")}</p><p className="font-mono text-sm tabular-nums">{stat.value}</p></div>)}</div>}</div><p className="text-[11px] text-muted-foreground">Historical register entries: {agent.registerEntries.length}. Every change must have evidence and remains permanently traceable.</p><div className="flex items-center gap-4 text-[11px] text-muted-foreground"><span className="inline-flex items-center gap-1"><Activity className="h-3 w-3" />{agent.last_activity_at ? new Date(agent.last_activity_at).toLocaleString() : "No activity yet"}</span></div></div><div className="flex items-center gap-2 border-t border-border/60 px-5 py-3"><Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs"><Settings2 className="h-3 w-3" />Configure</Button><Button size="sm" variant="ghost" className="h-8 text-xs"><ListChecks className="h-3 w-3" />View tasks</Button></div></div>)}</div>}
  </div></AdminShell>;
}
