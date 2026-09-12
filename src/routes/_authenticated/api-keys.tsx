import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, Panel, Tag, EmptyState } from "@/components/common/Primitives";
import { Button } from "@/components/ui/button";
import { createMyZ2ApiKey, getMyZ2ApiKeySecret, listMyZ2ApiKeys, listMyZ2Models, revokeMyZ2ApiKey, rotateMyZ2ApiKey, suspendMyZ2ApiKey } from "@/lib/aether/phase-z2-api.functions";

export const Route = createFileRoute("/_authenticated/api-keys")({
  head: () => ({ meta: [{ title: "AAX API Keys — Aether" }, { name: "description", content: "Create and manage Aether Ascension Intelligence API keys." }] }),
  component: Page,
});

const environments = ["development", "test", "production"] as const;

function Page() {
  const qc = useQueryClient();
  const list = useServerFn(listMyZ2ApiKeys);
  const models = useServerFn(listMyZ2Models);
  const create = useServerFn(createMyZ2ApiKey);
  const recover = useServerFn(getMyZ2ApiKeySecret);
  const revoke = useServerFn(revokeMyZ2ApiKey);
  const suspend = useServerFn(suspendMyZ2ApiKey);
  const rotate = useServerFn(rotateMyZ2ApiKey);
  const { data: keys = [], isLoading } = useQuery({ queryKey: ["z2-api-keys"], queryFn: () => list({}) });
  const { data: modelList = [], isLoading: modelsLoading } = useQuery({ queryKey: ["z2-api-models"], queryFn: () => models({}) });
  const [name, setName] = useState("");
  const [applicationName, setApplicationName] = useState("");
  const [environment, setEnvironment] = useState<(typeof environments)[number]>("production");
  const [modelKey, setModelKey] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [allowWebResearch, setAllowWebResearch] = useState(false);
  const [allowStreaming, setAllowStreaming] = useState(true);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ["z2-api-keys"] });
  const make = async () => {
    setBusy(true);
    try {
      const chosen = modelKey || (modelList as any[])[0]?.model_key;
      if (!chosen) throw new Error("No released AAX model is currently available");
      const result = await create({ data: { name, applicationName, environment, modelKey: chosen, expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null, allowWebResearch, allowStreaming } });
      setNewKey(result.key);
      setName(""); setApplicationName(""); setExpiresAt("");
      await refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "AAX API key creation failed");
    } finally { setBusy(false); }
  };
  const action = async (fn: () => Promise<unknown>) => {
    try { await fn(); await refresh(); } catch (error) { alert(error instanceof Error ? error.message : "API key action failed"); }
  };
  const showSecret = async (keyId: string) => {
    try { const result = await recover({ data: { keyId } }); setNewKey(result.key); } catch (error) { alert(error instanceof Error ? error.message : "Unable to recover API key"); }
  };

  return <AppShell>
    <PageHeader eyebrow="Aether Ascension · Phase Z2" title="API Keys" description="Create credentials for external applications to use Aether intelligence without sharing your Aether session or provider credentials." backFallback="/dashboard" />
    <div className="mt-6 space-y-5">
      <Panel>
        <h2 className="text-sm font-semibold">Create AAX Intelligence API key</h2>
        <p className="mt-1 text-xs text-muted-foreground">Free accounts can keep up to 5 active AAX keys. Each key has its own model lock, application identity, environment, quota and rate limit.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input className="h-9 rounded-md border bg-background px-3 text-sm" value={name} onChange={(e) => setName(e.target.value)} placeholder="Key nickname" maxLength={120} />
          <input className="h-9 rounded-md border bg-background px-3 text-sm" value={applicationName} onChange={(e) => setApplicationName(e.target.value)} placeholder="Application name" maxLength={160} />
          <select className="h-9 rounded-md border bg-background px-3 text-sm" value={environment} onChange={(e) => setEnvironment(e.target.value as (typeof environments)[number])}>{environments.map((item) => <option key={item}>{item}</option>)}</select>
          <select className="h-9 rounded-md border bg-background px-3 text-sm" value={modelKey} onChange={(e) => setModelKey(e.target.value)} disabled={modelsLoading}>
            <option value="">{modelsLoading ? "Loading released AAX models…" : "Choose AAX model"}</option>
            {(modelList as any[]).map((model) => <option key={model.model_key} value={model.model_key}>{model.display_name ?? model.model_key} · {model.generation}.{model.revision}</option>)}
          </select>
          <input className="h-9 rounded-md border bg-background px-3 text-sm" type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground md:col-span-2">
            <label className="flex items-center gap-2"><input type="checkbox" checked={allowWebResearch} onChange={(e) => setAllowWebResearch(e.target.checked)} /> Allow authorized web research</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={allowStreaming} onChange={(e) => setAllowStreaming(e.target.checked)} /> Allow streaming</label>
          </div>
        </div>
        <Button className="mt-4" disabled={busy || !name.trim() || !applicationName.trim() || !((modelList as any[]).length)} onClick={() => void make()}>Generate AAX key</Button>
        {newKey ? <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3"><p className="text-xs font-semibold">AAX API secret</p><p className="mt-1 text-[11px] text-muted-foreground">This secret is recoverable later by the authorized account, including after revocation. Keep it private.</p><code className="mt-2 block break-all text-xs">{newKey}</code><Button className="mt-3" size="sm" variant="outline" onClick={() => void navigator.clipboard?.writeText(newKey)}>Copy secret</Button></div> : null}
      </Panel>

      <Panel>
        <div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold">Your AAX keys</h2><p className="mt-1 text-xs text-muted-foreground">View, recover, suspend, rotate or revoke credentials from this workspace.</p></div></div>
        {isLoading ? <p className="mt-4 text-sm text-muted-foreground">Loading API keys…</p> : keys.length === 0 ? <EmptyState title="No AAX API keys" description="Create a key to connect an external application to Aether intelligence." /> : <div className="mt-4 divide-y divide-border">{(keys as any[]).map((key) => {
          const usage = key.usage ?? {};
          const remaining = key.tokensRemaining;
          const status = key.status ?? (key.revoked_at ? "revoked" : "active");
          return <div key={key.id} className="py-4">
            <div className="flex flex-wrap items-start gap-3"><div className="min-w-0 flex-1"><p className="text-sm font-medium">{key.name}</p><p className="mt-1 font-mono text-[11px] text-muted-foreground">{key.key_prefix}•••• · {key.model_key} · {key.environment} · {key.application_name}</p><p className="mt-1 text-[11px] text-muted-foreground">Created {new Date(key.created_at).toLocaleString()} {key.last_used_at ? `· Last used ${new Date(key.last_used_at).toLocaleString()}` : "· Never used"}</p><p className="mt-1 text-[11px] text-muted-foreground">{key.unlimited_tokens ? "Unlimited tokens" : `${Number(key.monthly_token_limit).toLocaleString()} monthly tokens · ${Number(remaining ?? Math.max(0, Number(key.monthly_token_limit) - Number(usage.tokens_consumed ?? 0) - Number(usage.tokens_reserved ?? 0))).toLocaleString()} remaining`} · {Number(key.rate_limit_per_minute).toLocaleString()}/min</p></div><Tag tone={status === "active" ? "success" : status === "suspended" ? "warning" : "neutral"}>{status.toUpperCase()}</Tag></div>
            <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => void showSecret(key.id)}>View / copy secret</Button>{status === "active" ? <Button size="sm" variant="outline" onClick={() => void action(() => suspend({ data: { keyId: key.id, suspend: true } }))}>Suspend</Button> : status === "suspended" ? <Button size="sm" variant="outline" onClick={() => void action(() => suspend({ data: { keyId: key.id, suspend: false } }))}>Resume</Button> : null}{status !== "revoked" && <><Button size="sm" variant="outline" onClick={() => void action(async () => { const result = await rotate({ data: { keyId: key.id } }); setNewKey(result.key); })}>Rotate</Button><Button size="sm" variant="ghost" onClick={() => void action(() => revoke({ data: { keyId: key.id } }))}>Revoke</Button></>}</div>
          </div>;
        })}</div>}
      </Panel>
      <Panel><h2 className="text-sm font-semibold">Integration</h2><p className="mt-1 text-xs text-muted-foreground">External applications call <code className="font-mono text-primary">POST /api/v1/intelligence</code> with <code className="font-mono">Authorization: Bearer &lt;AAX key&gt;</code>. Aether keeps provider credentials, internal agents, memory and platform sessions behind the server boundary.</p></Panel>
    </div>
  </AppShell>;
}
