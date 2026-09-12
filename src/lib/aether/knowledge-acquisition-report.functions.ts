import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createAcquisitionReportAndNotify } from "./knowledge-acquisition-report";

export const ensureKnowledgeAcquisitionReport = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: { jobId: string }) => ({ jobId: String(d?.jobId ?? "").trim() })).handler(async ({ context, data }) => {
  const { data: job, error } = await supabaseAdmin.from("aether_knowledge_acquisition_jobs").select("*").eq("id", data.jobId).maybeSingle();
  if (error || !job) throw new Response("Acquisition mission not found", { status: 404 });
  const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!isAdmin && job.owner_id !== context.userId) throw new Response("Forbidden", { status: 403 });
  if (!job.candidate_id) throw new Response("This acquisition has no candidate to report", { status: 409 });
  if (Array.isArray(job.report_ids) && job.report_ids.length) return { reportId: job.report_ids[0], generated: false };
  const { data: candidate } = await supabaseAdmin.from("aether_knowledge_candidates").select("id,confidence,claims,entities,relations").eq("id", job.candidate_id).maybeSingle();
  if (!candidate) throw new Response("Knowledge candidate not found", { status: 404 });
  const result = await createAcquisitionReportAndNotify(supabaseAdmin, { job, candidateId: candidate.id, coverage: Number(job.coverage), confidence: Number(candidate.confidence ?? job.confidence), sourceCount: Number(job.source_count), domainCount: Number(job.domain_count), unresolvedItems: job.unresolved_items ?? [], relatedConcepts: job.related_concepts ?? [], sourceSummary: `Candidate contains ${Array.isArray(candidate.claims) ? candidate.claims.length : 0} claims, ${Array.isArray(candidate.entities) ? candidate.entities.length : 0} entities and ${Array.isArray(candidate.relations) ? candidate.relations.length : 0} relationships.` });
  await supabaseAdmin.from("aether_knowledge_acquisition_jobs").update({ report_ids: [result.reportId], updated_at: new Date().toISOString(), last_event_at: new Date().toISOString() }).eq("id", job.id);
  return { reportId: result.reportId, generated: true, filePath: result.filePath };
});
