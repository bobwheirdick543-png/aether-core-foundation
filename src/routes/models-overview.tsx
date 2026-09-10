import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader, SiteFooter } from "@/components/layout/SiteChrome";
import { Section } from "@/components/marketing/Sections";
import { Tag } from "@/components/common/Primitives";
import { formatContext } from "@/lib/aether/models";
import { listPublicAaxModels } from "@/lib/aether/aax-catalog.functions";

export const Route = createFileRoute("/models-overview")({ head: () => ({ meta: [
  { title: "Aether Ascension (AAX) — Aether AI Platform" },
  { name: "description", content: "Aether Ascension is Aether's evolving unified model family. New generations share Aether knowledge while gaining greater capabilities and specializations." },
  { property: "og:title", content: "Aether Ascension (AAX) — Aether AI Platform" },
  { property: "og:description", content: "Explore the Aether Ascension model family and its evolving generations." },
] }), component: ModelsOverview });

function ModelsOverview() {
  const loadModels = useServerFn(listPublicAaxModels);
  const { data: models = [], isLoading, error } = useQuery({ queryKey: ["public-aax-catalogue"], queryFn: () => loadModels({}) });
  return <div className="min-h-screen bg-background"><SiteHeader /><Section eyebrow="Aether Ascension · AAX" title="One evolving intelligence family" description="AAX generations are versions of the same Aether intelligence, not isolated specialist AIs. They share Aether's universal knowledge ecosystem and can develop model-specific specializations." className="border-t-0">
    <div className="mb-8 rounded-xl border border-border/70 bg-surface/40 p-5"><p className="text-sm leading-relaxed text-muted-foreground">Upcoming generations can be visible before release. Availability is enforced server-side; a scheduled or draft AAX cannot be used before its approved release moment.</p></div>
    {error ? <div className="rounded-xl border border-destructive/30 p-5 text-sm text-destructive">The AAX catalogue is temporarily unavailable.</div> : isLoading ? <div className="rounded-xl border border-border/70 p-5 text-sm text-muted-foreground">Loading AAX catalogue…</div> : models.length === 0 ? <div className="rounded-xl border border-border/70 p-5 text-sm text-muted-foreground">No public AAX generations have been announced yet.</div> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{models.map((m) => <div key={m.model_key} className="panel flex h-full flex-col p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">{m.display_name}</h3><p className="mt-1 font-mono text-[10px] text-muted-foreground">Generation {m.generation} · Revision {m.revision}</p></div><Tag>{m.release_status}</Tag></div><p className="mt-3 flex-1 text-sm text-muted-foreground">{m.description}</p><ul className="mt-4 flex flex-wrap gap-1.5">{(m.capabilities ?? []).map((c) => <li key={c}><Tag tone="primary">{c}</Tag></li>)}</ul><p className="mt-4 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{formatContext(m.context_window)}{m.output_limit ? ` · ${m.output_limit.toLocaleString()} max output` : ""}</p>{(m.specializations ?? []).length > 0 ? <p className="mt-2 text-xs text-muted-foreground">Specializations: {m.specializations.join(", ")}</p> : null}</div>)}</div>}
  </Section><SiteFooter /></div>;
}
