import { createFileRoute, Link } from "@tanstack/react-router";
import { InfoPage } from "@/components/marketing/InfoPage";
import { API_SCOPES } from "@/lib/aether/api";
import { Tag } from "@/components/common/Primitives";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/developers")({
  head: () => ({ meta: [
    { title: "Developers — Aether AI Platform" },
    { name: "description", content: "Build external applications on the Aether Ascension Intelligence API with scoped, revocable credentials." },
    { property: "og:title", content: "Developers — Aether AI Platform" },
    { property: "og:description", content: "Connect external applications to Aether through the AAX Intelligence API." },
  ] }),
  component: DevelopersPage,
});

function DevelopersPage() {
  return <InfoPage eyebrow="Developers" title="Build on Aether" description="External applications connect to Aether through the Aether Ascension Intelligence API. Applications remain independent of Aether user sessions and receive only the capabilities authorized by their AAX API key.">
    <div className="space-y-4">
      <div className="panel p-5">
        <h3 className="text-sm font-semibold">AAX Intelligence API</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Send authenticated JSON requests to <code className="font-mono text-xs text-primary">/api/v1/intelligence</code>. Aether authenticates the AAX key, checks its model lock, permissions, quota, rate limit and lifecycle, executes the selected AAX model, validates the result and records durable request telemetry.</p>
        <pre className="mt-4 overflow-x-auto rounded-lg border bg-elevated/30 p-4 font-mono text-xs leading-relaxed text-muted-foreground">{`POST /api/v1/intelligence\nAuthorization: Bearer AAX-3.1-<64-character-secret>\nContent-Type: application/json\nIdempotency-Key: <unique-request-key>\n\n{\n  "model": "aax-3.1",\n  "messages": [{ "role": "user", "content": "Hello Aether" }]\n}`}</pre>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-5"><h3 className="text-sm font-semibold">Key lifecycle</h3><ul className="mt-4 space-y-3 text-sm text-muted-foreground"><li>Secrets are cryptographically random and stored as a hash plus encrypted recovery copy.</li><li>The full secret can be recovered later by the authorized owner, including after revocation.</li><li>Keys support active, suspended, revoked and expired states.</li><li>Rotation creates the replacement before revoking the old credential.</li><li>Requests are rate-limited, quota-accounted and durably audited.</li></ul><div className="mt-5 flex flex-wrap gap-2"><Tag tone="primary">REST / JSON</Tag><Tag>Idempotent</Tag><Tag>Audited</Tag></div></div>
        <div className="panel p-5"><h3 className="text-sm font-semibold">Capability boundary</h3><p className="mt-2 text-sm text-muted-foreground">An API key authorizes Aether capabilities; it never contains Aether intelligence, provider credentials or private platform secrets.</p><ul className="mt-4 space-y-2 text-xs text-muted-foreground"><li>• Model selection is locked to the key policy.</li><li>• Provider credentials stay server-side.</li><li>• Application and environment metadata are persisted.</li><li>• Web research and streaming are explicit policy controls.</li></ul></div>
      </div>
      <div className="panel p-5"><h3 className="text-sm font-semibold">Legacy scopes</h3><p className="mt-1 text-xs text-muted-foreground">These capabilities remain part of the existing Developer API foundation. AAX Z2 keys use the dedicated intelligence permission boundary.</p><ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{API_SCOPES.map((s) => <li key={s.scope} className="rounded border p-2 text-xs"><code className="font-mono text-primary">{s.scope}</code><span className="ml-2 text-muted-foreground">{s.label}</span></li>)}</ul></div>
      <div className="flex flex-wrap gap-3"><Button asChild variant="outline"><Link to="/docs">API documentation</Link></Button><Button asChild><Link to="/login" search={{ redirect: "/api-keys" }}>Open AAX API keys</Link></Button></div>
    </div>
  </InfoPage>;
}
