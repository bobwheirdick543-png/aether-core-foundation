import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, CheckCircle2, CircleAlert, Clock3, Loader2, PauseCircle, XCircle } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, Panel, EmptyState, Tag, StatCard } from "@/components/common/Primitives";
import { supabase } from "@/integrations/supabase/client";
import { getMyOperations } from "@/lib/workspace/operations.functions";

export const Route = createFileRoute("/_authenticated/operations")({
  head: () => ({ meta: [{ title: "Operations — Aether" }, { name: "description", content: "Live persistent execution tracking for Aether tasks and agents." }] }),
  component: Page,
});

const ACTIVE = new Set(["queued", "running", "waiting_approval", "paused", "retrying", "scheduled"]);
const TONE: Record<string, "success" | "warning" | "primary" | "neutral" | "danger"> = {
  completed: "success", running: "primary", queued: "neutral", waiting_approval: "warning", paused: "neutral", retrying: "warning", scheduled: "neutral", failed: "danger", cancelled: "neutral",
};

function Page() {
  const queryClient = useQueryClient();
  const load = useServerFn(getMyOperations);
  const [filter, setFilter] = useState("all");
  const { data, isLoading } = useQuery({ queryKey: ["my-operations"], queryFn: () => load({}), refetchInterval: 30_000 });

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    async function subscribe() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user || cancelled) return;
      channel = supabase.channel(`aether-operations:${auth.user.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `user_id=eq.${auth.user.id}` }, () => queryClient.invalidateQueries({ queryKey: ["my-operations"] }))
        .on("postgres_changes", { event: "*", schema: "public", table: "task_runs", filter: `owner_id=eq.${auth.user.id}` }, () => queryClient.invalidateQueries({ queryKey: ["my-operations"] }))
        .on("postgres_changes", { event: "*", schema: "public", table: "task_events" }, () => queryClient.invalidateQueries({ queryKey: ["my-operations"] }))
        .subscribe();
    }
    void subscribe();
    return () => { cancelled = true; if (channel) void supabase.removeChannel(channel); };
  }, [queryClient]);

  const operations = data ?? [];
  const stats = useMemo(() => ({ active: operations.filter((x) => ACTIVE.has(x.status)).length, completed: operations.filter((x) => x.status === "completed").length, failed: operations.filter((x) => x.status === "failed").length, waiting: operations.filter((x) => x.status === "waiting_approval").length }), [operations]);
  const visible = operations.filter((operation) => filter === "all" || (filter === "active" ? ACTIVE.has(operation.status) : operation.kind === filter));

  return <AppShell>
    <div className="animate-in-up space-y-6">
      <PageHeader title="Operations Center" description="Persistent execution state and event history for research, training, agents, models, orchestration and background work. The browser only observes the durable runtime." backFallback="/dashboard" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active" value={String(stats.active)} hint="Live or waiting work" tone="primary" />
        <StatCard label="Completed" value={String(stats.completed)} hint="Persisted successful runs" tone="success" />
        <StatCard label="Waiting" value={String(stats.waiting)} hint="Needs approval or dependency" tone="warning" />
        <StatCard label="Failed" value={String(stats.failed)} hint="Requires review or retry" tone="warning" />
      </div>
      <div className="flex flex-wrap gap-2">
        {["all", "active", "research", "training", "aax", "general"].map((value) => <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-md border px-3 py-1.5 text-xs ${filter === value ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>{value === "all" ? "All" : value === "active" ? "Active" : value}</button>)}
      </div>
      {isLoading ? <Panel><div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading persistent execution state…</div></Panel> : visible.length === 0 ? <EmptyState title="No operations" description="Aether has no persisted operations matching this view." icon={<Activity className="h-5 w-5" />} /> : <div className="space-y-3">{visible.map((operation) => <OperationCard key={operation.id} operation={operation} />)}</div>}
    </div>
  </AppShell>;
}

function OperationCard({ operation }: { operation: any }) {
  const latestEvent = operation.events?.[0];
  const latestRun = operation.runs?.[0];
  const icon = operation.status === "completed" ? <CheckCircle2 className="h-4 w-4" /> : operation.status === "failed" ? <XCircle className="h-4 w-4" /> : operation.status === "waiting_approval" ? <Clock3 className="h-4 w-4" /> : operation.status === "paused" ? <PauseCircle className="h-4 w-4" /> : operation.status === "running" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />;
  return <Panel className="space-y-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex gap-3"><span className="mt-0.5 rounded-md border border-border bg-elevated p-2 text-primary">{icon}</span><div><h2 className="text-sm font-semibold">{operation.title}</h2><p className="text-xs text-muted-foreground">{operation.kind} · {operation.id}</p></div></div>
      <Tag tone={TONE[operation.status] ?? "neutral"}>{operation.status}</Tag>
    </div>
    <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${Math.max(0, Math.min(100, operation.progress ?? 0))}%` }} /></div>
    <div className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-4"><span>Progress <b className="text-foreground">{operation.progress}%</b></span><span>Agent <b className="text-foreground">{latestRun?.agent_key ?? "—"}</b></span><span>Worker <b className="font-mono text-foreground">{operation.worker_id ?? latestRun?.worker_id ?? "—"}</b></span><span>Heartbeat <b className="text-foreground">{operation.heartbeat_at ? new Date(operation.heartbeat_at).toLocaleTimeString() : "—"}</b></span></div>
    <div className="rounded-md border border-border/60 bg-muted/20 p-3"><p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Current activity</p><p className="mt-1 text-sm">{latestEvent?.message ?? latestEvent?.event_type ?? operation.detail?.currentActivity ?? "Waiting for execution event…"}</p></div>
    <div><p className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Recent event history</p><div className="space-y-1.5">{(operation.events ?? []).slice(0, 6).map((event: any) => <div key={event.id} className="flex items-start gap-2 text-xs"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" /><span className="min-w-0 flex-1"><b className="text-foreground">{event.event_type}</b>{event.message ? ` — ${event.message}` : ""}</span><time className="shrink-0 text-muted-foreground">{new Date(event.created_at).toLocaleTimeString()}</time></div>)}{!(operation.events?.length) ? <p className="text-xs text-muted-foreground">No events recorded yet.</p> : null}</div></div>
    {operation.last_error_message ? <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />{operation.last_error_message}</div> : null}
  </Panel>;
}
