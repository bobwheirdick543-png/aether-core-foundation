import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, Panel, StatCard, Tag } from "@/components/common/Primitives";
import { listMyDeveloperApiKeys, listMyApiLogs, listMyApiWebhooks } from "@/lib/aether/developer-api.functions";
import { AlertTriangle, KeyRound } from "lucide-react";

export const Route = createFileRoute("/_authenticated/developer-api")({
  head: () => ({
    meta: [
      { title: "Developer API — Aether" },
      { name: "description", content: "Aether Developer API dashboard, usage, logs and webhooks." },
    ],
  }),
  component: Page,
});

function Page() {
  const keysFn = useServerFn(listMyDeveloperApiKeys);
  const logsFn = useServerFn(listMyApiLogs);
  const hooksFn = useServerFn(listMyApiWebhooks);

  const keysQuery = useQuery({
    queryKey: ["developer-api-keys"],
    queryFn: async () => {
      try {
        return await keysFn({});
      } catch (e) {
        console.error("[developer-api] keys failed", e);
        return [];
      }
    },
    retry: 1,
  });

  const logsQuery = useQuery({
    queryKey: ["developer-api-logs"],
    queryFn: async () => {
      try {
        return await logsFn({});
      } catch (e) {
        console.error("[developer-api] logs failed", e);
        return [];
      }
    },
    retry: 1,
  });

  const hooksQuery = useQuery({
    queryKey: ["developer-api-webhooks"],
    queryFn: async () => {
      try {
        return await hooksFn({});
      } catch (e) {
        console.error("[developer-api] webhooks failed", e);
        return [];
      }
    },
    retry: 1,
  });

  const k = keysQuery.data ?? [];
  const l = logsQuery.data ?? [];
  const w = hooksQuery.data ?? [];

  const active = k.filter((x: any) => !x.revoked_at).length;
  const errors = l.filter((x: any) => Number(x.status_code) >= 400).length;

  const anyError = keysQuery.isError || logsQuery.isError || hooksQuery.isError;
  const stillLoading = keysQuery.isLoading || logsQuery.isLoading || hooksQuery.isLoading;

  return (
    <AppShell>
      <PageHeader
        title="Developer API"
        description="Build external applications on Aether through the versioned /api/v1/ interface."
        backFallback="/dashboard"
      />

      <div className="mt-4">
        <Link
          to="/api-keys"
          className="inline-flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/15"
        >
          <KeyRound className="h-3.5 w-3.5" />
          Open AAX Intelligence API Keys (create / rotate / policy)
        </Link>
      </div>

      {anyError && (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-destructive">Some Developer API data could not be loaded</p>
            <p className="mt-1 text-xs text-muted-foreground">
              The page is still usable. This usually means the backend tables or permissions are not fully ready yet.
              You can continue — keys, logs and webhooks will appear once the backend is connected.
            </p>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Active keys" value={stillLoading ? "…" : String(active)} hint="Scoped credentials" tone="primary" />
        <StatCard label="API requests" value={stillLoading ? "…" : String(l.length)} hint="Latest 200 requests" />
        <StatCard label="Errors" value={stillLoading ? "…" : String(errors)} hint="HTTP 4xx/5xx in latest log window" />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel>
          <h2 className="text-sm font-semibold">API surface</h2>
          <div className="mt-3 grid gap-2 text-xs">
            {[
              "/v1/auth",
              "/v1/projects",
              "/v1/conversations",
              "/v1/tasks",
              "/v1/runs",
              "/v1/agents",
              "/v1/orchestration",
              "/v1/memory",
              "/v1/research",
              "/v1/knowledge",
              "/v1/reports",
              "/v1/notifications",
              "/v1/schedules",
              "/v1/modules",
              "/v1/battleversia",
              "/v1/webhooks",
              "/v1/logs",
              "/v1/intelligence",
            ].map((x) => (
              <div key={x} className="flex items-center justify-between rounded-md border px-3 py-2">
                <code>{x}</code>
                <Tag tone="success">LIVE</Tag>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <h2 className="text-sm font-semibold">Webhooks</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Durable webhook registrations are stored per owner/project. Secrets are only returned at creation.
          </p>
          <div className="mt-3 space-y-2">
            {w.length ? (
              w.map((x: any) => (
                <div key={x.id} className="rounded-md border p-3 text-xs">
                  <div className="flex justify-between gap-2">
                    <code className="truncate">{x.url}</code>
                    <Tag>{x.active ? "ACTIVE" : "PAUSED"}</Tag>
                  </div>
                  <p className="mt-1 text-muted-foreground">{(x.events ?? []).join(" · ")}</p>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">No webhooks registered.</p>
            )}
          </div>
        </Panel>
      </div>

      <Panel className="mt-5">
        <h2 className="text-sm font-semibold">Recent API activity</h2>
        <div className="mt-3 divide-y divide-border">
          {l.slice(0, 20).map((x: any) => (
            <div key={x.id} className="grid grid-cols-[70px_1fr_60px] gap-3 py-2 text-xs">
              <span>{x.method}</span>
              <code className="truncate">{x.path}</code>
              <span className={Number(x.status_code) >= 400 ? "text-destructive" : "text-muted-foreground"}>
                {x.status_code ?? "—"}
              </span>
            </div>
          ))}
          {!l.length && <p className="text-xs text-muted-foreground">No API activity yet.</p>}
        </div>
      </Panel>
    </AppShell>
  );
}
