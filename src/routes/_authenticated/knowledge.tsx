import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Database, GitBranch, History, Pause, Play, RefreshCw, ShieldCheck, Timer, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState, PageHeader, Panel, StatCard, Tag } from "@/components/common/Primitives";
import { Button } from "@/components/ui/button";
import { useRoles } from "@/hooks/useRoles";
import { KnowledgeAcquisitionLauncher } from "@/components/common/KnowledgeAcquisitionLauncher";
import { KnowledgeAcquisitionConversation } from "@/components/common/KnowledgeAcquisitionConversation";
import {
  acquireKnowledgeCandidate,
  curateKnowledgeCandidate,
  getKnowledgeCandidate,
  listKnowledgeCandidates,
  publishKnowledgeCandidate,
  rollbackKnowledgeEntry,
  verifyKnowledgeCandidate,
} from "@/lib/aether/knowledge-curator.functions";
import {
  getProductionKnowledgeVersions,
  listProductionKnowledge,
} from "@/lib/aether/knowledge-production.functions";
import {
  adminCancelKnowledgeAcquisition,
  adminPauseKnowledgeAcquisition,
  adminResumeKnowledgeAcquisition,
  adminSetKnowledgeAcquisitionPriority,
  listKnowledgeAcquisitionJobs,
} from "@/lib/aether/knowledge-acquisition.functions";

export const Route = createFileRoute("/_authenticated/knowledge")({
  head: () => ({
    meta: [
      { title: "Knowledge — Aether" },
      { name: "description", content: "Acquire, verify, curate and version trusted Aether knowledge." },
    ],
  }),
  component: Page,
});

type Candidate = {
  id: string;
  title: string;
  content: string;
  status: string;
  freshness_state: string;
  confidence: number;
  verification_status: string;
  conflicts: unknown[];
  claims: unknown[];
  entities: unknown[];
  relations: unknown[];
  provenance: unknown;
  updated_at: string;
};
type Entry = {
  id: string;
  title: string;
  body: string;
  current_version: number;
  confidence: number;
  updated_at: string;
};
type Version = {
  id: string;
  version: number;
  title: string;
  body: string;
  change_type: string;
  change_note: string | null;
  created_at: string;
};

function Page() {
  const qc = useQueryClient();
  const { data: roles } = useRoles();
  const listCandidates = useServerFn(listKnowledgeCandidates);
  const getCandidate = useServerFn(getKnowledgeCandidate);
  const acquire = useServerFn(acquireKnowledgeCandidate);
  const curate = useServerFn(curateKnowledgeCandidate);
  const publish = useServerFn(publishKnowledgeCandidate);
  const listEntries = useServerFn(listProductionKnowledge);
  const listVersions = useServerFn(getProductionKnowledgeVersions);
  const rollback = useServerFn(rollbackKnowledgeEntry);
  const verify = useServerFn(verifyKnowledgeCandidate);
  const listAcquisitionJobs = useServerFn(listKnowledgeAcquisitionJobs);
  const adminPause = useServerFn(adminPauseKnowledgeAcquisition);
  const adminResume = useServerFn(adminResumeKnowledgeAcquisition);
  const adminCancel = useServerFn(adminCancelKnowledgeAcquisition);
  const adminPriority = useServerFn(adminSetKnowledgeAcquisitionPriority);

  const { data: candidates = [], isError: candidatesError } = useQuery({
    queryKey: ["phase-h-candidates"],
    queryFn: async () => {
      try {
        return (await listCandidates({ data: { status: "all" } })) as Candidate[];
      } catch (e) {
        console.error("[knowledge candidates]", e);
        return [];
      }
    },
    retry: 1,
  });

  const { data: entries = [], isError: entriesError } = useQuery({
    queryKey: ["phase-h-production"],
    queryFn: async () => {
      try {
        return (await listEntries({ data: {} })) as Entry[];
      } catch (e) {
        console.error("[knowledge production]", e);
        return [];
      }
    },
    retry: 1,
  });

  const [selected, setSelected] = useState<Candidate | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [content, setContent] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [adminBusyId, setAdminBusyId] = useState<string | null>(null);
  const [adminPriorityValue, setAdminPriorityValue] = useState("0");
  const [clockNow, setClockNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !candidates.length || selected) return;
    const params = new URLSearchParams(window.location.search);
    const candidateId = params.get("candidateId");
    const jobId = params.get("jobId");
    if (!candidateId) return;
    const candidate = candidates.find((item) => item.id === candidateId);
    if (candidate) {
      setSelected(candidate);
      setSelectedJobId(jobId);
    }
  }, [candidates, selected]);

  async function refresh() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["phase-h-candidates"] }),
      qc.invalidateQueries({ queryKey: ["phase-h-production"] }),
    ]);
  }

  async function openCandidate(candidate: Candidate) {
    setSelected(candidate);
    setSelectedJobId(typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("jobId") : null);
    setError("");
    try {
      const detail = await getCandidate({ data: { candidateId: candidate.id } });
      setSelected({ ...candidate, ...(detail.candidate as Candidate) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load candidate detail.");
    }
  }

  async function act(decision: "approve" | "reject" | "edit" | "request_verification") {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await curate({
        data: {
          candidateId: selected.id,
          decision,
          content: decision === "edit" ? content : undefined,
          title: selected.title,
          reason: decision === "approve" ? "Explicit curator approval." : undefined,
        },
      });
      setContent("");
      await refresh();
      setSelected(null);
      setSelectedJobId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Curator action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function publishSelected() {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await publish({ data: { candidateId: selected.id } });
      await refresh();
      setSelected(null);
      setSelectedJobId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publication failed.");
    } finally {
      setBusy(false);
    }
  }

  async function loadVersions(entry: Entry) {
    setSelectedEntry(entry);
    try {
      setVersions((await listVersions({ data: { entryId: entry.id } })) as Version[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load versions.");
    }
  }

  async function doRollback(version: number) {
    if (!selectedEntry || !window.confirm(`Rollback production knowledge to version ${version}?`)) return;
    setBusy(true);
    setError("");
    try {
      await rollback({
        data: {
          entryId: selectedEntry.id,
          version,
          reason: `Curator rollback to version ${version}.`,
        },
      });
      await refresh();
      await loadVersions(selectedEntry);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rollback failed.");
    } finally {
      setBusy(false);
    }
  }



  const { data: acquisitionJobs = [], isLoading: acquisitionLoading } = useQuery({
    queryKey: ["knowledge-acquisition-admin", Boolean(roles?.isAdmin)],
    enabled: Boolean(roles?.isAdmin),
    queryFn: () => listAcquisitionJobs({ data: { admin: true, limit: 100 } }),
    refetchInterval: 5000,
  });

  function remainingLabel(deadline: string | null, status: string | null) {
    if (!deadline || ["completed", "failed", "cancelled"].includes(status ?? "")) return "—";
    const remaining = Math.max(0, new Date(deadline).getTime() - clockNow);
    if (!remaining) return "expired";
    const totalSeconds = Math.floor(remaining / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return hours ? `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s` : `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  }

  async function adminAction(taskId: string, action: "pause" | "resume" | "cancel" | "priority", priority?: number) {
    setAdminBusyId(taskId);
    try {
      if (action === "pause") await adminPause({ data: { taskId } });
      if (action === "resume") await adminResume({ data: { taskId } });
      if (action === "cancel") await adminCancel({ data: { taskId } });
      if (action === "priority") await adminPriority({ data: { taskId, priority: Number(priority ?? 0) } });
      await qc.invalidateQueries({ queryKey: ["knowledge-acquisition-admin", true] });
    } finally {
      setAdminBusyId(null);
    }
  }

  async function verifySelected() {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await verify({ data: { candidateId: selected.id } });
      await refresh();
      const detail = await getCandidate({ data: { candidateId: selected.id } });
      setSelected({ ...selected, ...(detail.candidate as Candidate) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed.");
    } finally {
      setBusy(false);
    }
  }

  const counts = {
    candidates: candidates.filter((c) => ["candidate", "needs_review", "conflicted"].includes(c.status))
      .length,
    approved: candidates.filter((c) => c.status === "approved").length,
    published: entries.length,
    conflicts: candidates.filter((c) => c.status === "conflicted" || c.freshness_state === "stale")
      .length,
  };

  return (
    <AppShell>
      <PageHeader
        title="Knowledge"
        description="Acquire → Structure → Verify → Curate → Approve → Publish → Version. Production is never automatic."
        actions={
          <Button size="sm" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Refresh knowledge
          </Button>
        }
      />
      <div className="mt-4">
        <KnowledgeAcquisitionLauncher />
      </div>
      {roles?.isAdmin ? (
        <Panel className="mt-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Administrator acquisition control</h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Live control of every knowledge-acquisition mission. The countdown uses the persisted runtime deadline; pausing preserves the exact remaining budget.
              </p>
            </div>
            <Tag tone="primary">Admin</Tag>
          </div>
          <div className="mt-4 space-y-2">
            {acquisitionLoading ? <p className="text-xs text-muted-foreground">Loading acquisition missions…</p> : null}
            {!acquisitionLoading && acquisitionJobs.length === 0 ? <p className="text-xs text-muted-foreground">No acquisition missions recorded.</p> : null}
            {acquisitionJobs.map((job: any) => {
              const status = job.task_status ?? job.status;
              const terminal = ["completed", "failed", "cancelled"].includes(status);
              return (
                <div key={job.id} className="rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{job.title}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {job.source_type} · {job.source_count ?? 0} sources · {job.domain_count ?? 0} domains · progress {job.task_progress ?? 0}%
                      </p>
                    </div>
                    <div className="text-right">
                      <Tag tone={status === "running" ? "primary" : status === "waiting_approval" ? "success" : status === "failed" ? "danger" : "neutral"}>{status}</Tag>
                      <p className="mt-1 font-mono text-[11px] text-muted-foreground">{remainingLabel(job.deadline_at, status)}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {!terminal && status === "running" ? (
                      <Button size="sm" variant="outline" disabled={adminBusyId === job.task_id} onClick={() => void adminAction(job.task_id, "pause")}>
                        <Pause className="mr-1.5 h-3.5 w-3.5" />Pause
                      </Button>
                    ) : null}
                    {status === "paused" ? (
                      <Button size="sm" variant="outline" disabled={adminBusyId === job.task_id} onClick={() => void adminAction(job.task_id, "resume")}>
                        <Play className="mr-1.5 h-3.5 w-3.5" />Resume
                      </Button>
                    ) : null}
                    {!terminal ? (
                      <Button size="sm" variant="outline" disabled={adminBusyId === job.task_id} onClick={() => void adminAction(job.task_id, "cancel")}>
                        <X className="mr-1.5 h-3.5 w-3.5" />Cancel
                      </Button>
                    ) : null}
                    {!terminal ? (
                      <>
                        <span className="text-[10px] text-muted-foreground">Priority</span>
                        <input value={adminPriorityValue} onChange={(e) => setAdminPriorityValue(e.target.value)} className="h-8 w-16 rounded-md border bg-background px-2 text-xs" inputMode="numeric" />
                        <Button size="sm" variant="ghost" disabled={adminBusyId === job.task_id} onClick={() => void adminAction(job.task_id, "priority", Number(adminPriorityValue))}>Set</Button>
                      </>
                    ) : null}
                    <Button size="sm" variant="ghost" onClick={() => { setSelectedJobId(job.id); window.history.replaceState({}, "", `/knowledge?jobId=${job.id}`); }}>
                      Activity
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      ) : null}
      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        <StatCard label="Candidates" value={String(counts.candidates)} hint="Review queue" tone="warning" />
        <StatCard label="Approved" value={String(counts.approved)} hint="Ready for publication" tone="success" />
        <StatCard label="Production" value={String(counts.published)} hint="Trusted entries" tone="primary" />
        <StatCard
          label="Conflicts / stale"
          value={String(counts.conflicts)}
          hint="Requires curator attention"
          tone="neutral"
        />
      </div>
      {(candidatesError || entriesError) && (
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          Some knowledge data could not be loaded. The page remains usable when the backend is ready.
        </div>
      )}
      {error ? (
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          <Panel>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <div>
                <h2 className="text-sm font-semibold">Curator queue</h2>
                <p className="text-xs text-muted-foreground">
                  Candidate knowledge is isolated from production until an explicit approval gate passes.
                </p>
              </div>
            </div>
          </Panel>
          {candidates.length ? (
            candidates.map((candidate) => (
              <Panel key={candidate.id}>
                <button type="button" className="w-full text-left" onClick={() => void openCandidate(candidate)}>
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40 text-primary">
                      <Database className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Tag
                          tone={
                            candidate.status === "conflicted"
                              ? "warning"
                              : candidate.status === "approved"
                                ? "success"
                                : "primary"
                          }
                        >
                          {candidate.status}
                        </Tag>
                        <Tag>{candidate.verification_status}</Tag>
                        <Tag>{candidate.freshness_state}</Tag>
                        <Tag>confidence {Math.round(candidate.confidence * 100)}%</Tag>
                      </div>
                      <h3 className="mt-2 text-sm font-semibold">{candidate.title}</h3>
                      <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{candidate.content}</p>
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        Updated {new Date(candidate.updated_at).toLocaleString()} · {candidate.claims.length}{" "}
                        claims · {candidate.entities.length} entities · {candidate.relations.length} relations
                      </p>
                    </div>
                  </div>
                </button>
              </Panel>
            ))
          ) : (
            <EmptyState
              title="No knowledge candidates"
              description="Acquire verified material or use the acquisition pipeline to create the first candidate."
              icon={<Database className="h-5 w-5" />}
            />
          )}
          <Panel>
            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-primary" />
              <div>
                <h2 className="text-sm font-semibold">Production knowledge</h2>
                <p className="text-xs text-muted-foreground">
                  Only explicitly approved, verified, non-conflicted knowledge is published here.
                </p>
              </div>
            </div>
            {entries.length ? (
              <div className="mt-4 space-y-3">
                {entries.map((entry) => (
                  <div key={entry.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold">{entry.title}</h3>
                        <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{entry.body}</p>
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          v{entry.current_version} · confidence {Math.round(entry.confidence * 100)}% ·{" "}
                          {new Date(entry.updated_at).toLocaleString()}
                        </p>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => void loadVersions(entry)}>
                        <History className="mr-1.5 h-4 w-4" />
                        Versions
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-xs text-muted-foreground">No production knowledge has been published yet.</p>
            )}
          </Panel>
        </div>
        <div className="space-y-4">
          {selected ? (
            <>
            <Panel>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold">Candidate detail</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Full provenance and structured extraction are retained.
                  </p>
                </div>
                <Button size="icon" variant="ghost" onClick={() => { setSelected(null); setSelectedJobId(null); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-4 space-y-3">
                <div>
                  <Tag tone={selected.status === "conflicted" ? "warning" : "primary"}>{selected.status}</Tag>
                  <Tag>{selected.verification_status}</Tag>
                  <Tag>{selected.freshness_state}</Tag>
                </div>
                <h3 className="text-base font-semibold">{selected.title}</h3>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{selected.content}</p>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-md border p-2">
                    <b>{selected.claims.length}</b>
                    <br />
                    claims
                  </div>
                  <div className="rounded-md border p-2">
                    <b>{selected.entities.length}</b>
                    <br />
                    entities
                  </div>
                  <div className="rounded-md border p-2">
                    <b>{selected.relations.length}</b>
                    <br />
                    relations
                  </div>
                </div>
                {selected.conflicts.length ? (
                  <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-xs">
                    {selected.conflicts.map((c, i) => (
                      <p key={i}>• {JSON.stringify(c)}</p>
                    ))}
                  </div>
                ) : null}
                <details className="rounded-md border p-3">
                  <summary className="cursor-pointer text-xs font-medium">Provenance</summary>
                  <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-[10px] text-muted-foreground">
                    {JSON.stringify(selected.provenance, null, 2)}
                  </pre>
                </details>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Optional edited candidate content"
                  rows={5}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => void verifySelected()}
                    disabled={busy || selected.status === "published" || selected.status === "superseded"}
                  >
                    <ShieldCheck className="mr-1.5 h-4 w-4" />
                    Verify claims
                  </Button>
                  <Button
                    onClick={() => void act("approve")}
                    disabled={busy || selected.status !== "needs_review"}
                  >
                    <Check className="mr-1.5 h-4 w-4" />
                    Approve
                  </Button>
                  <Button variant="ghost" onClick={() => void act("reject")} disabled={busy}>
                    <X className="mr-1.5 h-4 w-4" />
                    Reject
                  </Button>
                  <Button variant="outline" onClick={() => void act("edit")} disabled={busy || !content.trim()}>
                    Save edit
                  </Button>
                  <Button variant="outline" onClick={() => void act("request_verification")} disabled={busy}>
                    Request verification
                  </Button>
                </div>
                {selected.status === "approved" ? (
                  <Button className="w-full" onClick={() => void publishSelected()} disabled={busy}>
                    <ShieldCheck className="mr-1.5 h-4 w-4" />
                    Publish to production
                  </Button>
                ) : null}
              </div>
            </Panel>
            {selectedJobId ? <KnowledgeAcquisitionConversation jobId={selectedJobId} /> : null}
            </>
          ) : (
            <Panel>
              <h2 className="text-sm font-semibold">Candidate detail</h2>
              <p className="mt-2 text-xs text-muted-foreground">
                Select a candidate to inspect claims, entities, relations, conflicts and provenance.
              </p>
            </Panel>
          )}
          {selectedEntry ? (
            <Panel>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold">Version history</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Rollback creates a new version; history is never overwritten.
                  </p>
                </div>
                <Button size="icon" variant="ghost" onClick={() => setSelectedEntry(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-4 space-y-3">
                {versions.map((version) => (
                  <div key={version.id} className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Tag>v{version.version}</Tag>
                      <span className="text-[10px] text-muted-foreground">{version.change_type}</span>
                    </div>
                    <p className="mt-2 text-sm">{version.body}</p>
                    {version.change_note ? (
                      <p className="mt-2 text-xs text-muted-foreground">{version.change_note}</p>
                    ) : null}
                    {version.version !== selectedEntry.current_version ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="mt-2"
                        disabled={busy}
                        onClick={() => void doRollback(version.version)}
                      >
                        Rollback to v{version.version}
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            </Panel>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
