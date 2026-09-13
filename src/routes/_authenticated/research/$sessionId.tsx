import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, AlertTriangle, CheckCircle2, Link2, Search } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, Panel, Tag, EmptyState } from "@/components/common/Primitives";
import { getMyResearchSession } from "@/lib/aether/research.functions";

export const Route = createFileRoute("/_authenticated/research/$sessionId")({
  head: () => ({ meta: [{ title: "Research Session — Aether" }] }),
  component: Page,
});

/** PDF Phase F + Part 9B — stage vs agent separated; stages from durable state only */
const RESEARCH_STAGES = [
  { key: "queued", label: "Queued" },
  { key: "planning", label: "Planning" },
  { key: "searching", label: "Source search" },
  { key: "retrieving", label: "Retrieval" },
  { key: "comparing", label: "Comparison" },
  { key: "verification", label: "Verification" },
  { key: "complete", label: "Complete" },
] as const;

function stageIndex(status: string, sourceCount: number, planCount: number, comparisonCount: number): number {
  const s = (status || "").toLowerCase();
  if (s === "completed" || s === "complete") return 6;
  if (s === "failed" || s === "cancelled") return Math.max(0, sourceCount > 0 ? 3 : planCount > 0 ? 1 : 0);
  if (s === "verifying" || comparisonCount > 0) return 5;
  if (s === "running" && sourceCount > 0) return 3;
  if (s === "running" && planCount > 0) return 2;
  if (s === "running" || s === "processing") return 2;
  if (s === "queued" || s === "scheduled") return 0;
  if (planCount > 0) return 1;
  return 0;
}

function ProgressiveStages({
  status,
  sourceCount,
  planCount,
  comparisonCount,
}: {
  status: string;
  sourceCount: number;
  planCount: number;
  comparisonCount: number;
}) {
  const active = stageIndex(status, sourceCount, planCount, comparisonCount);
  return (
    <Panel className="space-y-3">
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Live research stages (Part 9B)</h2>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Stages are derived from persisted session state only — not fabricated. Current stage and agent work remain separate concepts.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {RESEARCH_STAGES.map((stage, i) => (
          <span
            key={stage.key}
            className={`rounded-md px-2 py-1 text-[10px] font-medium ${
              i < active
                ? "bg-primary/20 text-primary"
                : i === active
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {stage.label}
          </span>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Current stage: <span className="font-medium text-foreground">{RESEARCH_STAGES[active]?.label}</span>
        {" · "}Status: <span className="font-medium text-foreground">{status}</span>
      </p>
    </Panel>
  );
}

function Page() {
  const { sessionId } = Route.useParams();
  const load = useServerFn(getMyResearchSession);
  const { data, isLoading, error } = useQuery({
    queryKey: ["my-research-session", sessionId],
    queryFn: async () => {
      try {
        return await load({ data: { sessionId } });
      } catch (e) {
        console.error("[research-session]", e);
        throw e;
      }
    },
    retry: 1,
  });

  if (isLoading)
    return (
      <AppShell>
        <Panel>Loading research session…</Panel>
      </AppShell>
    );
  if (error || !data)
    return (
      <AppShell>
        <EmptyState
          title="Research session not found"
          description="This session is unavailable to the current account or project."
          icon={<AlertTriangle className="h-5 w-5" />}
        />
      </AppShell>
    );

  const { session, sources, plans, comparisons } = data as any;

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title={session.query}
          description="Durable native research session reconstructed from persisted state."
          backFallback="/research"
        />
        <div className="grid gap-3 sm:grid-cols-4">
          <Panel>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</p>
            <div className="mt-2">
              <Tag
                tone={
                  session.status === "completed"
                    ? "success"
                    : session.status === "failed"
                      ? "danger"
                      : "neutral"
                }
              >
                {session.status}
              </Tag>
            </div>
          </Panel>
          <Panel>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Sources</p>
            <p className="mt-2 font-mono text-xl">{sources.length}</p>
          </Panel>
          <Panel>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Domains</p>
            <p className="mt-2 font-mono text-xl">{new Set(sources.map((s: any) => s.domain)).size}</p>
          </Panel>
          <Panel>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Last event</p>
            <p className="mt-2 text-xs">
              {session.last_event_at ? new Date(session.last_event_at).toLocaleString() : "—"}
            </p>
          </Panel>
        </div>

        <ProgressiveStages
          status={session.status}
          sourceCount={sources.length}
          planCount={plans.length}
          comparisonCount={comparisons.length}
        />

        <Panel>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Search className="h-4 w-4" />
            Research plan
          </h2>
          <div className="mt-4 space-y-3">
            {plans.length ? (
              plans.map((plan: any) => (
                <div key={plan.id} className="rounded-md border border-border/60 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-medium">{plan.strategy}</span>
                    <Tag tone={plan.status === "completed" ? "success" : "neutral"}>{plan.status}</Tag>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Queries: {Array.isArray(plan.queries) ? plan.queries.length : 0} · Unmet requirements:{" "}
                    {Array.isArray(plan.unmet_requirements) ? plan.unmet_requirements.length : 0}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No persisted plan.</p>
            )}
          </div>
        </Panel>

        <Panel>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Link2 className="h-4 w-4" />
            Sources and provenance
          </h2>
          <div className="mt-4 space-y-3">
            {sources.length ? (
              sources.map((source: any) => (
                <div key={source.id} className="rounded-md border border-border/60 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{source.title ?? source.url}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {source.domain} · {source.provider} · {source.change_state ?? "new"}
                      </p>
                    </div>
                    <Tag tone={source.status === "retrieved" ? "success" : "danger"}>{source.status}</Tag>
                  </div>
                  <p className="mt-2 break-all text-[11px] text-muted-foreground">Requested: {source.url}</p>
                  <p className="break-all text-[11px] text-muted-foreground">
                    Canonical: {source.canonical_url ?? source.url}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                    <span>Hash: {source.content_hash ? source.content_hash.slice(0, 16) : "—"}</span>
                    <span>Attempts: {source.retrieval_attempts ?? 1}</span>
                    <span>Quality: {source.quality_score ?? "—"}</span>
                    <span>Freshness: {source.stale_reason ?? "fresh"}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No sources persisted.</p>
            )}
          </div>
        </Panel>

        <Panel>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <CheckCircle2 className="h-4 w-4" />
            Controlled comparisons
          </h2>
          <div className="mt-4 space-y-3">
            {comparisons.length ? (
              comparisons.map((comparison: any) => (
                <div key={comparison.id} className="rounded-md border border-border/60 p-3">
                  <p className="text-sm font-medium">{comparison.subject}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Missing evidence: {comparison.missing_evidence?.length ?? 0} · Uncertainty:{" "}
                    {comparison.uncertainty?.length ?? 0}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No comparison has been persisted for this session.</p>
            )}
          </div>
        </Panel>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Activity className="h-3.5 w-3.5" />
          This page is reconstructed from durable research state; leaving the browser does not terminate the underlying
          runtime task.
        </div>
      </div>
    </AppShell>
  );
}
