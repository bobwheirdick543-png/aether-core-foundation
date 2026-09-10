export type AaxTrainingStage =
  | "queued"
  | "knowledge-acquisition"
  | "research"
  | "verification"
  | "security"
  | "curator"
  | "target-aax-self-analysis"
  | "completed"
  | "failed"
  | "cancelled";

export interface AaxTrainingJobSummary {
  id: string;
  target_model_id: string;
  source_type: string;
  source_name: string | null;
  current_stage: AaxTrainingStage;
  pipeline_status: string;
  completed_agents: string[];
  started_at: string | null;
  completed_at: string | null;
  last_event_at: string | null;
  created_at: string;
}

export const AAX_TRAINING_STAGES: readonly AaxTrainingStage[] = [
  "queued",
  "knowledge-acquisition",
  "research",
  "verification",
  "security",
  "curator",
  "target-aax-self-analysis",
  "completed",
];
