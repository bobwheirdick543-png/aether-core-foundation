import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Clock3, FileText, MessageSquare, Pause, Play, Rocket, ShieldCheck, XCircle } from "lucide-react";
import { AdminShell } from "@/components/layout/AdminShell";
import { PageHeader, Panel, PhaseNote, Tag } from "@/components/common/Primitives";
import { Button } from "@/components/ui/button";
import {
  listKnowledgeAcquisitionJobs,
  adminPauseKnowledgeAcquisition,
  adminResumeKnowledgeAcquisition,
} from "@/lib/aether/knowledge-acquisition.functions";
import {
  adminStartKnowledgeAcquisitionNow,
  adminCancelKnowledgeAcquisition,
} from "@/lib/aether/knowledge-acquisition-admin.functions";
import {
  getKnowledgeCandidate,
  curateKnowledgeCandidate,
  publishKnowledgeCandidate,
} from "@/lib/aether/knowledge-curator.functions";
import { getReportDownloadUrl } from "@/lib/aether/report.functions";

export const Route = createFileRoute("/_authenticated/admin/knowledge-acquisition")({
  head: () => ({
    meta: [
      { title: "Knowledge Acquisition — Aether" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

function Page() {
  const qc = useQueryClient();
  const load = useServerFn(listKnowledgeAcquisitionJobs);
  const pause = useServerFn(adminPauseKnowledgeAcquisition);
  const resume = useServerFn(adminResumeKnowledgeAcquisition);
  const startNow = useServerFn(adminStartKnowledgeAcquisitionNow);
  const cancel = useServerFn(adminCancelKnowledgeAcquisition);
  const candidateFn = useServerFn(getKnowledgeCandidate);
  const curate = useServerFn(curateKnowledgeCandidate);
  const publish = useServerFn(publishKnowledgeCandidate);
  const reportUrl = useServerFn(getReportDownloadUrl);

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["knowledge-acquisition-admin"],
    queryFn: () => load({ data: { admin: true, limit: 100 } }) as Promise<any[]>,
    refetchInterval: 2000,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [serverClockOffsetMs, setServerClockOffsetMs] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  function remainingLabel(deadline: string | null, status: string | null) {
    if (!deadline || ["completed", "failed", "cancelled"].includes(status ?? "")) return "—";
    const remaining = Math.max(0, new Date(deadline).getTime() - (clockNow + serverClockOffsetMs));
    if (!remaining) return "expired";
    const totalSeconds = Math.floor(remaining / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return hours ? hours + "h " + String(minutes).padStart(2, "0") + "m " + String(seconds).padStart(2, "0") + "s" : String(minutes).padStart(2, "0") + "m " + String(seconds).padStart(2, "0") + "s";
  }

  useEffect(() => {
    const sample = jobs.find((job: any) => Number.isFinite(Number(job.server_now)));
    if (sample) setServerClockOffsetMs(Number(sample.server_now) - Date.now());
  }, [jobs]);

  const selected = useMemo(() => jobs.find((j) => j.id === selectedId) ?? null, [jobs, selectedId]);

  useEffect(() => {
    if (typeof window === "undefined" || !jobs.length || selectedId) return;
    const params = new URLSearchParams(window.location.search);
    const jobId = params.get("jobId");
    const candidateId = params.get("candidateId");
    const job = jobId
      ? jobs.find((item) => item.id === jobId || item.task_id === jobId)
      : candidateId
        ? jobs.find((item) => item.candidate_id === candidateId)
        : null;
    if (job) void open(job);
  }, [jobs, selectedId]);

  async function open(job: any) {
    setSelectedId(job.id);
    setError("");
    if (!job.candidate_id) {
      setCandidate(null);
      return;
    }
    try {
      setCandidate((await candidateFn({ data: { candidateId: job.candidate_id } })).candidate);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load candidate");
    }
  }

  async function decide(decision: "approve" | "reject" | "request_verification") {
    if (!candidate) return;
    setBusy(true);
    setError("");
    try {
      await curate({
        data: {
          candidateId: candidate.id,
          decision,
          title: candidate.title,
          reason: decision === "approve" ? "Explicit administrator approval." : undefined,
        },
      });
      await qc.invalidateQueries({ queryKey: ["knowledge-acquisition-admin"] });
      setCandidate(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approval action failed");
    } finally {
      setBusy(false);
    }
  }

  async function publishNow() {
    if (!candidate) return;
    setBusy(true);
    try {
      await publish({ data: { candidateId: candidate.id } });
      await qc.invalidateQueries({ queryKey: ["knowledge-acquisition-admin"] });
      setCandidate(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publication failed");
    } finally {
      setBusy(false);
    }
  }

  async function artifact() {
    if (!selected?.report_ids?.length) return;
    try {
      const result = await reportUrl({ data: { reportId: selected.report_ids[0] } });
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Report artifact is not available");
    }
  }

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ["knowledge-acquisition-admin"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operation failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Global knowledge"
          title="Knowledge Acquisition"
          description="Bounded research queue, evidence packages, reports and explicit approval before global distribution. Approved knowledge becomes available to AAX models via API keys."
          backFallback="/admin"
        />

        <PhaseNote>
          Nothing enters platform knowledge until you Approve and Publish. Use the agent workstation for chat,
          prompts, and operational commands. PDF reports open from missions that have completed evidence packages.
        </PhaseNote>

        <div className="flex flex-wrap gap-2">
          <Link
            to="/admin/team/$agentKey"
            params={{ agentKey: "knowledge-acquisition" }}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-3 text-xs font-medium text-primary hover:bg-primary/15"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Open Knowledge Acquisition workstation
          </Link>
          <Link
            to="/admin/agents"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium hover:bg-muted"
          >
            Agents control plane
          </Link>
        </div>

        {error ? (
          <Panel>
            <p className="text-sm text-destructive">{error}</p>
          </Panel>
        ) : null}

        {isLoading ? (
          <Panel>
            <p className="text-sm text-muted-foreground">Loading acquisition missions…</p>
          </Panel>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_430px]">
            <Panel className="space-y-2 p-2">
              {jobs.length ? (
                (Array.isArray(jobs) ? jobs : []).map((job) => (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => void open(job)}
                    className={`w-full rounded-xl border p-3 text-left transition-colors hover:bg-muted/30 ${
                      selectedId === job.id ? "border-admin/50 bg-admin/5" : "border-border/70"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold">{job.title}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {job.subject} · {job.source_count} sources · {job.domain_count} domains
                        </p>
                        <p className="mt-1 inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                          <Clock3 className="h-3 w-3" />
                          {remainingLabel(job.deadline_at ?? null, job.task_status ?? job.status)}
                        </p>
                      </div>
                      <Tag
                        tone={
                          job.status === "waiting_approval"
                            ? "warning"
                            : job.status === "running"
                              ? "primary"
                              : job.status === "cancelled"
                                ? "neutral"
                                : "success"
                        }
                      >
                        {job.status}
                      </Tag>
                    </div>
                    <div className="mt-2 h-1 overflow-hidden rounded bg-muted">
                      <div
                        className="h-full bg-admin"
                        style={{ width: `${Math.round(Number(job.coverage) * 100)}%` }}
                      />
                    </div>
                    <div className="mt-1 flex justify-between text-[9px] text-muted-foreground">
                      <span>{Math.round(Number(job.coverage) * 100)}% defined scope</span>
                      <span>{Math.round(Number(job.confidence) * 100)}% confidence</span>
                    </div>
                  </button>
                ))
              ) : (
                <p className="p-4 text-xs text-muted-foreground">No acquisition missions.</p>
              )}
            </Panel>

            <div className="space-y-4">
              {selected ? (
                <Panel>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Mission</p>
                      <h2 className="mt-1 text-sm font-semibold">{selected.subject}</h2>
                    </div>
                    <Tag>{selected.approval_status}</Tag>
                  </div>
                  <pre className="mt-4 max-h-52 overflow-auto rounded-lg border bg-muted/20 p-3 text-[10px] text-muted-foreground">
                    {JSON.stringify(selected.scope, null, 2)}
                  </pre>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {selected.status === "waiting_approval" && selected.report_ids?.length ? (
                      <Button size="sm" variant="outline" onClick={() => void artifact()}>
                        <FileText className="mr-1.5 h-4 w-4" />
                        Open PDF report
                      </Button>
                    ) : null}
                    {["queued", "scheduled", "retrying", "paused"].includes(selected.status) ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void act(() => startNow({ data: { taskId: selected.task_id } }))}
                      >
                        <Rocket className="mr-1.5 h-4 w-4" />
                        Start now
                      </Button>
                    ) : null}
                    {["queued", "scheduled", "running"].includes(selected.status) ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void act(() => pause({ data: { taskId: selected.task_id } }))}
                      >
                        <Pause className="mr-1.5 h-4 w-4" />
                        Pause
                      </Button>
                    ) : null}
                    {selected.status === "paused" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void act(() => resume({ data: { taskId: selected.task_id } }))}
                      >
                        <Play className="mr-1.5 h-4 w-4" />
                        Resume
                      </Button>
                    ) : null}
                    {!["cancelled", "completed", "failed"].includes(selected.status) ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() =>
                          void act(() =>
                            cancel({
                              data: {
                                taskId: selected.task_id,
                                reason: "Cancelled by administrator",
                              },
                            }),
                          )
                        }
                      >
                        <XCircle className="mr-1.5 h-4 w-4" />
                        Cancel
                      </Button>
                    ) : null}
                  </div>
                </Panel>
              ) : (
                <Panel>
                  <p className="text-xs text-muted-foreground">
                    Select a mission to review its bounded scope and evidence package.
                  </p>
                </Panel>
              )}

              {candidate ? (
                <Panel>
                  <div className="flex items-start gap-2">
                    <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
                    <div>
                      <h2 className="text-sm font-semibold">Approval review</h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Nothing is globally published until you explicitly approve it. Published knowledge is
                        then available to AAX models when called via API keys.
                      </p>
                    </div>
                  </div>
                  <h3 className="mt-4 text-sm font-semibold">{candidate.title}</h3>
                  <p className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap text-xs leading-relaxed">
                    {candidate.content}
                  </p>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[10px]">
                    <div className="rounded border p-2">
                      <b>{candidate.claims?.length ?? 0}</b>
                      <br />
                      claims
                    </div>
                    <div className="rounded border p-2">
                      <b>{candidate.entities?.length ?? 0}</b>
                      <br />
                      entities
                    </div>
                    <div className="rounded border p-2">
                      <b>{candidate.relations?.length ?? 0}</b>
                      <br />
                      relations
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Button
                      disabled={busy || candidate.status !== "needs_review"}
                      onClick={() => void decide("approve")}
                    >
                      <Check className="mr-1.5 h-4 w-4" />
                      Approve
                    </Button>
                    <Button variant="ghost" disabled={busy} onClick={() => void decide("reject")}>
                      <XCircle className="mr-1.5 h-4 w-4" />
                      Reject
                    </Button>
                    <Button variant="outline" disabled={busy} onClick={() => void decide("request_verification")}>
                      Request revision
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy || candidate.status !== "approved"}
                      onClick={() => void publishNow()}
                    >
                      Publish globally
                    </Button>
                  </div>
                </Panel>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
