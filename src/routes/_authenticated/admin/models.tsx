import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Boxes } from "lucide-react";
import { AdminShell } from "@/components/layout/AdminShell";
import { PageHeader, Panel, Tag, StatCard, EmptyState } from "@/components/common/Primitives";
import { getAdminAaxIntelligence } from "@/lib/admin/aax-admin.functions";

export const Route = createFileRoute("/_authenticated/admin/models")({
  head: () => ({ meta: [{ title: "Aether Ascension — Admin" }, { name: "description", content: "AAX model registry, release state and real performance statistics." }, { name: "robots", content: "noindex" }] }),
  component: Page,
});

function Page() {
  const fetchAax = useServerFn(getAdminAaxIntelligence);
  const { data, isLoading } = useQuery({ queryKey: ["admin-aax-intelligence"], queryFn: () => fetchAax({}) });
  const models = data?.models ?? [];
  return <AdminShell><div className="animate-in-up space-y-6">
    <PageHeader eyebrow="AAX control plane" title="Aether Ascension" description="Admin-only control and observation of AAX generations, release lifecycle and real measured intelligence statistics. No fabricated performance values are shown." backFallback="/admin" />
    <div className="grid gap-3 sm:grid-cols-3"><StatCard label="AAX generations" value={isLoading ? "—" : String(models.length)} /><StatCard label="Available" value={isLoading ? "—" : String(models.filter((m) => m.release_status === "available" && (!m.available_at || new Date(m.available_at) <= new Date())).length)} /><StatCard label="Register entries loaded" value={isLoading ? "—" : String(data?.registerCount ?? 0)} /></div>
    {isLoading ? <Panel><p className="text-sm text-muted-foreground">Loading AAX intelligence…</p></Panel> : models.length === 0 ? <EmptyState title="No AAX generations" description="Register an Aether Ascension generation before training or releasing it." icon={<Boxes className="h-5 w-5" />} /> : <div className="grid gap-4 lg:grid-cols-2">{models.map((model) => <Panel key={model.id} className="space-y-4"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">{model.display_name}</h3><p className="mt-1 font-mono text-[10px] text-muted-foreground">{model.model_key} · generation {model.generation} · revision {model.revision}</p></div><Tag tone={model.release_status === "available" ? "success" : "neutral"}>{model.release_status}</Tag></div><p className="text-xs leading-relaxed text-muted-foreground">{model.description}</p><div className="flex flex-wrap gap-1.5">{model.capabilities.map((c) => <Tag key={c} tone="primary">{c}</Tag>)}</div><div className="grid grid-cols-2 gap-3 text-xs"><div><p className="text-muted-foreground">Provider</p><p className="mt-1 font-medium">{model.provider ?? "Not configured"}</p></div><div><p className="text-muted-foreground">Provider model</p><p className="mt-1 font-medium">{model.provider_model ?? "Not configured"}</p></div><div><p className="text-muted-foreground">Context</p><p className="mt-1 font-medium">{model.context_window.toLocaleString()}</p></div><div><p className="text-muted-foreground">Specializations</p><p className="mt-1 font-medium">{model.specializations.length || "None yet"}</p></div></div><div className="rounded-lg border border-border/60 bg-elevated/30 p-3"><p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Current measured statistics</p>{model.statistics.length === 0 ? <p className="mt-2 text-xs text-muted-foreground">No measured statistic exists yet. Aether will not invent one.</p> : <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">{model.statistics.slice().sort((a,b) => a.metric_key.localeCompare(b.metric_key)).map((stat) => <div key={stat.metric_key}><p className="text-[10px] capitalize text-muted-foreground">{stat.metric_key.replaceAll("_", " ")}</p><p className="font-mono text-sm tabular-nums">{stat.value}</p></div>)}</div>}</div><p className="text-[11px] text-muted-foreground">Historical register entries: {model.registerEntries.length}. The register is append-only and has no configured progression ceiling.</p></Panel>)}</div>}
  </div></AdminShell>;
}
