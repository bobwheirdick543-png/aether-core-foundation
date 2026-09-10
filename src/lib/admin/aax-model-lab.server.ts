import type { SupabaseClient } from "@supabase/supabase-js";
import type { AaxTrainingJobSummary } from "./aax-model-lab.types";

export async function assertAaxAdmin(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) throw new Error("AAX Model Lab access denied");
}

export async function listAaxTrainingJobs(admin: SupabaseClient, limit = 50): Promise<AaxTrainingJobSummary[]> {
  const { data, error } = await admin
    .from("aax_training_jobs")
    .select("id,target_model_id,source_type,current_stage,pipeline_status,completed_agents,started_at,completed_at,last_event_at,created_at")
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(100, limit)));
  if (error) throw new Error(error.message);
  return (data ?? []) as AaxTrainingJobSummary[];
}

export async function getAaxTrainingJob(admin: SupabaseClient, jobId: string) {
  const [{ data: job, error }, { data: events, error: eventsError }] = await Promise.all([
    admin.from("aax_training_jobs").select("*").eq("id", jobId).single(),
    admin.from("aax_knowledge_events").select("*").eq("training_job_id", jobId).order("created_at", { ascending: true }),
  ]);
  if (error || !job) throw new Error(error?.message || "Training job not found");
  if (eventsError) throw new Error(eventsError.message);
  return { job, events: events ?? [] };
}
