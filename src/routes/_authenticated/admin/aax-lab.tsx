import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, BrainCircuit } from "lucide-react";
import { AdminShell } from "@/components/layout/AdminShell";
import { PageHeader, Panel, Tag, EmptyState } from "@/components/common/Primitives";
import { getAaxModelLabJobs } from "@/lib/admin/aax-model-lab.functions";

export const Route = createFileRoute("/_authenticated/admin/aax-lab")({
  head: () => ({ meta: [{ title: "AAX Model Lab — Admin" }, { name: "robots", content: "noindex" }] }),
  component: Page,
});

function Page() {
  const load = useServerFn(getAaxModelLabJobs);
  const { data, isLoading, error } = useQuery({ queryKey: ["aax-model-lab"], queryFn: () => load({}) });
  const jobs = data ?? [];
  return <AdminShell><div className="animate-in-up space-y-6"><PageHeader eyebrow="AAX control plane" title="Model Lab" description="Monitor durable AAX knowledge-evolution jobs and their recorded pipeline stages." backFallback="/admin/models" /><Panel className="flex items-center gap-3"><BrainCircuit className="h-5 w-5" /><div><p className="text-sm font-semibold">Knowledge evolution runtime</p><p className="text-xs text-muted-foreground">Jobs execute through the universal runtime; this view reports persisted state rather than simulated progress.</p></div></Panel>{error ? <Panel><p className="text-sm text-destructive">Unable to load Model Lab.</p></Panel> : isLoading ? <Panel><p className="text-sm text-muted-foreground">Loading jobs…</p></Panel> : jobs.length === 0 ? <EmptyState title="No training jobs" description="Create an AAX knowledge-evolution job to begin training." icon={<BrainCircuit className="h-5 w-5" />} /> : <div className="space-y-3">{jobs.map((job) => <Panel key={job.id} className="space-y-3"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-xs">{job.id}</p><p className="mt-1 text-sm font-medium">{job.source_name ?? job.source_type}</p><p className="mt-1 text-xs text-muted-foreground">Target model: {job.target_model_id}</p></div><Tag tone={job.pipeline_status === "completed" ? "success" : "neutral"}>{job.pipeline_status}</Tag></div><div className="flex flex-wrap items-center gap-2 text-xs"><Tag tone="primary">{job.current_stage}</Tag><span className="text-muted-foreground">{job.completed_agents.length} recorded agents</span>{job.last_event_at && <span className="flex items-center gap-1 text-muted-foreground"><Activity className="h-3 w-3" />{new Date(job.last_event_at).toLocaleString()}</span>}</div></Panel>)}</div>}</div></AdminShell>;
}
