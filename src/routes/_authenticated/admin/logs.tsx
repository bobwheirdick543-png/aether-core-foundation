import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell } from "@/components/layout/AdminShell";
import { PageHeader, Panel, Tag } from "@/components/common/Primitives";
import { getPhaseULogs } from "@/lib/admin/phase-u-logs.functions";

export const Route = createFileRoute("/_authenticated/admin/logs")({
  head: () => ({
    meta: [
      { title: "Logs — Aether" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

function Page() {
  const load = useServerFn(getPhaseULogs);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["phase-u-logs"],
    queryFn: async () => {
      try {
        return await load({});
      } catch (e) {
        console.error("[admin/logs]", e);
        return { audit: [], runtime: [], api: [] };
      }
    },
    refetchInterval: 15000,
    retry: 1,
  });

  const empty = { audit: [], runtime: [], api: [] };
  const safe = data ?? empty;

  return (
    <AdminShell>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Observability"
          title="Logs"
          description="Structured audit, runtime and API events with secrets and task payloads excluded from this view."
          backFallback="/admin"
        />
        {isError && (
          <Panel>
            <p className="text-sm text-destructive">Some log streams could not be loaded.</p>
            <p className="mt-1 text-xs text-muted-foreground">The page remains open; data appears when the backend is ready.</p>
          </Panel>
        )}
        {isLoading ? (
          <Panel>
            <p className="text-sm text-muted-foreground">Loading logs…</p>
          </Panel>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            <LogPanel
              title="Audit"
              rows={(safe.audit ?? []).map((x: any) => ({
                id: x.id,
                time: x.created_at,
                title: x.action,
                detail: `${x.target_type ?? "—"} ${x.target_id ?? ""}`,
                tone: "neutral" as const,
              }))}
            />
            <LogPanel
              title="Runtime"
              rows={(safe.runtime ?? []).map((x: any) => ({
                id: x.id,
                time: x.created_at,
                title: x.event_type,
                detail: `${x.from_status ?? ""} → ${x.to_status ?? ""} · ${x.message ?? ""}`,
                tone: (x.to_status === "failed" ? "danger" : "neutral") as "danger" | "neutral",
              }))}
            />
            <LogPanel
              title="API"
              rows={(safe.api ?? []).map((x: any) => ({
                id: x.id,
                time: x.created_at,
                title: `${x.method} ${x.path}`,
                detail: `${x.status_code ?? "—"} · ${x.latency_ms ?? 0}ms · ${x.request_id ?? ""}`,
                tone: (Number(x.status_code) >= 400 ? "danger" : "neutral") as "danger" | "neutral",
              }))}
            />
          </div>
        )}
      </div>
    </AdminShell>
  );
}

function LogPanel({
  title,
  rows,
}: {
  title: string;
  rows: { id: string; time: string; title: string; detail: string; tone: "danger" | "neutral" }[];
}) {
  return (
    <Panel className="space-y-0 p-0">
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-[11px] text-muted-foreground">{rows.length} recent events</p>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-4 text-xs text-muted-foreground">No events recorded.</p>
      ) : (
        rows.slice(0, 60).map((r) => (
          <div key={r.id} className="border-b border-border/40 px-4 py-3 last:border-0">
            <div className="flex items-start justify-between gap-2">
              <p className="break-all text-xs font-medium">{r.title}</p>
              <Tag tone={r.tone}>{r.tone === "danger" ? "error" : "event"}</Tag>
            </div>
            <p className="mt-1 break-all text-[10px] text-muted-foreground">{r.detail}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">{new Date(r.time).toLocaleString()}</p>
          </div>
        ))
      )}
    </Panel>
  );
}
