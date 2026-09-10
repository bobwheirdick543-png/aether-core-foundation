import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { PageHeader, Panel, Tag } from "@/components/common/Primitives";
import { getOrchestratorConfigHistory } from "@/lib/admin/console.functions";
import { activateOrchestratorConfig, saveOrchestratorConfig } from "@/lib/admin/orchestrator.functions";

export const Route = createFileRoute("/_authenticated/admin/orchestrator")({
  head: () => ({ meta: [{ title: "Orchestrator — Aether admin" }, { name: "robots", content: "noindex" }] }),
  component: Page,
});

function Page() {
  const queryClient = useQueryClient();
  const fetchHistory = useServerFn(getOrchestratorConfigHistory);
  const save = useServerFn(saveOrchestratorConfig);
  const activate = useServerFn(activateOrchestratorConfig);
  const { data: configs = [], isLoading } = useQuery({ queryKey: ["admin-orchestrator-configs"], queryFn: () => fetchHistory({}) });
  const [text, setText] = useState(JSON.stringify({ intentConfidenceThreshold: 0.75, requireClarificationBelow: 0.55, contextBudgetPolicy: "relevance_first", defaultRiskLevel: "low", showPlanPreviewForRisk: "high", userProgressEnabled: true, traceAllActions: true }, null, 2));
  const [note, setNote] = useState("");
  const saveMutation = useMutation({ mutationFn: async () => save({ data: { config: JSON.parse(text), changeNote: note } }), onSuccess: () => { setNote(""); void queryClient.invalidateQueries({ queryKey: ["admin-orchestrator-configs"] }); } });
  const activateMutation = useMutation({ mutationFn: (configId: string) => activate({ data: { configId } }), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-orchestrator-configs"] }) });

  return <AdminShell><div className="animate-in-up space-y-6"><PageHeader eyebrow="Orchestrator" title="Control center" description="Administrator-only orchestration policy, version history and activation controls. Every configuration change is audited." backFallback="/admin" />
    <Panel className="space-y-4"><div><h2 className="text-sm font-semibold">Edit configuration</h2><p className="mt-1 text-xs text-muted-foreground">Changes are saved as a new version. Saving does not activate it.</p></div><textarea value={text} onChange={(e) => setText(e.target.value)} rows={15} className="w-full rounded-md border border-border bg-background p-3 font-mono text-xs outline-none focus:ring-1 focus:ring-primary" /><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Change note (recommended)" className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary" /><div className="flex items-center gap-2"><button type="button" disabled={saveMutation.isPending} onClick={() => { try { void saveMutation.mutateAsync(); } catch { /* mutation exposes error state */ } }} className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50">{saveMutation.isPending ? "Saving…" : "Save new version"}</button>{saveMutation.error ? <span className="text-xs text-destructive">Invalid JSON or save failed.</span> : null}</div></Panel>
    <Panel><div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">Configuration history</h2><p className="mt-1 text-xs text-muted-foreground">Only an administrator can activate a version.</p></div></div><div className="mt-4 space-y-2">{isLoading ? <p className="text-xs text-muted-foreground">Loading…</p> : configs.map((config: any) => <div key={config.id} className="rounded-md border border-border/60 p-3"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="text-xs font-medium">v{config.version}</span><Tag tone={config.status === "active" ? "success" : "neutral"}>{config.status}</Tag></div>{config.status !== "active" && <button type="button" disabled={activateMutation.isPending} onClick={() => void activateMutation.mutateAsync(config.id)} className="rounded-md border border-admin/25 px-3 py-1.5 text-xs hover:bg-admin/10">Activate</button>}</div><p className="mt-2 text-[11px] text-muted-foreground">{config.change_note || "No change note"} · {new Date(config.created_at).toLocaleString()}</p><pre className="mt-2 max-h-40 overflow-auto rounded bg-muted/40 p-2 text-[10px] text-muted-foreground">{JSON.stringify(config.config, null, 2)}</pre></div>)}</div></Panel>
  </div></AdminShell>;
}
