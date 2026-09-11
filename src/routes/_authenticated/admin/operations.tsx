import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, Loader2 } from "lucide-react";
import { AdminShell } from "@/components/layout/AdminShell";
import { PageHeader, Panel, EmptyState, Tag } from "@/components/common/Primitives";
import { supabase } from "@/integrations/supabase/client";
import { getAdminOperations } from "@/lib/workspace/operations.functions";

export const Route = createFileRoute("/_authenticated/admin/operations")({
  head: () => ({ meta: [{ title: "Operations control — Aether" }, { name: "description", content: "Persistent execution observability across the Aether platform." }] }),
  component: Page,
});

function Page() {
  const queryClient = useQueryClient();
  const load = useServerFn(getAdminOperations);
  const { data, isLoading } = useQuery({ queryKey: ["admin-operations"], queryFn: () => load({}), refetchInterval: 30_000 });
  useEffect(() => {
    const channel = supabase.channel("admin-operations-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => queryClient.invalidateQueries({ queryKey: ["admin-operations"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "task_runs" }, () => queryClient.invalidateQueries({ queryKey: ["admin-operations"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "task_events" }, () => queryClient.invalidateQueries({ queryKey: ["admin-operations"] }))
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [queryClient]);
  return <AdminShell><div className="space-y-6"><PageHeader title="Operations control" description="Live persistent execution state and event history across users, agents, research, training and model operations." backFallback="/admin" /><Panel><p className="text-xs text-muted-foreground">Admin visibility is server-authorized. This page observes durable runtime state; it does not manufacture activity.</p></Panel>{isLoading ? <Panel><div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading operations…</div></Panel> : (data ?? []).length === 0 ? <EmptyState title="No operations" description="There are no persisted operations to display." icon={<Activity className="h-5 w-5" />} /> : <div className="space-y-3">{(data ?? []).map((operation: any) => <Panel key={operation.id} className="space-y-3"><div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold">{operation.title}</h2><p className="text-xs text-muted-foreground">{operation.kind} · owner {operation.user_id}</p></div><Tag tone={operation.status === "completed" ? "success" : operation.status === "failed" ? "danger" : operation.status === "running" ? "primary" : "neutral"}>{operation.status}</Tag></div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-admin transition-all" style={{ width: `${Math.max(0, Math.min(100, operation.progress ?? 0))}%` }} /></div><div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-4"><span>Progress {operation.progress}%</span><span>Agent {operation.runs?.[0]?.agent_key ?? "—"}</span><span>Worker {operation.worker_id ?? operation.runs?.[0]?.worker_id ?? "—"}</span><span>Events {operation.events?.length ?? 0}</span></div><div className="rounded-md border border-admin/20 bg-admin/5 p-3 text-xs">{operation.events?.[0]?.message ?? operation.events?.[0]?.event_type ?? operation.detail?.currentActivity ?? "No current event"}</div></Panel>)}</div>}</div></AdminShell>;
}
