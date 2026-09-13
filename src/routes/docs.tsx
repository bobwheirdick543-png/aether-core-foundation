import { createFileRoute, Link } from "@tanstack/react-router";
import { InfoPage } from "@/components/marketing/InfoPage";
import { PLATFORM_LAYERS, ORCHESTRATOR_PIPELINE } from "@/lib/aether/orchestrator";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "Documentation — Aether AI Platform" },
      { name: "description", content: "Architecture and Aether Ascension Intelligence API reference." },
    ],
  }),
  component: DocsPage,
});

function DocsPage() {
  return (
    <InfoPage
      eyebrow="Documentation · Z2 / Z3"
      title="Architecture reference"
      description="Aether separates its platform runtime, AAX intelligence, agents, knowledge and external integrations behind explicit authorization and durable persistence."
    >
      <div className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="panel p-5">
            <h3 className="text-sm font-semibold">Platform layers</h3>
            <ol className="mt-4 space-y-2">
              {PLATFORM_LAYERS.map((layer, i) => (
                <li key={layer} className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="font-mono text-[11px] text-primary">{String(i + 1).padStart(2, "0")}</span>
                  {layer}
                </li>
              ))}
            </ol>
          </div>
          <div className="panel p-5">
            <h3 className="text-sm font-semibold">Orchestration pipeline</h3>
            <ol className="mt-4 space-y-2">
              {ORCHESTRATOR_PIPELINE.map((s) => (
                <li key={s.key} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    {s.implemented ? "implemented" : "integration pending"}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="panel p-5">
          <h3 className="text-sm font-semibold">AAX Intelligence API (Phase Z2)</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            External applications use Aether-issued AAX credentials at{" "}
            <code className="font-mono text-xs text-primary">POST /api/v1/intelligence</code>. Keys are model-locked,
            capability-scoped, rate-limited, quota-accounted, idempotency-aware and durably audited. Provider credentials
            remain server-side.
          </p>
          <pre className="mt-4 overflow-x-auto rounded-lg border bg-elevated/30 p-4 font-mono text-xs text-muted-foreground">{`Authorization: Bearer AAX-<generation>.<revision>-<64-character-secret>
Content-Type: application/json
Idempotency-Key: <unique-request-key>

{ "model": "<locked AAX model>", "messages": [{ "role": "user", "content": "..." }] }`}</pre>
        </div>

        <div className="panel p-5">
          <h3 className="text-sm font-semibold">Part 9B — Live agent work (Phase Z3)</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Live activity panels show <strong>current stage</strong> and <strong>current agent</strong> as separate
            concepts, plus timeline events from durable task runs. Events are emitted only when the runtime actually
            performs work (handoffs, tools, waits, failures). The UI does not invent progress.
          </p>
        </div>

        <div className="panel p-5">
          <h3 className="text-sm font-semibold">Non-negotiable rules</h3>
          <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
            <li>• Advertised capabilities must have real backend paths, persistence and authorization.</li>
            <li>• Knowledge never auto-publishes to production without explicit approval.</li>
            <li>• API surfaces must not mark routes LIVE unless they are executable.</li>
            <li>• Secrets and provider credentials never render in the browser.</li>
          </ul>
        </div>

        <div className="panel p-5">
          <h3 className="text-sm font-semibold">Idempotency</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            A supplied Idempotency-Key is bound to the SHA-256 hash of the complete request body for the authenticated
            API key. The same key with a different body returns{" "}
            <code className="font-mono">409 idempotency_conflict</code>. Identical completed requests can be replayed.
          </p>
        </div>

        <div className="panel p-5">
          <h3 className="text-sm font-semibold">Streaming status</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            External streaming is not currently exposed by the published Z2 API. It will not be advertised until
            cancellation, quota finalization, audit completion, timeout/error handling and termination semantics are
            implemented end-to-end.
          </p>
        </div>

        <div className="panel p-5">
          <h3 className="text-sm font-semibold">Knowledge governance</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Research is evidence acquisition. Candidate knowledge is verified before production publication. Approved
            knowledge remains traceable to its sources and versions; it is not silently treated as model retraining.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link to="/developers">Developer guide</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/agents-overview">Agents architecture</Link>
          </Button>
          <Button asChild>
            <Link to="/login" search={{ redirect: "/api-keys" }}>
              Open AAX API workspace
            </Link>
          </Button>
        </div>
      </div>
    </InfoPage>
  );
}
