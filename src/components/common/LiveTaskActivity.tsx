import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronDown, CircleDot, Clock3, Pause, Sparkles, XCircle } from "lucide-react";
import { getLiveTaskActivity } from "@/lib/aether/task-activity.functions";
import { cn } from "@/lib/utils";

type EventRow = { id: string; sequence: number; event_type: string; message: string | null; data: Record<string, unknown> | null; created_at: string };
type ActivityTask = { task: { id: string; title: string; kind: string; status: string; progress: number; started_at: string | null; completed_at: string | null; deadline_at: string | null }; events: EventRow[] };

function labelFor(event: EventRow): string {
  const explicit = typeof event.data?.label === "string" ? event.data.label : null;
  if (explicit) return explicit;
  const map: Record<string, string> = {
    "knowledge.scope.created": "Scope created",
    "knowledge.research.started": "Source research",
    "knowledge.candidate.created": "Knowledge candidate prepared",
    "research.plan.started": "Research planning",
    "research.plan.completed": "Research plan completed",
    "worker.execution_started": "Execution started",
    "run.claimed": "Worker claimed task",
    "tool.completed": "Source retrieved",
    "tool.failed": "Source retrieval failed",
    "knowledge_acquisition.queued": "Queued for acquisition",
  };
  if (map[event.event_type]) return map[event.event_type];
  return event.message || event.event_type.replace(/[._-]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}
function durationMs(event: EventRow, next?: EventRow, active = false): number {
  const explicit = Number(event.data?.duration_ms);
  if (Number.isFinite(explicit) && explicit >= 0) return explicit;
  const start = Date.parse(event.created_at);
  const end = active ? Date.now() : next ? Date.parse(next.created_at) : start;
  return Math.max(0, end - start);
}
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${(ms / 1000).toFixed(seconds < 10 ? 1 : 0)}s`;
  const minutes = Math.floor(seconds / 60); const remainder = seconds % 60;
  return `${minutes}m ${String(remainder).padStart(2, "0")}s`;
}

export function LiveTaskActivity({ admin = false, className }: { admin?: boolean; className?: string }) {
  const load = useServerFn(getLiveTaskActivity);
  const { data = [], isFetching } = useQuery({ queryKey: ["aether-live-task-activity", admin], queryFn: () => load({ data: { admin, limit: admin ? 12 : 6 } }) as Promise<ActivityTask[]>, refetchInterval: 1000, staleTime: 0 });
  const [open, setOpen] = useState(true);
  const hasTasks = data.length > 0;
  const count = useMemo(() => data.filter((item) => item.task.status === "running").length, [data]);
  if (!hasTasks) return null;
  return <section className={cn("fixed bottom-4 right-4 z-50 w-[min(430px,calc(100vw-2rem))]", className)} aria-live="polite">
    <div className="overflow-hidden rounded-2xl border border-primary/20 bg-background/95 shadow-2xl backdrop-blur-xl">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 border-b border-border/70 px-4 py-3 text-left">
        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary"><Sparkles className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1"><span className="block text-xs font-semibold">Aether live activity</span><span className="block text-[10px] text-muted-foreground">{count} active · {data.length} visible task{data.length === 1 ? "" : "s"}{isFetching ? " · syncing" : ""}</span></span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", !open && "-rotate-90")} />
      </button>
      {open ? <div className="max-h-[min(70vh,620px)] space-y-2 overflow-y-auto p-2">
        {data.map(({ task, events }) => <TaskTree key={task.id} task={task} events={events} />)}
      </div> : null}
    </div>
  </section>;
}

function TaskTree({ task, events }: { task: ActivityTask["task"]; events: EventRow[] }) {
  const activeIndex = events.length && !["completed","failed","cancelled"].includes(events[events.length - 1]?.event_type?.split(".").at(-1) ?? "") ? events.length - 1 : -1;
  const elapsed = task.started_at ? Math.max(0, Date.now() - Date.parse(task.started_at)) : 0;
  return <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
    <div className="flex items-start gap-2"><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{task.title}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{task.kind} · {task.status} · {task.progress}%</p></div><span className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground"><Clock3 className="h-3 w-3" />{formatDuration(elapsed)}</span></div>
    <div className="mt-3 space-y-1">
      {events.slice(-24).map((event, index, visible) => {
        const actualIndex = events.length - visible.length + index;
        const active = actualIndex === activeIndex && !["completed","failed","cancelled"].includes(task.status);
        const next = visible[index + 1];
        const failed = event.event_type.endsWith("failed") || event.event_type.endsWith("error");
        return <div key={event.id} className="flex items-start gap-2 rounded-md px-1.5 py-1">
          <span className="mt-0.5 shrink-0">{failed ? <XCircle className="h-3.5 w-3.5 text-destructive" /> : active ? <CircleDot className="h-3.5 w-3.5 animate-pulse text-primary" /> : event.event_type.includes("paused") ? <Pause className="h-3.5 w-3.5 text-muted-foreground" /> : <Check className="h-3.5 w-3.5 text-primary" />}</span>
          <span className="min-w-0 flex-1"><span className={cn("block text-[11px]", active && "font-medium text-primary")}>{labelFor(event)}</span><span className="block text-[9px] text-muted-foreground">{formatDuration(durationMs(event, next, active))}{event.message && event.message !== labelFor(event) ? ` · ${event.message}` : ""}</span></span>
        </div>;
      })}
    </div>
    {task.deadline_at ? <div className="mt-2 flex items-center justify-between border-t border-border/50 pt-2 text-[9px] text-muted-foreground"><span>Research budget</span><span>{new Date(task.deadline_at).toLocaleTimeString()}</span></div> : null}
  </div>;
}
