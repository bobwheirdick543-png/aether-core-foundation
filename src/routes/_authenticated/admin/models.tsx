import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Boxes } from "lucide-react";
import { AdminShell } from "@/components/layout/AdminShell";
import { PageHeader, Panel, Tag, StatCard, EmptyState } from "@/components/common/Primitives";
import { getAdminModels } from "@/lib/admin/console.functions";

export const Route = createFileRoute("/_authenticated/admin/models")({
  head: () => ({ meta: [{ title: "AI models — Aether" }, { name: "description", content: "Aether model catalog, capabilities, routing state and measured productivity." }, { name: "robots", content: "noindex" }] }),
  component: Page,
});

function Page() {
  const fetchModels = useServerFn(getAdminModels);
  const { data, isLoading } = useQuery({ queryKey: ["admin-models"], queryFn: () => fetchModels({}) });
  const models = data?.models ?? [];
  return <AdminShell><div className="animate-in-up space-y-6"><PageHeader eyebrow="Model control plane" title="AI models" description="Every model role registered in Aether, including routing state and real measured productivity." backFallback="/admin" /><div className="grid gap-3 sm:grid-cols-3"><StatCard label="Models registered" value={isLoading ? "—" : String(models.length)} /><StatCard label="Available" value={isLoading ? "—" : String(models.filter((m) => m.status === "available").length)} /><StatCard label="Measured" value={isLoading ? "—" : String(models.filter((m) => m.productivity).length)} /></div>{isLoading ? <Panel><p className="text-sm text-muted-foreground">Loading model catalog…</p></Panel> : models.length === 0 ? <EmptyState title="No models registered" description="Model definitions will appear here when registered in the platform." icon={<Boxes className="h-5 w-5" />} /> : <div className="grid gap-4 lg:grid-cols-2">{models.map((model) => { const p = model.productivity ? Number(model.productivity.productivity_percent) : null; return <Panel key={model.role_key} className="space-y-4"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">{model.display_name}</h3><p className="mt-1 font-mono text-[11px] text-muted-foreground">{model.role_key}</p></div><Tag tone={model.status === "available" ? "success" : "neutral"}>{model.status}</Tag></div><p className="text-xs text-muted-foreground">{model.description}</p><div className="grid grid-cols-2 gap-3 text-xs"><div><p className="text-muted-foreground">Provider</p><p className="mt-1 font-medium">{model.provider ?? "Not configured"}</p></div><div><p className="text-muted-foreground">Provider model</p><p className="mt-1 font-medium">{model.provider_model ?? "Not configured"}</p></div><div><p className="text-muted-foreground">Context window</p><p className="mt-1 font-medium">{model.context_window.toLocaleString()}</p></div><div><p className="text-muted-foreground">Speed</p><p className="mt-1 font-medium">{model.speed}</p></div></div><div className="flex flex-wrap gap-1.5">{model.capabilities.map((capability) => <Tag key={capability} tone="primary">{capability}</Tag>)}</div><div className="space-y-1.5"><div className="flex justify-between text-[11px]"><span className="text-muted-foreground">Productivity</span><span>{p == null ? "No measured data" : `${p.toFixed(1)}%`}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${p == null ? 0 : Math.max(0, Math.min(100, p))}%` }} /></div></div></Panel>; })}</div>}</div></AdminShell>;
}
