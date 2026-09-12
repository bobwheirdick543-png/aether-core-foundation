import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, AlertTriangle, CheckCircle2, Clock3, Database, Loader2, Radio, Server, XCircle } from "lucide-react";
import { AdminShell } from "@/components/layout/AdminShell";
import { PageHeader, Panel, EmptyState, Tag } from "@/components/common/Primitives";
import { getPhaseWObservability } from "@/lib/admin/phase-w-observability.functions";

export const Route = createFileRoute("/_authenticated/admin/observability")({
  head: () => ({ meta: [{ title: "Observability — Aether" }, { name: "description", content: "Global runtime observability and operations." }] }),
  component: Page,
});

function formatDuration(value: number | null): string {
  if (value === null) return "—";
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(2)} s`;
}

function Page() {
  const load = useServerFn(getPhaseWObservability);
  const { data, isLoading, error } = useQuery({ queryKey: ["phase-w-observability"], queryFn: () => load({}), refetchInterval: 15_000 });

  if (isLoading) return <AdminShell><PageHeader title="Observability" description="Global runtime health, telemetry, traces and operational alerts." backFallback="/admin" /><Panel><div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading real telemetry…</div></Panel></AdminShell>;
  if (error || !data) return <AdminShell><PageHeader title="Observability" description="Global runtime health, telemetry, traces and operational alerts." backFallback="/admin" /><Panel><div className="flex items-center gap-2 text-sm text-destructive"><XCircle className="h-4 w-4" />{error instanceof Error ? error.message : "Unable to load observability data."}</div></Panel></AdminShell>;

  const { health } = data;
  const cards = [
    ["Workers", `${health.workers - health.offlineWorkers} / ${health.workers}`, Server],
    ["Queue", String(health.queuePending), Database],
    ["Active", String(health.activeTasks), Radio],
    ["Success", health.successRate === null ? "—" : `${(health.successRate * 100).toFixed(1)}%`, CheckCircle2],
    ["Failures", health.failureRate === null ? "—" : `${(health.failureRate * 100).toFixed(1)}%`, XCircle],
    ["Avg latency", formatDuration(health.avgDurationMs), Clock3],
  ] as const;

  return <AdminShell><div className="space-y-6">
    <PageHeader title="Observability" description="Global runtime health, telemetry, traces and operational alerts. All values come from persisted Aether execution data." backFallback="/admin" />
    {data.alerts.length > 0 ? <div className="space-y-2">{data.alerts.map((alert) => <Panel key={alert.code} className="border-admin/30"><div className="flex items-center gap-3"><AlertTriangle className="h-4 w-4" /><div><p className="text-sm font-medium">{alert.message}</p><p className="text-xs text-muted-foreground">{alert.code} · {alert.count} occurrence(s)</p></div><Tag tone={alert.severity === "critical" ? "danger" : "neutral"}>{alert.severity}</Tag></div></Panel>)}</div> : <Panel><div className="flex items-center gap-3 text-sm"><CheckCircle2 className="h-4 w-4" />No active operational alerts in the observed window.</div></Panel>}

    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{cards.map(([label, value, Icon]) => <Panel key={label}><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div><Icon className="h-5 w-5 text-muted-foreground" /></div></Panel>)}</div>

    <Panel><div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold">Runtime workers</h2><p className="text-xs text-muted-foreground">Current durable worker heartbeats and ownership.</p></div><Activity className="h-5 w-5 text-muted-foreground" /></div>{data.workers.length === 0 ? <EmptyState title="No registered workers" description="No worker heartbeat records exist yet." /> : <div className="mt-4 space-y-2">{data.workers.map((worker) => <div key={worker.worker_id} className="flex items-center justify-between rounded-md border p-3 text-xs"><div><p className="font-medium">{worker.worker_id}</p><p className="text-muted-foreground">{worker.current_run_id ? `run ${worker.current_run_id}` : "no active run"} · heartbeat {worker.last_heartbeat_at ?? "—"}</p></div><Tag tone={worker.status === "offline" ? "danger" : worker.status === "running" ? "primary" : "success"}>{worker.status}</Tag></div>)}</div>}</Panel>

    <Panel><div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">Recent telemetry</h2><p className="text-xs text-muted-foreground">Structured events from the last 24 hours.</p></div><span className="text-xs text-muted-foreground">{health.eventCount} events</span></div>{data.events.length === 0 ? <EmptyState title="No telemetry yet" description="Real telemetry will appear when Aether performs observable work." /> : <div className="mt-4 max-h-[520px] space-y-2 overflow-auto">{data.events.map((event) => <div key={event.id} className="rounded-md border p-3 text-xs"><div className="flex items-center justify-between gap-3"><span className="font-medium">{event.component} · {event.event_type}</span><Tag tone={event.level === "error" ? "danger" : event.level === "warn" ? "neutral" : "success"}>{event.level}</Tag></div><p className="mt-1 text-muted-foreground">{event.message ?? "No message"}</p><p className="mt-1 text-muted-foreground">{event.occurred_at}{event.trace_id ? ` · trace ${event.trace_id}` : ""}{event.duration_ms != null ? ` · ${formatDuration(event.duration_ms)}` : ""}</p></div>)}</div>}</Panel>

    <Panel><div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">Execution traces</h2><p className="text-xs text-muted-foreground">Persisted spans across the Aether execution boundary.</p></div><span className="text-xs text-muted-foreground">{data.spans.length} spans</span></div>{data.spans.length === 0 ? <EmptyState title="No traces yet" description="Traces appear when observable spans are started by the runtime." /> : <div className="mt-4 max-h-[420px] space-y-2 overflow-auto">{data.spans.map((span) => <div key={span.span_id} className="rounded-md border p-3 text-xs"><div className="flex items-center justify-between gap-3"><span className="font-medium">{span.name}</span><Tag tone={span.status === "failed" ? "danger" : span.status === "completed" ? "success" : "neutral"}>{span.status}</Tag></div><p className="text-muted-foreground">{span.component} · trace {span.trace_id} · {formatDuration(span.duration_ms)}</p></div>)}</div>}</Panel>
  </div></AdminShell>;
}
