import type { SupabaseClient } from "@supabase/supabase-js";
import { runAaxKnowledgeEvolution } from "./aax-knowledge-evolution-engine";

/** Executes one durable AAX training job claimed by the universal runtime. */
export async function executeAaxTrainingJob(admin: SupabaseClient, input: { taskId: string; runId: string; ownerId: string; trainingJobId: string; signal?: AbortSignal }): Promise<Record<string, unknown>> {
  const { data: job, error: jobError } = await admin.from("aax_training_jobs")
    .select("id, task_id, target_model_id, source_type, source_id, source_hash, original_source_ref, original_source_content, source_metadata, timeout_ms, pipeline_status")
    .eq("id", input.trainingJobId).single();
  if (jobError || !job) throw new Error(jobError?.message ?? "AAX training job not found");
  if (!job.original_source_content) throw new Error("AAX training job has no preserved original source content");
  if (["completed", "cancelled"].includes(String(job.pipeline_status))) return { training_job_id: job.id, status: job.pipeline_status, already_finished: true };

  const { data: target, error: targetError } = await admin.from("aax_models")
    .select("id, model_key, release_status, available_at, provider, provider_model")
    .eq("id", job.target_model_id).single();
  if (targetError || !target) throw new Error(targetError?.message ?? "Target AAX model not found");
  if (!target.provider || !target.provider_model) throw new Error(`Target AAX '${target.model_key}' is not provider-configured`);

  await admin.from("aax_training_jobs").update({ task_id: input.taskId, last_event_at: new Date().toISOString() }).eq("id", job.id);
  await admin.from("tasks").update({ status: "running", progress: 5, heartbeat_at: new Date().toISOString(), detail: { currentActivity: "AAX training pipeline started", trainingJobId: job.id, targetModel: target.model_key } }).eq("id", input.taskId);
  await admin.from("task_events").insert({ task_id: input.taskId, run_id: input.runId, sequence: Date.now(), event_type: "aax.training.started", message: "AAX training pipeline started", data: { trainingJobId: job.id, targetModel: target.model_key } });

  return runAaxKnowledgeEvolution(admin, {
    trainingJobId: job.id,
    targetModelId: job.target_model_id,
    sourceId: job.source_id,
    sourceType: job.source_type,
    sourceHash: job.source_hash,
    originalSource: job.original_source_content,
    sourceMetadata: job.source_metadata ?? job.original_source_ref ?? {},
    agentModelKey: target.model_key,
    targetModelKey: target.model_key,
    signal: input.signal,
    userId: input.ownerId,
  }).then(async ({ package: pkg, selfAnalysis }) => {
    const completedAt = new Date().toISOString();
    await admin.from("tasks").update({ status: "completed", progress: 100, completed_at: completedAt, heartbeat_at: completedAt, detail: { currentActivity: "AAX specialization integrated", trainingJobId: job.id, targetModel: target.model_key, understandingCount: pkg.understandings.length } }).eq("id", input.taskId);
    await admin.from("task_runs").update({ status: "completed", ended_at: completedAt, duration_ms: Math.max(0, Date.parse(completedAt) - Date.parse(job.started_at ?? completedAt)), outputs: { trainingJobId: job.id, understandingCount: pkg.understandings.length, acceptedChanges: Array.isArray(selfAnalysis.acceptedKnowledgeChanges) ? selfAnalysis.acceptedKnowledgeChanges.length : 0 } }).eq("id", input.runId);
    await admin.from("task_events").insert({ task_id: input.taskId, run_id: input.runId, sequence: Date.now(), event_type: "aax.training.completed", message: "AAX training pipeline completed", data: { trainingJobId: job.id, understandingCount: pkg.understandings.length, acceptedChanges: Array.isArray(selfAnalysis.acceptedKnowledgeChanges) ? selfAnalysis.acceptedKnowledgeChanges.length : 0 } });
    return { training_job_id: job.id, target_model_id: job.target_model_id, status: "completed", understanding_count: pkg.understandings.length, accepted_changes: Array.isArray(selfAnalysis.acceptedKnowledgeChanges) ? selfAnalysis.acceptedKnowledgeChanges.length : 0 };
  });
}
