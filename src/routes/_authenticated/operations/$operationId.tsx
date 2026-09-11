import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, CheckCircle2, CircleAlert, Clock3, Loader2, PauseCircle, XCircle } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, Panel, Tag, EmptyState } from "@/components/common/Primitives";
import { getMyOperation } from "@/lib/workspace/operations.functions";

export const Route = createFileRoute("/_authenticated/operations/$operationId")({
  head: () => ({ meta: [{ title: "Operation — Aether" }] }),
  component: Page,
});

function Page() {
  const { operationId } = Route.useParams();
  const load = useServerFn(getMyOperation);
  const { data, isLoading } = useQuery({ queryKey: ["my-operation", operationId], queryFn: () => load({ data: { id: operationId } }), refetchInterval: 15_000 });
  if (isLoading) return <AppShell><Panel><div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading execution record…</div></Panel></AppShell>;
  if (!data) return <AppShell><EmptyState title="Operation not found" description="This operation is not available to the current account." icon={<CircleAlert className="h-5 w-5" />} /></AppShell>;
  const { task, runs, events } = data as any;
  return <AppShell><div className="space-y-6"><PageHeader title={task.title} description={`${task.kind} · persistent execution record`} backFallback="/operations" /><div className="grid gap-3 sm:grid-cols-4"><Panel><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</p><div className="mt-2"><Tag tone={task.status === "completed" ? "success" : task.status === "failed" ? "danger" : task.status === "running" ? "primary" : "neutral"}>{task.status}</Tag></div></Panel><Panel><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Progress</p><p className="mt-2 font-mono text-xl">{task.progress}%</p></Panel><Panel><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Worker</p><p className="mt-2 text-sm">{task.worker_id ?? runs?.[0]?.worker_id ?? "—"}</p></Panel><Panel><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Heartbeat</p><p className="mt-2 text-sm">{task.heartbeat_at ? new Date(task.heartbeat_at).toLocaleString() : "—"}</p></Panel></div><Panel><h2 className="text-sm font-semibold">Execution timeline</h2><div className="mt-5 space-y-4">{events.length ? events.map((event: any) => <div key={event.id} className="relative flex gap-3"><span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary"><Activity className="h-3.5 w-3.5" /></span><div className="min-w-0 flex-1 border-b border-border/50 pb-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium">{event.event_type}</p><time className="text-[11px] text-muted-foreground">{new Date(event.created_at).toLocaleString()}</time></div><p className="mt-1 text-xs text-muted-foreground">{event.message ?? "No message"}</p>{event.data ? <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-muted/40 p-2 text-[10px] text-muted-foreground">{JSON.stringify(event.data, null, 2)}</pre> : null}</div></div>) : <p className="text-sm text-muted-foreground">No execution events have been recorded yet.</p>}</div></Panel><Panel><h2 className="text-sm font-semibold">Run attempts</h2><div className="mt-4 space-y-2">{runs.length ? runs.map((run: any) => <div key={run.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/60 p-3 text-xs"><span>Attempt {run.attempt}</span><span>{run.agent_key ?? "runtime"}</span><Tag tone={run.status === "completed" ? "success" : run.status === "failed" ? "danger" : "neutral"}>{run.status}</Tag><span>{run.duration_ms ? `${Math.round(run.duration_ms / 1000)}s` : "in progress"}</span></div>) : <p className="text-sm text-muted-foreground">No run attempts.</p>}</div></Panel></div></AppShell>;
}
