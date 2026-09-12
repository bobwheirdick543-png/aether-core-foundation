import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { InfoPage } from "@/components/marketing/InfoPage";
import { PLATFORM_LAYERS, ORCHESTRATOR_PIPELINE } from "@/lib/aether/orchestrator";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/docs")({
  head: () => ({ meta: [
    { title: "Documentation — Aether AI Platform" },
    { name: "description", content: "Architecture and Aether Ascension Intelligence API reference." },
    { property: "og:title", content: "Documentation — Aether AI Platform" },
    { property: "og:description", content: "Architecture reference for the Aether AI platform and its external intelligence boundary." },
  ] }),
  component: DocsPage,
});

function DocsPage() {
  return <InfoPage eyebrow="Documentation" title="Architecture reference" description="Aether separates its platform runtime, model layer, agents, knowledge and external integrations behind explicit authorization and durable persistence.">
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-5"><h3 className="text-sm font-semibold">Platform layers</h3><ol className="mt-4 space-y-2">{PLATFORM_LAYERS.map((layer, i) => <li key={layer} className="flex items-center gap-3 text-sm text-muted-foreground"><span className="font-mono text-[11px] text-primary">{String(i + 1).padStart(2, "0")}</span>{layer}</li>)}</ol></div>
        <div className="panel p-5"><h3 className="text-sm font-semibold">Request pipeline</h3><ol className="mt-4 space-y-2">{ORCHESTRATOR_PIPELINE.map((s) => <li key={s.key} className="flex items-center justify-between gap-3 text-sm"><span className="text-muted-foreground">{s.label}</span><span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{s.implemented ? "ready" : "integration pending"}</span></li>)}</ol></div>
      </div>
      <div className="panel p-5"><h3 className="text-sm font-semibold">AAX Intelligence API</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">External applications use Aether-issued AAX credentials at <code className="font-mono text-xs text-primary">POST /api/v1/intelligence</code>. Keys are scoped to an AAX model policy, rate-limited, quota-accounted, idempotency-aware and durably audited. Provider credentials remain server-side.</p><pre className="mt-4 overflow-x-auto rounded-lg border bg-elevated/30 p-4 font-mono text-xs text-muted-foreground">{`Authorization: Bearer AAX-3.1-<64-character-secret>\nContent-Type: application/json\n\n{ "model": "aax-3.1", "messages": [{ "role": "user", "content": "..." }] }`}</pre></div>
      <div className="panel p-5"><h3 className="text-sm font-semibold">Knowledge governance</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Research is evidence acquisition. Candidate knowledge is verified before production publication. Approved knowledge remains traceable to its sources and versions; it is not silently treated as model retraining.</p></div>
      <div className="flex flex-wrap gap-3"><Button asChild variant="outline"><Link to="/developers">Developer guide</Link></Button><Button asChild><Link to="/login" search={{ redirect: "/api-keys" }}>Open AAX API workspace</Link></Button></div>
    </div>
  </InfoPage>;
}
