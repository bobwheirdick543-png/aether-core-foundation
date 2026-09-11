import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Panel, Tag } from "@/components/common/Primitives";
import { listMyVerificationSessions } from "@/lib/aether/verification-sessions.functions";
import { executeVerificationRun, getMyVerificationRun, reviewVerificationClaim, startVerificationRun } from "@/lib/aether/verification.functions";

const TONE: Record<string, "success" | "warning" | "primary" | "neutral"> = {
  verified: "success", conflicting: "warning", unsupported: "warning", outdated: "warning", rejected: "warning", needs_review: "warning", pending: "neutral",
};

export function VerificationPanel() {
  const queryClient = useQueryClient();
  const loadSessions = useServerFn(listMyVerificationSessions);
  const start = useServerFn(startVerificationRun);
  const execute = useServerFn(executeVerificationRun);
  const loadRun = useServerFn(getMyVerificationRun);
  const review = useServerFn(reviewVerificationClaim);
  const { data: sessions = [], isLoading } = useQuery({ queryKey: ["verification-sessions"], queryFn: () => loadSessions({}) });
  const [sessionId, setSessionId] = useState("");
  const [claimsText, setClaimsText] = useState("");
  const [runId, setRunId] = useState<string | null>(null);
  const [run, setRun] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  async function verify(): Promise<void> {
    const claims = claimsText.split(/\n+/).map((claim) => claim.trim()).filter(Boolean);
    if (!sessionId) { toast.error("Select a research session first."); return; }
    if (!claims.length) { toast.error("Enter at least one claim, one per line."); return; }
    setBusy(true);
    try {
      const queued = await start({ data: { sessionId, claims, idempotencyKey: `ui:${sessionId}:${claims.join("|").slice(0, 120)}` } });
      const currentRunId = queued.run_id;
      if (!currentRunId) throw new Error("Verification run was not created.");
      setRunId(currentRunId);
      await execute({ data: { verificationRunId: currentRunId } });
      const detail = await loadRun({ data: { verificationRunId: currentRunId } });
      setRun(detail);
      toast.success(detail.run.status === "waiting_review" ? "Verification completed; review is required for some claims." : "Verification completed.");
      queryClient.invalidateQueries({ queryKey: ["verification-sessions"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Verification failed.");
    } finally { setBusy(false); }
  }

  async function decide(claimId: string, decision: "accept" | "reject" | "needs_review" | "reverify") {
    try {
      await review({ data: { claimId, decision } });
      if (runId) setRun(await loadRun({ data: { verificationRunId: runId } }));
      toast.success("Review decision saved.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not save review decision."); }
  }

  return (
    <Panel className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="rounded-xl border border-border/60 bg-muted/40 p-2"><ShieldCheck className="h-5 w-5" /></div>
        <div><h2 className="text-sm font-semibold">Verification</h2><p className="text-xs text-muted-foreground">Test claims against persisted research evidence. Verification never publishes production knowledge.</p></div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="verification-session">Research session</Label>
        <select id="verification-session" value={sessionId} onChange={(event) => setSessionId(event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
          <option value="">{isLoading ? "Loading sessions…" : "Select a session"}</option>
          {sessions.map((session) => <option key={session.id} value={session.id}>{session.query} · {session.source_count} source{session.source_count === 1 ? "" : "s"} · {session.status}</option>)}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="verification-claims">Claims to verify</Label>
        <Textarea id="verification-claims" value={claimsText} onChange={(event) => setClaimsText(event.target.value)} rows={5} maxLength={12000} placeholder="One factual claim per line…" />
        <p className="text-[11px] text-muted-foreground">Up to 50 claims. The engine records evidence, agreement, contradiction, date mismatch, uncertainty, authority and freshness.</p>
      </div>
      <Button type="button" onClick={verify} disabled={busy || !sessionId}>{busy ? "Verifying…" : "Verify claims"}</Button>
      {run ? (
        <div className="space-y-3 border-t border-border/60 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-medium">{run.run.summary || "Verification result"}</p><p className="text-xs text-muted-foreground">Verifier {run.run.verifier_version}</p></div><Tag tone={run.run.status === "completed" ? "success" : "warning"}>{run.run.status}</Tag></div>
          {(run.claims ?? []).map((claim: any) => (
            <div key={claim.id} className="rounded-xl border border-border/60 p-3 space-y-2">
              <div className="flex items-start justify-between gap-2"><p className="text-sm">{claim.claim}</p><Tag tone={TONE[claim.verification_state] ?? "neutral"}>{claim.verification_state}</Tag></div>
              <div className="grid gap-2 text-[11px] text-muted-foreground sm:grid-cols-4"><span>Confidence {(Number(claim.confidence) * 100).toFixed(0)}%</span><span>Evidence {(Number(claim.evidence_strength) * 100).toFixed(0)}%</span><span>Authority {(Number(claim.authority_score) * 100).toFixed(0)}%</span><span>Freshness {(Number(claim.freshness_score) * 100).toFixed(0)}%</span></div>
              {claim.review_reason ? <p className="text-xs text-muted-foreground">{claim.review_reason}</p> : null}
              {Array.isArray(claim.uncertainty) && claim.uncertainty.length ? <ul className="list-disc pl-5 text-xs text-muted-foreground">{claim.uncertainty.map((item: string) => <li key={item}>{item}</li>)}</ul> : null}
              {claim.verification_state !== "verified" ? <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => decide(claim.id, "accept")}><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Accept</Button><Button size="sm" variant="outline" onClick={() => decide(claim.id, "reject")}>Reject</Button><Button size="sm" variant="outline" onClick={() => decide(claim.id, "reverify")}>Re-verify</Button></div> : null}
            </div>
          ))}
        </div>
      ) : null}
    </Panel>
  );
}
