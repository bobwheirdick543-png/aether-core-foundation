export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      aax_chat_attachments: {
        Row: {
          conversation_id: string
          created_at: string
          extracted_text: string | null
          extraction_status: string
          filename: string
          id: string
          message_id: string | null
          metadata: Json
          mime_type: string
          owner_id: string
          sha256: string | null
          size_bytes: number
          storage_path: string
          updated_at: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          extracted_text?: string | null
          extraction_status?: string
          filename: string
          id?: string
          message_id?: string | null
          metadata?: Json
          mime_type: string
          owner_id: string
          sha256?: string | null
          size_bytes: number
          storage_path: string
          updated_at?: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          extracted_text?: string | null
          extraction_status?: string
          filename?: string
          id?: string
          message_id?: string | null
          metadata?: Json
          mime_type?: string
          owner_id?: string
          sha256?: string | null
          size_bytes?: number
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aax_chat_attachments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "aax_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aax_chat_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "aax_conversation_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      aax_chat_generation_runs: {
        Row: {
          assistant_message_id: string | null
          completed_at: string | null
          conversation_id: string
          error: string | null
          id: string
          metadata: Json
          model_id: string | null
          owner_id: string
          started_at: string
          status: string
          user_message_id: string | null
          web_research: boolean
        }
        Insert: {
          assistant_message_id?: string | null
          completed_at?: string | null
          conversation_id: string
          error?: string | null
          id?: string
          metadata?: Json
          model_id?: string | null
          owner_id: string
          started_at?: string
          status?: string
          user_message_id?: string | null
          web_research?: boolean
        }
        Update: {
          assistant_message_id?: string | null
          completed_at?: string | null
          conversation_id?: string
          error?: string | null
          id?: string
          metadata?: Json
          model_id?: string | null
          owner_id?: string
          started_at?: string
          status?: string
          user_message_id?: string | null
          web_research?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "aax_chat_generation_runs_assistant_message_id_fkey"
            columns: ["assistant_message_id"]
            isOneToOne: false
            referencedRelation: "aax_conversation_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aax_chat_generation_runs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "aax_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aax_chat_generation_runs_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "aax_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aax_chat_generation_runs_user_message_id_fkey"
            columns: ["user_message_id"]
            isOneToOne: false
            referencedRelation: "aax_conversation_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      aax_chat_memory_candidates: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          message_id: string
          owner_id: string
          reviewed_at: string | null
          status: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          message_id: string
          owner_id: string
          reviewed_at?: string | null
          status?: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          message_id?: string
          owner_id?: string
          reviewed_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "aax_chat_memory_candidates_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "aax_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aax_chat_memory_candidates_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "aax_conversation_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      aax_chat_sources: {
        Row: {
          citation_index: number | null
          conversation_id: string
          created_at: string
          domain: string | null
          id: string
          message_id: string | null
          owner_id: string
          snippet: string | null
          title: string | null
          url: string
        }
        Insert: {
          citation_index?: number | null
          conversation_id: string
          created_at?: string
          domain?: string | null
          id?: string
          message_id?: string | null
          owner_id: string
          snippet?: string | null
          title?: string | null
          url: string
        }
        Update: {
          citation_index?: number | null
          conversation_id?: string
          created_at?: string
          domain?: string | null
          id?: string
          message_id?: string | null
          owner_id?: string
          snippet?: string | null
          title?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "aax_chat_sources_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "aax_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aax_chat_sources_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "aax_conversation_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      aax_conversation_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          metadata: Json
          model_id: string
          owner_id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          metadata?: Json
          model_id: string
          owner_id: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          model_id?: string
          owner_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "aax_conversation_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "aax_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aax_conversation_messages_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "aax_models"
            referencedColumns: ["id"]
          },
        ]
      }
      aax_conversations: {
        Row: {
          archived: boolean
          archived_at: string | null
          created_at: string
          id: string
          last_message_at: string | null
          memory_enabled: boolean
          model_id: string
          owner_id: string
          project_id: string | null
          title: string
          updated_at: string
          web_research_enabled: boolean
        }
        Insert: {
          archived?: boolean
          archived_at?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          memory_enabled?: boolean
          model_id: string
          owner_id: string
          project_id?: string | null
          title?: string
          updated_at?: string
          web_research_enabled?: boolean
        }
        Update: {
          archived?: boolean
          archived_at?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          memory_enabled?: boolean
          model_id?: string
          owner_id?: string
          project_id?: string | null
          title?: string
          updated_at?: string
          web_research_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "aax_conversations_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "aax_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aax_conversations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      aax_evaluations: {
        Row: {
          cases: Json
          completed_at: string | null
          created_at: string
          id: string
          metadata: Json
          model_id: string
          results: Json
          started_at: string | null
          status: string
          suite_key: string
          summary: Json
          updated_at: string
        }
        Insert: {
          cases?: Json
          completed_at?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          model_id: string
          results?: Json
          started_at?: string | null
          status?: string
          suite_key: string
          summary?: Json
          updated_at?: string
        }
        Update: {
          cases?: Json
          completed_at?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          model_id?: string
          results?: Json
          started_at?: string | null
          status?: string
          suite_key?: string
          summary?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aax_evaluations_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "aax_models"
            referencedColumns: ["id"]
          },
        ]
      }
      aax_knowledge_changes: {
        Row: {
          change_type: string
          confidence: number | null
          created_at: string
          id: string
          integrated: boolean
          integrated_at: string | null
          provenance: Json
          statement: string
          target_aax_version: number | null
          target_model_id: string
          training_job_id: string
          verification_status: string
        }
        Insert: {
          change_type: string
          confidence?: number | null
          created_at?: string
          id?: string
          integrated?: boolean
          integrated_at?: string | null
          provenance?: Json
          statement: string
          target_aax_version?: number | null
          target_model_id: string
          training_job_id: string
          verification_status?: string
        }
        Update: {
          change_type?: string
          confidence?: number | null
          created_at?: string
          id?: string
          integrated?: boolean
          integrated_at?: string | null
          provenance?: Json
          statement?: string
          target_aax_version?: number | null
          target_model_id?: string
          training_job_id?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "aax_knowledge_changes_target_model_id_fkey"
            columns: ["target_model_id"]
            isOneToOne: false
            referencedRelation: "aax_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aax_knowledge_changes_training_job_id_fkey"
            columns: ["training_job_id"]
            isOneToOne: false
            referencedRelation: "aax_training_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      aax_knowledge_events: {
        Row: {
          agent_key: string | null
          created_at: string
          event_type: string
          id: string
          payload: Json
          stage: string
          target_model_id: string
          training_job_id: string
          understanding_id: string | null
        }
        Insert: {
          agent_key?: string | null
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          stage: string
          target_model_id: string
          training_job_id: string
          understanding_id?: string | null
        }
        Update: {
          agent_key?: string | null
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          stage?: string
          target_model_id?: string
          training_job_id?: string
          understanding_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aax_knowledge_events_target_model_id_fkey"
            columns: ["target_model_id"]
            isOneToOne: false
            referencedRelation: "aax_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aax_knowledge_events_training_job_id_fkey"
            columns: ["training_job_id"]
            isOneToOne: false
            referencedRelation: "aax_training_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aax_knowledge_events_understanding_id_fkey"
            columns: ["understanding_id"]
            isOneToOne: false
            referencedRelation: "aax_understanding_artifacts"
            referencedColumns: ["id"]
          },
        ]
      }
      aax_knowledge_items: {
        Row: {
          confidence: number | null
          content: Json
          created_at: string
          id: string
          integrated_aax_version: number | null
          integrated_at: string | null
          knowledge_state: string
          model_id: string
          provenance: Json
          source_hash: string | null
          source_id: string | null
          source_locator: Json
          source_type: string
          specialization: string | null
          updated_at: string
        }
        Insert: {
          confidence?: number | null
          content?: Json
          created_at?: string
          id?: string
          integrated_aax_version?: number | null
          integrated_at?: string | null
          knowledge_state?: string
          model_id: string
          provenance?: Json
          source_hash?: string | null
          source_id?: string | null
          source_locator?: Json
          source_type: string
          specialization?: string | null
          updated_at?: string
        }
        Update: {
          confidence?: number | null
          content?: Json
          created_at?: string
          id?: string
          integrated_aax_version?: number | null
          integrated_at?: string | null
          knowledge_state?: string
          model_id?: string
          provenance?: Json
          source_hash?: string | null
          source_id?: string | null
          source_locator?: Json
          source_type?: string
          specialization?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aax_knowledge_items_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "aax_models"
            referencedColumns: ["id"]
          },
        ]
      }
      aax_model_health: {
        Row: {
          consecutive_failures: number
          consecutive_successes: number
          cooldown_until: string | null
          last_error: string | null
          last_error_at: string | null
          last_success_at: string | null
          model_id: string
          state: string
          total_failures: number
          total_fallbacks: number
          total_requests: number
          updated_at: string
        }
        Insert: {
          consecutive_failures?: number
          consecutive_successes?: number
          cooldown_until?: string | null
          last_error?: string | null
          last_error_at?: string | null
          last_success_at?: string | null
          model_id: string
          state?: string
          total_failures?: number
          total_fallbacks?: number
          total_requests?: number
          updated_at?: string
        }
        Update: {
          consecutive_failures?: number
          consecutive_successes?: number
          cooldown_until?: string | null
          last_error?: string | null
          last_error_at?: string | null
          last_success_at?: string | null
          model_id?: string
          state?: string
          total_failures?: number
          total_fallbacks?: number
          total_requests?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aax_model_health_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: true
            referencedRelation: "aax_models"
            referencedColumns: ["id"]
          },
        ]
      }
      aax_models: {
        Row: {
          available_at: string | null
          capabilities: string[]
          config: Json
          context_window: number
          created_at: string
          description: string
          disabled_at: string | null
          display_name: string
          generation: number
          id: string
          improvements: Json
          model_key: string
          output_limit: number | null
          parent_model_id: string | null
          provider: string | null
          provider_model: string | null
          release_status: string
          revision: number
          scheduled_release_at: string | null
          specialization_profile: Json
          specializations: string[]
          updated_at: string
        }
        Insert: {
          available_at?: string | null
          capabilities?: string[]
          config?: Json
          context_window?: number
          created_at?: string
          description?: string
          disabled_at?: string | null
          display_name: string
          generation?: number
          id?: string
          improvements?: Json
          model_key: string
          output_limit?: number | null
          parent_model_id?: string | null
          provider?: string | null
          provider_model?: string | null
          release_status?: string
          revision?: number
          scheduled_release_at?: string | null
          specialization_profile?: Json
          specializations?: string[]
          updated_at?: string
        }
        Update: {
          available_at?: string | null
          capabilities?: string[]
          config?: Json
          context_window?: number
          created_at?: string
          description?: string
          disabled_at?: string | null
          display_name?: string
          generation?: number
          id?: string
          improvements?: Json
          model_key?: string
          output_limit?: number | null
          parent_model_id?: string | null
          provider?: string | null
          provider_model?: string | null
          release_status?: string
          revision?: number
          scheduled_release_at?: string | null
          specialization_profile?: Json
          specializations?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aax_models_parent_model_id_fkey"
            columns: ["parent_model_id"]
            isOneToOne: false
            referencedRelation: "aax_models"
            referencedColumns: ["id"]
          },
        ]
      }
      aax_training_jobs: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          collective_package: Json
          completed_agents: string[]
          completed_at: string | null
          created_at: string
          current_stage: string
          error: string | null
          id: string
          last_event_at: string | null
          original_source_content: string | null
          original_source_ref: Json
          pipeline_context: Json
          pipeline_status: string
          report_delivery: Json
          report_id: string | null
          requested_by: string | null
          source_hash: string | null
          source_id: string | null
          source_metadata: Json
          source_type: string
          started_at: string | null
          target_model_id: string
          target_self_analysis: Json | null
          task_id: string | null
          timeout_ms: number
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          collective_package?: Json
          completed_agents?: string[]
          completed_at?: string | null
          created_at?: string
          current_stage?: string
          error?: string | null
          id?: string
          last_event_at?: string | null
          original_source_content?: string | null
          original_source_ref?: Json
          pipeline_context?: Json
          pipeline_status?: string
          report_delivery?: Json
          report_id?: string | null
          requested_by?: string | null
          source_hash?: string | null
          source_id?: string | null
          source_metadata?: Json
          source_type: string
          started_at?: string | null
          target_model_id: string
          target_self_analysis?: Json | null
          task_id?: string | null
          timeout_ms?: number
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          collective_package?: Json
          completed_agents?: string[]
          completed_at?: string | null
          created_at?: string
          current_stage?: string
          error?: string | null
          id?: string
          last_event_at?: string | null
          original_source_content?: string | null
          original_source_ref?: Json
          pipeline_context?: Json
          pipeline_status?: string
          report_delivery?: Json
          report_id?: string | null
          requested_by?: string | null
          source_hash?: string | null
          source_id?: string | null
          source_metadata?: Json
          source_type?: string
          started_at?: string | null
          target_model_id?: string
          target_self_analysis?: Json | null
          task_id?: string | null
          timeout_ms?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aax_training_jobs_target_model_id_fkey"
            columns: ["target_model_id"]
            isOneToOne: false
            referencedRelation: "aax_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aax_training_jobs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      aax_understanding_artifacts: {
        Row: {
          accumulated_context: Json
          agent_key: string
          artifact: Json
          concepts: Json
          confidence: number | null
          context: Json
          contradictions: Json
          corrections: Json
          created_at: string
          cross_domain_connections: Json
          definitions: Json
          evidence: Json
          existing_knowledge_links: Json
          id: string
          interpretation: string
          new_knowledge: Json
          original_source_ref: Json
          parent_understanding_ids: string[]
          reasoning: Json
          recommended_knowledge_changes: Json
          relationships: Json
          sequence_no: number
          source_id: string | null
          target_model_id: string
          training_job_id: string | null
          uncertainties: Json
        }
        Insert: {
          accumulated_context?: Json
          agent_key: string
          artifact?: Json
          concepts?: Json
          confidence?: number | null
          context?: Json
          contradictions?: Json
          corrections?: Json
          created_at?: string
          cross_domain_connections?: Json
          definitions?: Json
          evidence?: Json
          existing_knowledge_links?: Json
          id?: string
          interpretation?: string
          new_knowledge?: Json
          original_source_ref?: Json
          parent_understanding_ids?: string[]
          reasoning?: Json
          recommended_knowledge_changes?: Json
          relationships?: Json
          sequence_no?: number
          source_id?: string | null
          target_model_id: string
          training_job_id?: string | null
          uncertainties?: Json
        }
        Update: {
          accumulated_context?: Json
          agent_key?: string
          artifact?: Json
          concepts?: Json
          confidence?: number | null
          context?: Json
          contradictions?: Json
          corrections?: Json
          created_at?: string
          cross_domain_connections?: Json
          definitions?: Json
          evidence?: Json
          existing_knowledge_links?: Json
          id?: string
          interpretation?: string
          new_knowledge?: Json
          original_source_ref?: Json
          parent_understanding_ids?: string[]
          reasoning?: Json
          recommended_knowledge_changes?: Json
          relationships?: Json
          sequence_no?: number
          source_id?: string | null
          target_model_id?: string
          training_job_id?: string | null
          uncertainties?: Json
        }
        Relationships: [
          {
            foreignKeyName: "aax_understanding_artifacts_target_model_id_fkey"
            columns: ["target_model_id"]
            isOneToOne: false
            referencedRelation: "aax_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aax_understanding_artifacts_training_job_id_fkey"
            columns: ["training_job_id"]
            isOneToOne: false
            referencedRelation: "aax_training_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      aether_api_controls: {
        Row: {
          external_intelligence_enabled: boolean
          id: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          external_intelligence_enabled?: boolean
          id?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          external_intelligence_enabled?: boolean
          id?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      aether_api_idempotency: {
        Row: {
          api_key_id: string
          created_at: string
          expires_at: string
          id: string
          idempotency_key: string
          owner_id: string
          request_hash: string
          request_record_id: string | null
          response_body: Json | null
          status_code: number
        }
        Insert: {
          api_key_id: string
          created_at?: string
          expires_at?: string
          id?: string
          idempotency_key: string
          owner_id: string
          request_hash: string
          request_record_id?: string | null
          response_body?: Json | null
          status_code?: number
        }
        Update: {
          api_key_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          idempotency_key?: string
          owner_id?: string
          request_hash?: string
          request_record_id?: string | null
          response_body?: Json | null
          status_code?: number
        }
        Relationships: [
          {
            foreignKeyName: "aether_api_idempotency_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "aether_api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_api_idempotency_request_record_id_fkey"
            columns: ["request_record_id"]
            isOneToOne: false
            referencedRelation: "aether_api_request_records"
            referencedColumns: ["id"]
          },
        ]
      }
      aether_api_idempotency_keys: {
        Row: {
          api_key_id: string
          created_at: string
          expires_at: string
          idempotency_key: string
          request_record_id: string | null
          response_body: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          api_key_id: string
          created_at?: string
          expires_at?: string
          idempotency_key: string
          request_record_id?: string | null
          response_body?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          api_key_id?: string
          created_at?: string
          expires_at?: string
          idempotency_key?: string
          request_record_id?: string | null
          response_body?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aether_api_idempotency_keys_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "aether_api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_api_idempotency_keys_request_record_id_fkey"
            columns: ["request_record_id"]
            isOneToOne: false
            referencedRelation: "aether_api_request_records"
            referencedColumns: ["id"]
          },
        ]
      }
      aether_api_key_events: {
        Row: {
          action_source: string
          actor_id: string | null
          api_key_id: string
          created_at: string
          event_type: string
          id: string
          ip_hash: string | null
          metadata: Json
          owner_id: string
          user_agent: string | null
        }
        Insert: {
          action_source?: string
          actor_id?: string | null
          api_key_id: string
          created_at?: string
          event_type: string
          id?: string
          ip_hash?: string | null
          metadata?: Json
          owner_id: string
          user_agent?: string | null
        }
        Update: {
          action_source?: string
          actor_id?: string | null
          api_key_id?: string
          created_at?: string
          event_type?: string
          id?: string
          ip_hash?: string | null
          metadata?: Json
          owner_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aether_api_key_events_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "aether_api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      aether_api_key_usage_periods: {
        Row: {
          api_key_id: string
          period_start: string
          request_count: number
          token_limit: number
          tokens_consumed: number
          tokens_reserved: number
          updated_at: string
        }
        Insert: {
          api_key_id: string
          period_start: string
          request_count?: number
          token_limit: number
          tokens_consumed?: number
          tokens_reserved?: number
          updated_at?: string
        }
        Update: {
          api_key_id?: string
          period_start?: string
          request_count?: number
          token_limit?: number
          tokens_consumed?: number
          tokens_reserved?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aether_api_key_usage_periods_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "aether_api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      aether_api_keys: {
        Row: {
          api_kind: string
          application_name: string | null
          created_at: string
          encrypted_secret: string | null
          environment: string
          expires_at: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          max_input_tokens: number
          max_output_tokens: number
          max_tokens_per_request: number
          metadata: Json
          model_generation: number | null
          model_id: string | null
          model_key: string | null
          model_revision: number | null
          monthly_token_limit: number
          name: string
          owner_id: string
          project_id: string | null
          rate_limit_per_minute: number
          revoked_at: string | null
          scopes: string[]
          secret_recovery_available: boolean
          secret_version: number
          status: string
          unlimited_tokens: boolean
          updated_at: string
        }
        Insert: {
          api_kind?: string
          application_name?: string | null
          created_at?: string
          encrypted_secret?: string | null
          environment?: string
          expires_at?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          max_input_tokens?: number
          max_output_tokens?: number
          max_tokens_per_request?: number
          metadata?: Json
          model_generation?: number | null
          model_id?: string | null
          model_key?: string | null
          model_revision?: number | null
          monthly_token_limit?: number
          name: string
          owner_id: string
          project_id?: string | null
          rate_limit_per_minute?: number
          revoked_at?: string | null
          scopes?: string[]
          secret_recovery_available?: boolean
          secret_version?: number
          status?: string
          unlimited_tokens?: boolean
          updated_at?: string
        }
        Update: {
          api_kind?: string
          application_name?: string | null
          created_at?: string
          encrypted_secret?: string | null
          environment?: string
          expires_at?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          max_input_tokens?: number
          max_output_tokens?: number
          max_tokens_per_request?: number
          metadata?: Json
          model_generation?: number | null
          model_id?: string | null
          model_key?: string | null
          model_revision?: number | null
          monthly_token_limit?: number
          name?: string
          owner_id?: string
          project_id?: string | null
          rate_limit_per_minute?: number
          revoked_at?: string | null
          scopes?: string[]
          secret_recovery_available?: boolean
          secret_version?: number
          status?: string
          unlimited_tokens?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aether_api_keys_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "aax_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_api_keys_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      aether_api_logs: {
        Row: {
          api_key_id: string | null
          api_version: string | null
          application_name: string | null
          created_at: string
          environment: string | null
          error_code: string | null
          id: string
          idempotency_key: string | null
          latency_ms: number | null
          metadata: Json
          method: string
          model_id: string | null
          model_key: string | null
          outcome: string | null
          owner_id: string | null
          path: string
          provider: string | null
          provider_model: string | null
          request_id: string
          request_record_id: string | null
          response_validation_status: string | null
          scope: string | null
          status_code: number | null
          tokens_in: number | null
          tokens_out: number | null
          tokens_total: number | null
        }
        Insert: {
          api_key_id?: string | null
          api_version?: string | null
          application_name?: string | null
          created_at?: string
          environment?: string | null
          error_code?: string | null
          id?: string
          idempotency_key?: string | null
          latency_ms?: number | null
          metadata?: Json
          method: string
          model_id?: string | null
          model_key?: string | null
          outcome?: string | null
          owner_id?: string | null
          path: string
          provider?: string | null
          provider_model?: string | null
          request_id: string
          request_record_id?: string | null
          response_validation_status?: string | null
          scope?: string | null
          status_code?: number | null
          tokens_in?: number | null
          tokens_out?: number | null
          tokens_total?: number | null
        }
        Update: {
          api_key_id?: string | null
          api_version?: string | null
          application_name?: string | null
          created_at?: string
          environment?: string | null
          error_code?: string | null
          id?: string
          idempotency_key?: string | null
          latency_ms?: number | null
          metadata?: Json
          method?: string
          model_id?: string | null
          model_key?: string | null
          outcome?: string | null
          owner_id?: string | null
          path?: string
          provider?: string | null
          provider_model?: string | null
          request_id?: string
          request_record_id?: string | null
          response_validation_status?: string | null
          scope?: string | null
          status_code?: number | null
          tokens_in?: number | null
          tokens_out?: number | null
          tokens_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "aether_api_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "aether_api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      aether_api_rate_windows: {
        Row: {
          api_key_id: string
          request_count: number
          window_start: string
        }
        Insert: {
          api_key_id: string
          request_count?: number
          window_start: string
        }
        Update: {
          api_key_id?: string
          request_count?: number
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "aether_api_rate_windows_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "aether_api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      aether_api_request_records: {
        Row: {
          api_key_id: string | null
          api_kind: string
          api_version: string
          application_name: string | null
          completed_at: string | null
          created_at: string
          deleted_at: string | null
          environment: string | null
          error_code: string | null
          error_message: string | null
          id: string
          latency_ms: number | null
          metadata: Json
          model_id: string | null
          model_key: string | null
          outcome: string | null
          owner_id: string | null
          provider: string | null
          provider_model: string | null
          request_body: Json
          request_id: string
          response_body: Json | null
          response_text: string | null
          response_validation_status: string | null
          retention_class: string
          started_at: string
          status_code: number | null
          tokens_in: number
          tokens_out: number
          tokens_reserved: number
          tokens_total: number
          usage_source: string | null
        }
        Insert: {
          api_key_id?: string | null
          api_kind?: string
          api_version?: string
          application_name?: string | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          environment?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          metadata?: Json
          model_id?: string | null
          model_key?: string | null
          outcome?: string | null
          owner_id?: string | null
          provider?: string | null
          provider_model?: string | null
          request_body?: Json
          request_id: string
          response_body?: Json | null
          response_text?: string | null
          response_validation_status?: string | null
          retention_class?: string
          started_at?: string
          status_code?: number | null
          tokens_in?: number
          tokens_out?: number
          tokens_reserved?: number
          tokens_total?: number
          usage_source?: string | null
        }
        Update: {
          api_key_id?: string | null
          api_kind?: string
          api_version?: string
          application_name?: string | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          environment?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          metadata?: Json
          model_id?: string | null
          model_key?: string | null
          outcome?: string | null
          owner_id?: string | null
          provider?: string | null
          provider_model?: string | null
          request_body?: Json
          request_id?: string
          response_body?: Json | null
          response_text?: string | null
          response_validation_status?: string | null
          retention_class?: string
          started_at?: string
          status_code?: number | null
          tokens_in?: number
          tokens_out?: number
          tokens_reserved?: number
          tokens_total?: number
          usage_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aether_api_request_records_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "aether_api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      aether_api_token_reservations: {
        Row: {
          api_key_id: string
          consumed_tokens: number
          created_at: string
          finalized_at: string | null
          id: string
          period_start: string
          request_record_id: string | null
          reserved_tokens: number
          status: string
        }
        Insert: {
          api_key_id: string
          consumed_tokens?: number
          created_at?: string
          finalized_at?: string | null
          id?: string
          period_start: string
          request_record_id?: string | null
          reserved_tokens: number
          status?: string
        }
        Update: {
          api_key_id?: string
          consumed_tokens?: number
          created_at?: string
          finalized_at?: string | null
          id?: string
          period_start?: string
          request_record_id?: string | null
          reserved_tokens?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "aether_api_token_reservations_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "aether_api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_api_token_reservations_request_record_id_fkey"
            columns: ["request_record_id"]
            isOneToOne: false
            referencedRelation: "aether_api_request_records"
            referencedColumns: ["id"]
          },
        ]
      }
      aether_api_webhooks: {
        Row: {
          active: boolean
          created_at: string
          events: string[]
          id: string
          owner_id: string
          project_id: string | null
          secret_hash: string
          updated_at: string
          url: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          events?: string[]
          id?: string
          owner_id: string
          project_id?: string | null
          secret_hash: string
          updated_at?: string
          url: string
        }
        Update: {
          active?: boolean
          created_at?: string
          events?: string[]
          id?: string
          owner_id?: string
          project_id?: string | null
          secret_hash?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "aether_api_webhooks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      aether_knowledge_acquisition_jobs: {
        Row: {
          approval_status: string
          cancel_reason: string | null
          candidate_id: string | null
          completed_at: string | null
          confidence: number
          coverage: number
          created_at: string
          dedupe_key: string
          depth_tier: string
          domain_count: number
          id: string
          last_event_at: string | null
          owner_id: string
          paused_at: string | null
          project_id: string | null
          related_concepts: Json
          report_ids: string[]
          run_id: string | null
          scope: Json
          source_count: number
          source_type: string
          started_at: string | null
          status: string
          subject: string
          target_model_keys: string[]
          target_type: string
          task_id: string
          time_budget_ms: number
          title: string
          unresolved_items: Json
          updated_at: string
        }
        Insert: {
          approval_status?: string
          cancel_reason?: string | null
          candidate_id?: string | null
          completed_at?: string | null
          confidence?: number
          coverage?: number
          created_at?: string
          dedupe_key?: string
          depth_tier?: string
          domain_count?: number
          id?: string
          last_event_at?: string | null
          owner_id: string
          paused_at?: string | null
          project_id?: string | null
          related_concepts?: Json
          report_ids?: string[]
          run_id?: string | null
          scope?: Json
          source_count?: number
          source_type?: string
          started_at?: string | null
          status?: string
          subject: string
          target_model_keys?: string[]
          target_type?: string
          task_id: string
          time_budget_ms?: number
          title: string
          unresolved_items?: Json
          updated_at?: string
        }
        Update: {
          approval_status?: string
          cancel_reason?: string | null
          candidate_id?: string | null
          completed_at?: string | null
          confidence?: number
          coverage?: number
          created_at?: string
          dedupe_key?: string
          depth_tier?: string
          domain_count?: number
          id?: string
          last_event_at?: string | null
          owner_id?: string
          paused_at?: string | null
          project_id?: string | null
          related_concepts?: Json
          report_ids?: string[]
          run_id?: string | null
          scope?: Json
          source_count?: number
          source_type?: string
          started_at?: string | null
          status?: string
          subject?: string
          target_model_keys?: string[]
          target_type?: string
          task_id?: string
          time_budget_ms?: number
          title?: string
          unresolved_items?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aether_knowledge_acquisition_jobs_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "aether_knowledge_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_knowledge_acquisition_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_knowledge_acquisition_jobs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "task_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_knowledge_acquisition_jobs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: true
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      aether_knowledge_candidates: {
        Row: {
          claims: Json
          confidence: number
          conflicts: Json
          content: string
          content_hash: string
          created_at: string
          duplicate_of: string | null
          entities: Json
          freshness_state: string
          id: string
          metadata: Json
          normalized_content: string
          owner_id: string
          project_id: string | null
          provenance: Json
          published_entry_id: string | null
          relations: Json
          reviewed_at: string | null
          reviewed_by: string | null
          source_ids: string[]
          source_metadata: Json
          status: string
          title: string
          updated_at: string
          verification_run_id: string | null
          verification_status: string
        }
        Insert: {
          claims?: Json
          confidence?: number
          conflicts?: Json
          content: string
          content_hash: string
          created_at?: string
          duplicate_of?: string | null
          entities?: Json
          freshness_state?: string
          id?: string
          metadata?: Json
          normalized_content: string
          owner_id: string
          project_id?: string | null
          provenance?: Json
          published_entry_id?: string | null
          relations?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_ids?: string[]
          source_metadata?: Json
          status?: string
          title: string
          updated_at?: string
          verification_run_id?: string | null
          verification_status?: string
        }
        Update: {
          claims?: Json
          confidence?: number
          conflicts?: Json
          content?: string
          content_hash?: string
          created_at?: string
          duplicate_of?: string | null
          entities?: Json
          freshness_state?: string
          id?: string
          metadata?: Json
          normalized_content?: string
          owner_id?: string
          project_id?: string | null
          provenance?: Json
          published_entry_id?: string | null
          relations?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_ids?: string[]
          source_metadata?: Json
          status?: string
          title?: string
          updated_at?: string
          verification_run_id?: string | null
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "aether_knowledge_candidates_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "aether_knowledge_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_knowledge_candidates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_knowledge_candidates_published_entry_id_fkey"
            columns: ["published_entry_id"]
            isOneToOne: false
            referencedRelation: "knowledge_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_knowledge_candidates_verification_run_id_fkey"
            columns: ["verification_run_id"]
            isOneToOne: false
            referencedRelation: "verification_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      aether_knowledge_chunks: {
        Row: {
          chunk_index: number
          content: string
          content_hash: string
          created_at: string
          entry_id: string
          id: string
          is_current: boolean
          metadata: Json
          owner_id: string
          project_id: string | null
          token_estimate: number
          updated_at: string
          version: number
        }
        Insert: {
          chunk_index: number
          content: string
          content_hash: string
          created_at?: string
          entry_id: string
          id?: string
          is_current?: boolean
          metadata?: Json
          owner_id: string
          project_id?: string | null
          token_estimate?: number
          updated_at?: string
          version: number
        }
        Update: {
          chunk_index?: number
          content?: string
          content_hash?: string
          created_at?: string
          entry_id?: string
          id?: string
          is_current?: boolean
          metadata?: Json
          owner_id?: string
          project_id?: string | null
          token_estimate?: number
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "aether_knowledge_chunks_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "knowledge_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_knowledge_chunks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      aether_knowledge_decisions: {
        Row: {
          actor_id: string | null
          candidate_id: string | null
          created_at: string
          decision: string
          entry_id: string | null
          id: string
          metadata: Json
          new_status: string | null
          owner_id: string
          previous_status: string | null
          reason: string | null
        }
        Insert: {
          actor_id?: string | null
          candidate_id?: string | null
          created_at?: string
          decision: string
          entry_id?: string | null
          id?: string
          metadata?: Json
          new_status?: string | null
          owner_id: string
          previous_status?: string | null
          reason?: string | null
        }
        Update: {
          actor_id?: string | null
          candidate_id?: string | null
          created_at?: string
          decision?: string
          entry_id?: string | null
          id?: string
          metadata?: Json
          new_status?: string | null
          owner_id?: string
          previous_status?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aether_knowledge_decisions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "aether_knowledge_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_knowledge_decisions_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "knowledge_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      aether_knowledge_embeddings: {
        Row: {
          chunk_id: string
          content_hash: string
          created_at: string
          dimensions: number
          embedding: string
          id: string
          is_current: boolean
          model: string
          owner_id: string
          project_id: string | null
          provider: string
        }
        Insert: {
          chunk_id: string
          content_hash: string
          created_at?: string
          dimensions: number
          embedding: string
          id?: string
          is_current?: boolean
          model: string
          owner_id: string
          project_id?: string | null
          provider: string
        }
        Update: {
          chunk_id?: string
          content_hash?: string
          created_at?: string
          dimensions?: number
          embedding?: string
          id?: string
          is_current?: boolean
          model?: string
          owner_id?: string
          project_id?: string | null
          provider?: string
        }
        Relationships: [
          {
            foreignKeyName: "aether_knowledge_embeddings_chunk_id_fkey"
            columns: ["chunk_id"]
            isOneToOne: false
            referencedRelation: "aether_knowledge_chunks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_knowledge_embeddings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      aether_knowledge_entities: {
        Row: {
          attributes: Json
          candidate_id: string
          created_at: string
          entity_type: string
          id: string
          name: string
          normalized_name: string
          owner_id: string
          project_id: string | null
          provenance: Json
        }
        Insert: {
          attributes?: Json
          candidate_id: string
          created_at?: string
          entity_type?: string
          id?: string
          name: string
          normalized_name: string
          owner_id: string
          project_id?: string | null
          provenance?: Json
        }
        Update: {
          attributes?: Json
          candidate_id?: string
          created_at?: string
          entity_type?: string
          id?: string
          name?: string
          normalized_name?: string
          owner_id?: string
          project_id?: string | null
          provenance?: Json
        }
        Relationships: [
          {
            foreignKeyName: "aether_knowledge_entities_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "aether_knowledge_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_knowledge_entities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      aether_knowledge_graph_edges: {
        Row: {
          confidence: number
          created_at: string
          id: string
          object_node_id: string
          owner_id: string
          predicate: string
          project_id: string | null
          provenance: Json
          source_candidate_id: string | null
          source_entry_id: string | null
          source_version_id: string | null
          subject_node_id: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          id?: string
          object_node_id: string
          owner_id: string
          predicate: string
          project_id?: string | null
          provenance?: Json
          source_candidate_id?: string | null
          source_entry_id?: string | null
          source_version_id?: string | null
          subject_node_id: string
        }
        Update: {
          confidence?: number
          created_at?: string
          id?: string
          object_node_id?: string
          owner_id?: string
          predicate?: string
          project_id?: string | null
          provenance?: Json
          source_candidate_id?: string | null
          source_entry_id?: string | null
          source_version_id?: string | null
          subject_node_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aether_knowledge_graph_edges_object_node_id_fkey"
            columns: ["object_node_id"]
            isOneToOne: false
            referencedRelation: "aether_knowledge_graph_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_knowledge_graph_edges_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_knowledge_graph_edges_source_candidate_id_fkey"
            columns: ["source_candidate_id"]
            isOneToOne: false
            referencedRelation: "aether_knowledge_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_knowledge_graph_edges_source_entry_id_fkey"
            columns: ["source_entry_id"]
            isOneToOne: false
            referencedRelation: "knowledge_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_knowledge_graph_edges_source_version_id_fkey"
            columns: ["source_version_id"]
            isOneToOne: false
            referencedRelation: "aether_knowledge_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_knowledge_graph_edges_subject_node_id_fkey"
            columns: ["subject_node_id"]
            isOneToOne: false
            referencedRelation: "aether_knowledge_graph_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      aether_knowledge_graph_nodes: {
        Row: {
          attributes: Json
          canonical_name: string
          created_at: string
          entity_type: string
          id: string
          normalized_name: string
          owner_id: string
          project_id: string | null
          provenance: Json
          source_candidate_id: string | null
          source_entry_id: string | null
          source_version_id: string | null
          updated_at: string
        }
        Insert: {
          attributes?: Json
          canonical_name: string
          created_at?: string
          entity_type?: string
          id?: string
          normalized_name: string
          owner_id: string
          project_id?: string | null
          provenance?: Json
          source_candidate_id?: string | null
          source_entry_id?: string | null
          source_version_id?: string | null
          updated_at?: string
        }
        Update: {
          attributes?: Json
          canonical_name?: string
          created_at?: string
          entity_type?: string
          id?: string
          normalized_name?: string
          owner_id?: string
          project_id?: string | null
          provenance?: Json
          source_candidate_id?: string | null
          source_entry_id?: string | null
          source_version_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aether_knowledge_graph_nodes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_knowledge_graph_nodes_source_candidate_id_fkey"
            columns: ["source_candidate_id"]
            isOneToOne: false
            referencedRelation: "aether_knowledge_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_knowledge_graph_nodes_source_entry_id_fkey"
            columns: ["source_entry_id"]
            isOneToOne: false
            referencedRelation: "knowledge_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_knowledge_graph_nodes_source_version_id_fkey"
            columns: ["source_version_id"]
            isOneToOne: false
            referencedRelation: "aether_knowledge_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      aether_knowledge_provenance: {
        Row: {
          candidate_id: string | null
          created_at: string
          entry_id: string | null
          evidence_ids: string[]
          id: string
          metadata: Json
          owner_id: string
          source_hash: string | null
          source_id: string | null
          source_type: string
          source_url: string | null
          verification_run_id: string | null
        }
        Insert: {
          candidate_id?: string | null
          created_at?: string
          entry_id?: string | null
          evidence_ids?: string[]
          id?: string
          metadata?: Json
          owner_id: string
          source_hash?: string | null
          source_id?: string | null
          source_type: string
          source_url?: string | null
          verification_run_id?: string | null
        }
        Update: {
          candidate_id?: string | null
          created_at?: string
          entry_id?: string | null
          evidence_ids?: string[]
          id?: string
          metadata?: Json
          owner_id?: string
          source_hash?: string | null
          source_id?: string | null
          source_type?: string
          source_url?: string | null
          verification_run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aether_knowledge_provenance_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "aether_knowledge_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_knowledge_provenance_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "knowledge_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_knowledge_provenance_verification_run_id_fkey"
            columns: ["verification_run_id"]
            isOneToOne: false
            referencedRelation: "verification_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      aether_knowledge_relations: {
        Row: {
          candidate_id: string
          confidence: number
          created_at: string
          id: string
          object: string
          owner_id: string
          predicate: string
          project_id: string | null
          provenance: Json
          subject: string
        }
        Insert: {
          candidate_id: string
          confidence?: number
          created_at?: string
          id?: string
          object: string
          owner_id: string
          predicate: string
          project_id?: string | null
          provenance?: Json
          subject: string
        }
        Update: {
          candidate_id?: string
          confidence?: number
          created_at?: string
          id?: string
          object?: string
          owner_id?: string
          predicate?: string
          project_id?: string | null
          provenance?: Json
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "aether_knowledge_relations_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "aether_knowledge_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_knowledge_relations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      aether_knowledge_versions: {
        Row: {
          actor_id: string | null
          body: string
          change_note: string | null
          change_type: string
          created_at: string
          entry_id: string
          id: string
          owner_id: string
          provenance: Json
          source_candidate_id: string | null
          stage: string
          title: string
          version: number
        }
        Insert: {
          actor_id?: string | null
          body: string
          change_note?: string | null
          change_type: string
          created_at?: string
          entry_id: string
          id?: string
          owner_id: string
          provenance?: Json
          source_candidate_id?: string | null
          stage: string
          title: string
          version: number
        }
        Update: {
          actor_id?: string | null
          body?: string
          change_note?: string | null
          change_type?: string
          created_at?: string
          entry_id?: string
          id?: string
          owner_id?: string
          provenance?: Json
          source_candidate_id?: string | null
          stage?: string
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "aether_knowledge_versions_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "knowledge_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_knowledge_versions_source_candidate_id_fkey"
            columns: ["source_candidate_id"]
            isOneToOne: false
            referencedRelation: "aether_knowledge_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      aether_memories: {
        Row: {
          confidence: number | null
          content: string
          created_at: string
          deleted_at: string | null
          id: string
          importance: number
          last_used_at: string | null
          memory_type: string
          owner_id: string
          persistence_mode: string
          previous_memory_id: string | null
          project_id: string | null
          reason: string
          scope: string
          source_conversation_id: string | null
          source_message_id: string | null
          source_task_id: string | null
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          confidence?: number | null
          content: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          importance?: number
          last_used_at?: string | null
          memory_type?: string
          owner_id: string
          persistence_mode?: string
          previous_memory_id?: string | null
          project_id?: string | null
          reason?: string
          scope: string
          source_conversation_id?: string | null
          source_message_id?: string | null
          source_task_id?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          confidence?: number | null
          content?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          importance?: number
          last_used_at?: string | null
          memory_type?: string
          owner_id?: string
          persistence_mode?: string
          previous_memory_id?: string | null
          project_id?: string | null
          reason?: string
          scope?: string
          source_conversation_id?: string | null
          source_message_id?: string | null
          source_task_id?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "aether_memories_previous_memory_id_fkey"
            columns: ["previous_memory_id"]
            isOneToOne: false
            referencedRelation: "aether_memories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_memories_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_memories_source_conversation_id_fkey"
            columns: ["source_conversation_id"]
            isOneToOne: false
            referencedRelation: "aax_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_memories_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "aax_conversation_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_memories_source_task_id_fkey"
            columns: ["source_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      aether_memory_candidates: {
        Row: {
          confidence: number | null
          content: string
          created_at: string
          id: string
          memory_id: string | null
          memory_type: string
          owner_id: string
          project_id: string | null
          provenance: Json
          reason: string
          reviewed_at: string | null
          reviewed_by: string | null
          scope: string
          source_conversation_id: string | null
          source_message_id: string | null
          source_task_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          confidence?: number | null
          content: string
          created_at?: string
          id?: string
          memory_id?: string | null
          memory_type?: string
          owner_id: string
          project_id?: string | null
          provenance?: Json
          reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          scope: string
          source_conversation_id?: string | null
          source_message_id?: string | null
          source_task_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          confidence?: number | null
          content?: string
          created_at?: string
          id?: string
          memory_id?: string | null
          memory_type?: string
          owner_id?: string
          project_id?: string | null
          provenance?: Json
          reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          scope?: string
          source_conversation_id?: string | null
          source_message_id?: string | null
          source_task_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aether_memory_candidates_memory_id_fkey"
            columns: ["memory_id"]
            isOneToOne: false
            referencedRelation: "aether_memories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_memory_candidates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_memory_candidates_source_conversation_id_fkey"
            columns: ["source_conversation_id"]
            isOneToOne: false
            referencedRelation: "aax_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_memory_candidates_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "aax_conversation_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_memory_candidates_source_task_id_fkey"
            columns: ["source_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      aether_memory_events: {
        Row: {
          actor_id: string | null
          candidate_id: string | null
          created_at: string
          event_type: string
          id: string
          memory_id: string | null
          metadata: Json
          owner_id: string
          source_conversation_id: string | null
          source_task_id: string | null
        }
        Insert: {
          actor_id?: string | null
          candidate_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          memory_id?: string | null
          metadata?: Json
          owner_id: string
          source_conversation_id?: string | null
          source_task_id?: string | null
        }
        Update: {
          actor_id?: string | null
          candidate_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          memory_id?: string | null
          metadata?: Json
          owner_id?: string
          source_conversation_id?: string | null
          source_task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aether_memory_events_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "aether_memory_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_memory_events_memory_id_fkey"
            columns: ["memory_id"]
            isOneToOne: false
            referencedRelation: "aether_memories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_memory_events_source_conversation_id_fkey"
            columns: ["source_conversation_id"]
            isOneToOne: false
            referencedRelation: "aax_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_memory_events_source_task_id_fkey"
            columns: ["source_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      aether_project_files: {
        Row: {
          created_at: string
          extracted_text: string | null
          extraction_status: string
          filename: string
          id: string
          metadata: Json
          mime_type: string
          owner_id: string
          project_id: string
          sha256: string | null
          size_bytes: number
          storage_path: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          extracted_text?: string | null
          extraction_status?: string
          filename: string
          id?: string
          metadata?: Json
          mime_type: string
          owner_id: string
          project_id: string
          sha256?: string | null
          size_bytes: number
          storage_path: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          extracted_text?: string | null
          extraction_status?: string
          filename?: string
          id?: string
          metadata?: Json
          mime_type?: string
          owner_id?: string
          project_id?: string
          sha256?: string | null
          size_bytes?: number
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aether_project_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      aether_provider_credentials: {
        Row: {
          active: boolean
          base_url: string | null
          created_at: string
          created_by: string | null
          encrypted_api_key: string
          id: string
          label: string
          metadata: Json
          provider: string
          purpose: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          base_url?: string | null
          created_at?: string
          created_by?: string | null
          encrypted_api_key: string
          id?: string
          label: string
          metadata?: Json
          provider: string
          purpose: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          base_url?: string | null
          created_at?: string
          created_by?: string | null
          encrypted_api_key?: string
          id?: string
          label?: string
          metadata?: Json
          provider?: string
          purpose?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      aether_research_comparisons: {
        Row: {
          comparison: Json
          created_at: string
          id: string
          missing_evidence: Json
          owner_id: string
          project_id: string | null
          session_id: string
          source_ids: string[]
          status: string
          subject: string
          uncertainty: Json
        }
        Insert: {
          comparison?: Json
          created_at?: string
          id?: string
          missing_evidence?: Json
          owner_id: string
          project_id?: string | null
          session_id: string
          source_ids?: string[]
          status?: string
          subject: string
          uncertainty?: Json
        }
        Update: {
          comparison?: Json
          created_at?: string
          id?: string
          missing_evidence?: Json
          owner_id?: string
          project_id?: string | null
          session_id?: string
          source_ids?: string[]
          status?: string
          subject?: string
          uncertainty?: Json
        }
        Relationships: [
          {
            foreignKeyName: "aether_research_comparisons_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_research_comparisons_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "aether_research_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      aether_research_discovery_events: {
        Row: {
          created_at: string
          data: Json
          id: string
          owner_id: string
          project_id: string | null
          provider: string
          query: string
          result_count: number
          run_id: string | null
          sequence: number
          session_id: string | null
          status: string
          task_id: string | null
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          owner_id: string
          project_id?: string | null
          provider: string
          query: string
          result_count?: number
          run_id?: string | null
          sequence: number
          session_id?: string | null
          status: string
          task_id?: string | null
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          owner_id?: string
          project_id?: string | null
          provider?: string
          query?: string
          result_count?: number
          run_id?: string | null
          sequence?: number
          session_id?: string | null
          status?: string
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aether_research_discovery_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_research_discovery_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "task_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_research_discovery_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "aether_research_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_research_discovery_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      aether_research_plans: {
        Row: {
          comparison_rules: Json
          created_at: string
          id: string
          owner_id: string
          project_id: string | null
          queries: Json
          session_id: string | null
          source_requirements: Json
          status: string
          strategy: string
          topic: string
          updated_at: string
        }
        Insert: {
          comparison_rules?: Json
          created_at?: string
          id?: string
          owner_id: string
          project_id?: string | null
          queries?: Json
          session_id?: string | null
          source_requirements?: Json
          status?: string
          strategy?: string
          topic: string
          updated_at?: string
        }
        Update: {
          comparison_rules?: Json
          created_at?: string
          id?: string
          owner_id?: string
          project_id?: string | null
          queries?: Json
          session_id?: string | null
          source_requirements?: Json
          status?: string
          strategy?: string
          topic?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aether_research_plans_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_research_plans_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "aether_research_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      aether_research_policy_events: {
        Row: {
          created_at: string
          domain: string | null
          event_type: string
          id: string
          owner_id: string | null
          project_id: string | null
          reason: string | null
          retry_after_ms: number | null
          run_id: string | null
          session_id: string | null
          task_id: string | null
          url: string | null
        }
        Insert: {
          created_at?: string
          domain?: string | null
          event_type: string
          id?: string
          owner_id?: string | null
          project_id?: string | null
          reason?: string | null
          retry_after_ms?: number | null
          run_id?: string | null
          session_id?: string | null
          task_id?: string | null
          url?: string | null
        }
        Update: {
          created_at?: string
          domain?: string | null
          event_type?: string
          id?: string
          owner_id?: string | null
          project_id?: string | null
          reason?: string | null
          retry_after_ms?: number | null
          run_id?: string | null
          session_id?: string | null
          task_id?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aether_research_policy_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_research_policy_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "task_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_research_policy_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "aether_research_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_research_policy_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      aether_research_rate_limits: {
        Row: {
          domain: string
          id: string
          max_requests: number
          owner_id: string
          request_count: number
          window_seconds: number
          window_started_at: string
        }
        Insert: {
          domain: string
          id?: string
          max_requests?: number
          owner_id: string
          request_count?: number
          window_seconds?: number
          window_started_at: string
        }
        Update: {
          domain?: string
          id?: string
          max_requests?: number
          owner_id?: string
          request_count?: number
          window_seconds?: number
          window_started_at?: string
        }
        Relationships: []
      }
      aether_research_retrieval_attempts: {
        Row: {
          attempt: number
          backoff_ms: number | null
          ended_at: string | null
          error: string | null
          failure_class: string | null
          http_status: number | null
          id: string
          metadata: Json
          owner_id: string
          project_id: string | null
          session_id: string
          source_id: string | null
          started_at: string
          status: string
          worker: string | null
        }
        Insert: {
          attempt: number
          backoff_ms?: number | null
          ended_at?: string | null
          error?: string | null
          failure_class?: string | null
          http_status?: number | null
          id?: string
          metadata?: Json
          owner_id: string
          project_id?: string | null
          session_id: string
          source_id?: string | null
          started_at?: string
          status: string
          worker?: string | null
        }
        Update: {
          attempt?: number
          backoff_ms?: number | null
          ended_at?: string | null
          error?: string | null
          failure_class?: string | null
          http_status?: number | null
          id?: string
          metadata?: Json
          owner_id?: string
          project_id?: string | null
          session_id?: string
          source_id?: string | null
          started_at?: string
          status?: string
          worker?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aether_research_retrieval_attempts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_research_retrieval_attempts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "aether_research_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_research_retrieval_attempts_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "aether_research_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      aether_research_sessions: {
        Row: {
          completed_at: string | null
          diversity_score: number | null
          error: string | null
          freshness_policy: Json
          id: string
          last_event_at: string | null
          metadata: Json
          owner_id: string
          project_id: string | null
          query: string
          research_plan: Json
          run_id: string | null
          scope: string
          source_count: number
          started_at: string
          status: string
          task_id: string | null
        }
        Insert: {
          completed_at?: string | null
          diversity_score?: number | null
          error?: string | null
          freshness_policy?: Json
          id?: string
          last_event_at?: string | null
          metadata?: Json
          owner_id: string
          project_id?: string | null
          query: string
          research_plan?: Json
          run_id?: string | null
          scope: string
          source_count?: number
          started_at?: string
          status?: string
          task_id?: string | null
        }
        Update: {
          completed_at?: string | null
          diversity_score?: number | null
          error?: string | null
          freshness_policy?: Json
          id?: string
          last_event_at?: string | null
          metadata?: Json
          owner_id?: string
          project_id?: string | null
          query?: string
          research_plan?: Json
          run_id?: string | null
          scope?: string
          source_count?: number
          started_at?: string
          status?: string
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aether_research_sessions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_research_sessions_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "task_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_research_sessions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      aether_research_source_versions: {
        Row: {
          change_state: string
          content_hash: string
          content_length: number | null
          id: string
          metadata: Json
          owner_id: string
          parser_version: string | null
          project_id: string | null
          retrieved_at: string
          source_id: string
          version_number: number
        }
        Insert: {
          change_state?: string
          content_hash: string
          content_length?: number | null
          id?: string
          metadata?: Json
          owner_id: string
          parser_version?: string | null
          project_id?: string | null
          retrieved_at?: string
          source_id: string
          version_number: number
        }
        Update: {
          change_state?: string
          content_hash?: string
          content_length?: number | null
          id?: string
          metadata?: Json
          owner_id?: string
          parser_version?: string | null
          project_id?: string | null
          retrieved_at?: string
          source_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "aether_research_source_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_research_source_versions_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "aether_research_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      aether_research_sources: {
        Row: {
          author: string | null
          canonical_url: string | null
          change_detected_at: string | null
          change_state: string | null
          content: string | null
          content_hash: string | null
          content_length: number | null
          content_type: string | null
          domain: string
          encoding: string | null
          error: string | null
          failure_class: string | null
          failure_code: string | null
          final_url: string | null
          headings: Json
          http_status: number | null
          id: string
          last_checked_at: string | null
          links: Json
          owner_id: string
          parser_version: string | null
          previous_content_hash: string | null
          project_id: string | null
          provider: string
          published_at: string | null
          quality_factors: Json
          quality_metadata: Json
          quality_score: number | null
          redirect_chain: Json
          redirect_count: number
          retrieval_attempts: number
          retrieval_policy: Json
          retrieved_at: string
          robots_allowed: boolean | null
          session_id: string
          snippet: string | null
          stale_at: string | null
          stale_reason: string | null
          status: string
          terms_limited: boolean
          title: string | null
          updated_at_source: string | null
          url: string
          version_id: string | null
          warnings: Json
        }
        Insert: {
          author?: string | null
          canonical_url?: string | null
          change_detected_at?: string | null
          change_state?: string | null
          content?: string | null
          content_hash?: string | null
          content_length?: number | null
          content_type?: string | null
          domain: string
          encoding?: string | null
          error?: string | null
          failure_class?: string | null
          failure_code?: string | null
          final_url?: string | null
          headings?: Json
          http_status?: number | null
          id?: string
          last_checked_at?: string | null
          links?: Json
          owner_id: string
          parser_version?: string | null
          previous_content_hash?: string | null
          project_id?: string | null
          provider: string
          published_at?: string | null
          quality_factors?: Json
          quality_metadata?: Json
          quality_score?: number | null
          redirect_chain?: Json
          redirect_count?: number
          retrieval_attempts?: number
          retrieval_policy?: Json
          retrieved_at?: string
          robots_allowed?: boolean | null
          session_id: string
          snippet?: string | null
          stale_at?: string | null
          stale_reason?: string | null
          status?: string
          terms_limited?: boolean
          title?: string | null
          updated_at_source?: string | null
          url: string
          version_id?: string | null
          warnings?: Json
        }
        Update: {
          author?: string | null
          canonical_url?: string | null
          change_detected_at?: string | null
          change_state?: string | null
          content?: string | null
          content_hash?: string | null
          content_length?: number | null
          content_type?: string | null
          domain?: string
          encoding?: string | null
          error?: string | null
          failure_class?: string | null
          failure_code?: string | null
          final_url?: string | null
          headings?: Json
          http_status?: number | null
          id?: string
          last_checked_at?: string | null
          links?: Json
          owner_id?: string
          parser_version?: string | null
          previous_content_hash?: string | null
          project_id?: string | null
          provider?: string
          published_at?: string | null
          quality_factors?: Json
          quality_metadata?: Json
          quality_score?: number | null
          redirect_chain?: Json
          redirect_count?: number
          retrieval_attempts?: number
          retrieval_policy?: Json
          retrieved_at?: string
          robots_allowed?: boolean | null
          session_id?: string
          snippet?: string | null
          stale_at?: string | null
          stale_reason?: string | null
          status?: string
          terms_limited?: boolean
          title?: string | null
          updated_at_source?: string | null
          url?: string
          version_id?: string | null
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "aether_research_sources_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_research_sources_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "aether_research_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_research_sources_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "aether_research_source_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      aether_retrieval_index_jobs: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string
          entry_id: string
          id: string
          last_error: string | null
          owner_id: string
          project_id: string | null
          reason: string
          started_at: string | null
          status: string
          target_version: number | null
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          entry_id: string
          id?: string
          last_error?: string | null
          owner_id: string
          project_id?: string | null
          reason?: string
          started_at?: string | null
          status?: string
          target_version?: number | null
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          entry_id?: string
          id?: string
          last_error?: string | null
          owner_id?: string
          project_id?: string | null
          reason?: string
          started_at?: string | null
          status?: string
          target_version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "aether_retrieval_index_jobs_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "knowledge_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_retrieval_index_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      aether_retrieval_results: {
        Row: {
          chunk_id: string | null
          created_at: string
          entry_id: string
          final_score: number
          graph_score: number
          id: string
          lexical_score: number
          matched_terms: string[]
          metadata_score: number
          owner_id: string
          project_id: string | null
          provenance: Json
          rank: number
          retrieval_run_id: string
          semantic_score: number
          snippet: string
          version_id: string | null
        }
        Insert: {
          chunk_id?: string | null
          created_at?: string
          entry_id: string
          final_score?: number
          graph_score?: number
          id?: string
          lexical_score?: number
          matched_terms?: string[]
          metadata_score?: number
          owner_id: string
          project_id?: string | null
          provenance?: Json
          rank: number
          retrieval_run_id: string
          semantic_score?: number
          snippet: string
          version_id?: string | null
        }
        Update: {
          chunk_id?: string | null
          created_at?: string
          entry_id?: string
          final_score?: number
          graph_score?: number
          id?: string
          lexical_score?: number
          matched_terms?: string[]
          metadata_score?: number
          owner_id?: string
          project_id?: string | null
          provenance?: Json
          rank?: number
          retrieval_run_id?: string
          semantic_score?: number
          snippet?: string
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aether_retrieval_results_chunk_id_fkey"
            columns: ["chunk_id"]
            isOneToOne: false
            referencedRelation: "aether_knowledge_chunks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_retrieval_results_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "knowledge_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_retrieval_results_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_retrieval_results_retrieval_run_id_fkey"
            columns: ["retrieval_run_id"]
            isOneToOne: false
            referencedRelation: "aether_retrieval_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aether_retrieval_results_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "aether_knowledge_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      aether_retrieval_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          error: string | null
          id: string
          metadata: Json
          mode: string
          owner_id: string
          project_id: string | null
          query: string
          status: string
          top_k: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          metadata?: Json
          mode?: string
          owner_id: string
          project_id?: string | null
          query: string
          status?: string
          top_k?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          metadata?: Json
          mode?: string
          owner_id?: string
          project_id?: string | null
          query?: string
          status?: string
          top_k?: number
        }
        Relationships: [
          {
            foreignKeyName: "aether_retrieval_runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_action_audit: {
        Row: {
          action: string
          actor_id: string | null
          agent_id: string
          agent_key: string
          created_at: string
          decision: string
          id: string
          metadata: Json
          permission: string
          reason: string | null
          run_id: string | null
          task_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          agent_id: string
          agent_key: string
          created_at?: string
          decision: string
          id?: string
          metadata?: Json
          permission: string
          reason?: string | null
          run_id?: string | null
          task_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          agent_id?: string
          agent_key?: string
          created_at?: string
          decision?: string
          id?: string
          metadata?: Json
          permission?: string
          reason?: string | null
          run_id?: string | null
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_action_audit_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_action_audit_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "task_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_action_audit_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_config_history: {
        Row: {
          action: string
          actor_id: string | null
          after_config: Json | null
          agent_id: string
          before_config: Json | null
          created_at: string
          id: string
          reason: string | null
          version_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_config?: Json | null
          agent_id: string
          before_config?: Json | null
          created_at?: string
          id?: string
          reason?: string | null
          version_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_config?: Json | null
          agent_id?: string
          before_config?: Json | null
          created_at?: string
          id?: string
          reason?: string | null
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_config_history_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_config_history_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "agent_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_conversation_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          metadata: Json
          owner_id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          metadata?: Json
          owner_id: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          owner_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_conversation_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "agent_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_conversations: {
        Row: {
          agent_key: string
          archived: boolean
          created_at: string
          id: string
          last_message_at: string | null
          owner_id: string
          title: string
          updated_at: string
        }
        Insert: {
          agent_key: string
          archived?: boolean
          created_at?: string
          id?: string
          last_message_at?: string | null
          owner_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          agent_key?: string
          archived?: boolean
          created_at?: string
          id?: string
          last_message_at?: string | null
          owner_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      agent_handoffs: {
        Row: {
          accepted_at: string | null
          completed_at: string | null
          created_at: string
          from_agent: string
          id: string
          message_id: string | null
          payload: Json
          rejection_reason: string | null
          run_id: string | null
          status: string
          task_id: string
          to_agent: string
        }
        Insert: {
          accepted_at?: string | null
          completed_at?: string | null
          created_at?: string
          from_agent: string
          id?: string
          message_id?: string | null
          payload?: Json
          rejection_reason?: string | null
          run_id?: string | null
          status?: string
          task_id: string
          to_agent: string
        }
        Update: {
          accepted_at?: string | null
          completed_at?: string | null
          created_at?: string
          from_agent?: string
          id?: string
          message_id?: string | null
          payload?: Json
          rejection_reason?: string | null
          run_id?: string | null
          status?: string
          task_id?: string
          to_agent?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_handoffs_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "agent_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_handoffs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "task_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_handoffs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_learning_records: {
        Row: {
          agent_key: string
          approved_at: string | null
          approved_by: string | null
          candidate: Json
          confidence: number | null
          created_at: string
          id: string
          owner_id: string | null
          source_agent_key: string | null
          source_id: string | null
          source_type: string
          status: string
        }
        Insert: {
          agent_key: string
          approved_at?: string | null
          approved_by?: string | null
          candidate?: Json
          confidence?: number | null
          created_at?: string
          id?: string
          owner_id?: string | null
          source_agent_key?: string | null
          source_id?: string | null
          source_type: string
          status?: string
        }
        Update: {
          agent_key?: string
          approved_at?: string | null
          approved_by?: string | null
          candidate?: Json
          confidence?: number | null
          created_at?: string
          id?: string
          owner_id?: string | null
          source_agent_key?: string | null
          source_id?: string | null
          source_type?: string
          status?: string
        }
        Relationships: []
      }
      agent_messages: {
        Row: {
          correlation_id: string | null
          created_at: string
          from_agent: string
          id: string
          message_type: string
          payload: Json
          run_id: string | null
          sequence: number
          task_id: string | null
          to_agent: string
        }
        Insert: {
          correlation_id?: string | null
          created_at?: string
          from_agent: string
          id?: string
          message_type: string
          payload?: Json
          run_id?: string | null
          sequence?: number
          task_id?: string | null
          to_agent: string
        }
        Update: {
          correlation_id?: string | null
          created_at?: string
          from_agent?: string
          id?: string
          message_type?: string
          payload?: Json
          run_id?: string | null
          sequence?: number
          task_id?: string | null
          to_agent?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_messages_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "task_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_messages_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_permissions: {
        Row: {
          agent_id: string
          allowed: boolean
          created_at: string
          id: string
          permission: string
          requires_approval: boolean
        }
        Insert: {
          agent_id: string
          allowed?: boolean
          created_at?: string
          id?: string
          permission: string
          requires_approval?: boolean
        }
        Update: {
          agent_id?: string
          allowed?: boolean
          created_at?: string
          id?: string
          permission?: string
          requires_approval?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "agent_permissions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_productivity_metrics: {
        Row: {
          agent_key: string
          calculation: Json
          completed_count: number
          created_at: string
          evaluated_count: number
          failed_count: number
          id: string
          productivity_percent: number
          retried_count: number
          source_run_count: number
          window_end: string
          window_start: string
        }
        Insert: {
          agent_key: string
          calculation?: Json
          completed_count?: number
          created_at?: string
          evaluated_count?: number
          failed_count?: number
          id?: string
          productivity_percent: number
          retried_count?: number
          source_run_count?: number
          window_end: string
          window_start: string
        }
        Update: {
          agent_key?: string
          calculation?: Json
          completed_count?: number
          created_at?: string
          evaluated_count?: number
          failed_count?: number
          id?: string
          productivity_percent?: number
          retried_count?: number
          source_run_count?: number
          window_end?: string
          window_start?: string
        }
        Relationships: []
      }
      agent_sandbox_artifacts: {
        Row: {
          artifact_type: string
          checksum: string | null
          created_at: string
          id: string
          metadata: Json
          owner_id: string
          path: string
          session_id: string
        }
        Insert: {
          artifact_type: string
          checksum?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          owner_id: string
          path: string
          session_id: string
        }
        Update: {
          artifact_type?: string
          checksum?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          owner_id?: string
          path?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_sandbox_artifacts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "agent_sandbox_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_sandbox_sessions: {
        Row: {
          agent_id: string
          created_at: string
          ended_at: string | null
          expires_at: string
          id: string
          owner_id: string
          root_path: string
          run_id: string | null
          status: string
          task_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          ended_at?: string | null
          expires_at: string
          id?: string
          owner_id: string
          root_path: string
          run_id?: string | null
          status?: string
          task_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          ended_at?: string | null
          expires_at?: string
          id?: string
          owner_id?: string
          root_path?: string
          run_id?: string | null
          status?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_sandbox_sessions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_sandbox_sessions_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "task_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_sandbox_sessions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_versions: {
        Row: {
          activated_at: string | null
          activated_by: string | null
          agent_id: string
          config_hash: string
          created_at: string
          created_by: string | null
          definition: Json
          id: string
          lifecycle_state: string
          parent_version_id: string | null
          retired_at: string | null
          rollback_reason: string | null
          tested_at: string | null
          tested_by: string | null
          validated_at: string | null
          validated_by: string | null
          version: string
        }
        Insert: {
          activated_at?: string | null
          activated_by?: string | null
          agent_id: string
          config_hash: string
          created_at?: string
          created_by?: string | null
          definition?: Json
          id?: string
          lifecycle_state?: string
          parent_version_id?: string | null
          retired_at?: string | null
          rollback_reason?: string | null
          tested_at?: string | null
          tested_by?: string | null
          validated_at?: string | null
          validated_by?: string | null
          version: string
        }
        Update: {
          activated_at?: string | null
          activated_by?: string | null
          agent_id?: string
          config_hash?: string
          created_at?: string
          created_by?: string | null
          definition?: Json
          id?: string
          lifecycle_state?: string
          parent_version_id?: string | null
          retired_at?: string | null
          rollback_reason?: string | null
          tested_at?: string | null
          tested_by?: string | null
          validated_at?: string | null
          validated_by?: string | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_versions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_versions_parent_version_id_fkey"
            columns: ["parent_version_id"]
            isOneToOne: false
            referencedRelation: "agent_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          agent_key: string
          config: Json
          created_at: string
          description: string
          id: string
          last_activity_at: string | null
          name: string
          purpose: string
          status: Database["public"]["Enums"]["agent_status"]
          tools: string[]
          updated_at: string
        }
        Insert: {
          agent_key: string
          config?: Json
          created_at?: string
          description: string
          id?: string
          last_activity_at?: string | null
          name: string
          purpose: string
          status?: Database["public"]["Enums"]["agent_status"]
          tools?: string[]
          updated_at?: string
        }
        Update: {
          agent_key?: string
          config?: Json
          created_at?: string
          description?: string
          id?: string
          last_activity_at?: string | null
          name?: string
          purpose?: string
          status?: Database["public"]["Enums"]["agent_status"]
          tools?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      ai_stat_current: {
        Row: {
          entity_id: string
          entity_type: string
          metric_key: string
          updated_at: string
          value: number
        }
        Insert: {
          entity_id: string
          entity_type: string
          metric_key: string
          updated_at?: string
          value?: number
        }
        Update: {
          entity_id?: string
          entity_type?: string
          metric_key?: string
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      ai_stat_register: {
        Row: {
          created_at: string
          delta: number
          entity_id: string
          entity_type: string
          evaluation_id: string | null
          evidence: Json
          id: string
          knowledge_event_id: string | null
          metric_key: string
          new_value: number
          previous_value: number
          reason: string
          run_id: string | null
          task_id: string | null
        }
        Insert: {
          created_at?: string
          delta: number
          entity_id: string
          entity_type: string
          evaluation_id?: string | null
          evidence?: Json
          id?: string
          knowledge_event_id?: string | null
          metric_key: string
          new_value: number
          previous_value?: number
          reason: string
          run_id?: string | null
          task_id?: string | null
        }
        Update: {
          created_at?: string
          delta?: number
          entity_id?: string
          entity_type?: string
          evaluation_id?: string | null
          evidence?: Json
          id?: string
          knowledge_event_id?: string | null
          metric_key?: string
          new_value?: number
          previous_value?: number
          reason?: string
          run_id?: string | null
          task_id?: string | null
        }
        Relationships: []
      }
      ai_stat_snapshots: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          metrics: Json
          snapshot_date: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          metrics?: Json
          snapshot_date: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          metrics?: Json
          snapshot_date?: string
        }
        Relationships: []
      }
      api_key_scopes: {
        Row: {
          api_key_id: string
          id: string
          owner_id: string
          scope: string
        }
        Insert: {
          api_key_id: string
          id?: string
          owner_id: string
          scope: string
        }
        Update: {
          api_key_id?: string
          id?: string
          owner_id?: string
          scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_key_scopes_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          owner_id: string
          rate_limit_per_min: number
          status: Database["public"]["Enums"]["api_key_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          owner_id: string
          rate_limit_per_min?: number
          status?: Database["public"]["Enums"]["api_key_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          owner_id?: string
          rate_limit_per_min?: number
          status?: Database["public"]["Enums"]["api_key_status"]
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          ip: string | null
          metadata: Json
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          metadata?: Json
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          metadata?: Json
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      conversations: {
        Row: {
          archived: boolean
          created_at: string
          id: string
          memory_enabled: boolean
          model_role: string
          project_id: string | null
          title: string
          updated_at: string
          user_id: string
          web_research_enabled: boolean
        }
        Insert: {
          archived?: boolean
          created_at?: string
          id?: string
          memory_enabled?: boolean
          model_role?: string
          project_id?: string | null
          title?: string
          updated_at?: string
          user_id: string
          web_research_enabled?: boolean
        }
        Update: {
          archived?: boolean
          created_at?: string
          id?: string
          memory_enabled?: boolean
          model_role?: string
          project_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          web_research_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "conversations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_collections: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          owner_id: string
          project_id: string | null
          stage: Database["public"]["Enums"]["knowledge_stage"]
          tags: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id: string
          project_id?: string | null
          stage?: Database["public"]["Enums"]["knowledge_stage"]
          tags?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
          project_id?: string | null
          stage?: Database["public"]["Enums"]["knowledge_stage"]
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_collections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_entries: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          body: string | null
          collection_id: string
          confidence: number
          created_at: string
          current_version: number
          id: string
          owner_id: string
          platform_published: boolean
          platform_published_at: string | null
          sources: Json
          stage: Database["public"]["Enums"]["knowledge_stage"]
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          body?: string | null
          collection_id: string
          confidence?: number
          created_at?: string
          current_version?: number
          id?: string
          owner_id: string
          platform_published?: boolean
          platform_published_at?: string | null
          sources?: Json
          stage?: Database["public"]["Enums"]["knowledge_stage"]
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          body?: string | null
          collection_id?: string
          confidence?: number
          created_at?: string
          current_version?: number
          id?: string
          owner_id?: string
          platform_published?: boolean
          platform_published_at?: string | null
          sources?: Json
          stage?: Database["public"]["Enums"]["knowledge_stage"]
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_entries_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "knowledge_collections"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_versions: {
        Row: {
          body: string | null
          change_note: string | null
          created_at: string
          entry_id: string
          id: string
          owner_id: string
          stage: Database["public"]["Enums"]["knowledge_stage"]
          version: number
        }
        Insert: {
          body?: string | null
          change_note?: string | null
          created_at?: string
          entry_id: string
          id?: string
          owner_id: string
          stage?: Database["public"]["Enums"]["knowledge_stage"]
          version: number
        }
        Update: {
          body?: string | null
          change_note?: string | null
          created_at?: string
          entry_id?: string
          id?: string
          owner_id?: string
          stage?: Database["public"]["Enums"]["knowledge_stage"]
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_versions_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "knowledge_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      lifecycle_policies: {
        Row: {
          action: string
          enabled: boolean
          id: string
          resource_type: string
          retention_days: number
          updated_at: string
        }
        Insert: {
          action?: string
          enabled?: boolean
          id?: string
          resource_type: string
          retention_days: number
          updated_at?: string
        }
        Update: {
          action?: string
          enabled?: boolean
          id?: string
          resource_type?: string
          retention_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          model_role: string | null
          role: string
          tokens_in: number
          tokens_out: number
          tool_calls: Json
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          model_role?: string | null
          role: string
          tokens_in?: number
          tokens_out?: number
          tool_calls?: Json
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          model_role?: string | null
          role?: string
          tokens_in?: number
          tokens_out?: number
          tool_calls?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      module_artifacts: {
        Row: {
          artifact_type: string
          checksum: string | null
          created_at: string
          id: string
          metadata: Json
          module_id: string
          module_version_id: string | null
          owner_id: string
          path: string
          run_id: string | null
        }
        Insert: {
          artifact_type: string
          checksum?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          module_id: string
          module_version_id?: string | null
          owner_id: string
          path: string
          run_id?: string | null
        }
        Update: {
          artifact_type?: string
          checksum?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          module_id?: string
          module_version_id?: string | null
          owner_id?: string
          path?: string
          run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "module_artifacts_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_artifacts_module_version_id_fkey"
            columns: ["module_version_id"]
            isOneToOne: false
            referencedRelation: "module_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_artifacts_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "module_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      module_config_history: {
        Row: {
          action: string
          actor_id: string | null
          after_config: Json | null
          before_config: Json | null
          created_at: string
          id: string
          module_id: string
          reason: string | null
          version_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_config?: Json | null
          before_config?: Json | null
          created_at?: string
          id?: string
          module_id: string
          reason?: string | null
          version_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_config?: Json | null
          before_config?: Json | null
          created_at?: string
          id?: string
          module_id?: string
          reason?: string | null
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "module_config_history_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_config_history_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "module_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      module_dependencies: {
        Row: {
          dependency_module_id: string
          id: string
          module_version_id: string
          optional: boolean
          version_range: string
        }
        Insert: {
          dependency_module_id: string
          id?: string
          module_version_id: string
          optional?: boolean
          version_range: string
        }
        Update: {
          dependency_module_id?: string
          id?: string
          module_version_id?: string
          optional?: boolean
          version_range?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_dependencies_dependency_module_id_fkey"
            columns: ["dependency_module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_dependencies_module_version_id_fkey"
            columns: ["module_version_id"]
            isOneToOne: false
            referencedRelation: "module_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      module_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          id: string
          module_id: string
          module_version_id: string | null
          payload: Json
          run_id: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          module_id: string
          module_version_id?: string | null
          payload?: Json
          run_id?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          module_id?: string
          module_version_id?: string | null
          payload?: Json
          run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "module_events_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_events_module_version_id_fkey"
            columns: ["module_version_id"]
            isOneToOne: false
            referencedRelation: "module_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "module_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      module_permissions: {
        Row: {
          allowed: boolean
          id: string
          module_version_id: string
          permission: string
          requires_approval: boolean
        }
        Insert: {
          allowed?: boolean
          id?: string
          module_version_id: string
          permission: string
          requires_approval?: boolean
        }
        Update: {
          allowed?: boolean
          id?: string
          module_version_id?: string
          permission?: string
          requires_approval?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "module_permissions_module_version_id_fkey"
            columns: ["module_version_id"]
            isOneToOne: false
            referencedRelation: "module_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      module_runs: {
        Row: {
          attempt: number
          completed_at: string | null
          created_at: string
          error_message: string | null
          heartbeat_at: string | null
          id: string
          idempotency_key: string | null
          inputs: Json
          lease_expires_at: string | null
          max_attempts: number
          module_id: string
          module_version_id: string
          next_attempt_at: string | null
          outputs: Json
          owner_id: string
          run_id: string | null
          started_at: string | null
          status: string
          task_id: string | null
          updated_at: string
          worker_id: string | null
        }
        Insert: {
          attempt?: number
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          heartbeat_at?: string | null
          id?: string
          idempotency_key?: string | null
          inputs?: Json
          lease_expires_at?: string | null
          max_attempts?: number
          module_id: string
          module_version_id: string
          next_attempt_at?: string | null
          outputs?: Json
          owner_id: string
          run_id?: string | null
          started_at?: string | null
          status?: string
          task_id?: string | null
          updated_at?: string
          worker_id?: string | null
        }
        Update: {
          attempt?: number
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          heartbeat_at?: string | null
          id?: string
          idempotency_key?: string | null
          inputs?: Json
          lease_expires_at?: string | null
          max_attempts?: number
          module_id?: string
          module_version_id?: string
          next_attempt_at?: string | null
          outputs?: Json
          owner_id?: string
          run_id?: string | null
          started_at?: string | null
          status?: string
          task_id?: string | null
          updated_at?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "module_runs_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_runs_module_version_id_fkey"
            columns: ["module_version_id"]
            isOneToOne: false
            referencedRelation: "module_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_runs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "task_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_runs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      module_versions: {
        Row: {
          activated_at: string | null
          activated_by: string | null
          config: Json
          config_hash: string
          created_at: string
          created_by: string | null
          id: string
          lifecycle_state: string
          manifest: Json
          module_id: string
          parent_version_id: string | null
          reason: string | null
          retired_at: string | null
          tested_at: string | null
          tested_by: string | null
          validated_at: string | null
          validated_by: string | null
          version: string
        }
        Insert: {
          activated_at?: string | null
          activated_by?: string | null
          config?: Json
          config_hash: string
          created_at?: string
          created_by?: string | null
          id?: string
          lifecycle_state?: string
          manifest?: Json
          module_id: string
          parent_version_id?: string | null
          reason?: string | null
          retired_at?: string | null
          tested_at?: string | null
          tested_by?: string | null
          validated_at?: string | null
          validated_by?: string | null
          version: string
        }
        Update: {
          activated_at?: string | null
          activated_by?: string | null
          config?: Json
          config_hash?: string
          created_at?: string
          created_by?: string | null
          id?: string
          lifecycle_state?: string
          manifest?: Json
          module_id?: string
          parent_version_id?: string | null
          reason?: string | null
          retired_at?: string | null
          tested_at?: string | null
          tested_by?: string | null
          validated_at?: string | null
          validated_by?: string | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_versions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_versions_parent_version_id_fkey"
            columns: ["parent_version_id"]
            isOneToOne: false
            referencedRelation: "module_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          active_version_id: string | null
          config: Json
          created_at: string
          created_by: string | null
          description: string
          id: string
          last_activity_at: string | null
          manifest: Json
          module_kind: string
          name: string
          owner_id: string
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          active_version_id?: string | null
          config?: Json
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          last_activity_at?: string | null
          manifest?: Json
          module_kind?: string
          name: string
          owner_id: string
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          active_version_id?: string | null
          config?: Json
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          last_activity_at?: string | null
          manifest?: Json
          module_kind?: string
          name?: string
          owner_id?: string
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modules_active_version_fk"
            columns: ["active_version_id"]
            isOneToOne: false
            referencedRelation: "module_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_deliveries: {
        Row: {
          attempts: number
          channel: string
          created_at: string
          delivered_at: string | null
          destination: string | null
          error: string | null
          id: string
          idempotency_key: string | null
          next_attempt_at: string | null
          notification_id: string
          provider_message_id: string | null
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          channel: string
          created_at?: string
          delivered_at?: string | null
          destination?: string | null
          error?: string | null
          id?: string
          idempotency_key?: string | null
          next_attempt_at?: string | null
          notification_id: string
          provider_message_id?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          channel?: string
          created_at?: string
          delivered_at?: string | null
          destination?: string | null
          error?: string | null
          id?: string
          idempotency_key?: string | null
          next_attempt_at?: string | null
          notification_id?: string
          provider_message_id?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          email_address: string | null
          email_enabled: boolean
          event_types: string[]
          in_app_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          email_address?: string | null
          email_enabled?: boolean
          event_types?: string[]
          in_app_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          email_address?: string | null
          email_enabled?: boolean
          event_types?: string[]
          in_app_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          audience: string
          body: string | null
          created_at: string
          delivered_at: string | null
          delivery_attempts: number
          event_type: string
          id: string
          idempotency_key: string | null
          link: string | null
          metadata: Json
          read_at: string | null
          recipient_id: string
          resource_id: string | null
          resource_type: string | null
          status: string
          title: string
        }
        Insert: {
          audience?: string
          body?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_attempts?: number
          event_type: string
          id?: string
          idempotency_key?: string | null
          link?: string | null
          metadata?: Json
          read_at?: string | null
          recipient_id: string
          resource_id?: string | null
          resource_type?: string | null
          status?: string
          title: string
        }
        Update: {
          audience?: string
          body?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_attempts?: number
          event_type?: string
          id?: string
          idempotency_key?: string | null
          link?: string | null
          metadata?: Json
          read_at?: string | null
          recipient_id?: string
          resource_id?: string | null
          resource_type?: string | null
          status?: string
          title?: string
        }
        Relationships: []
      }
      optimization_actions: {
        Row: {
          action_type: string
          after_state: Json
          after_version_id: string | null
          before_state: Json
          before_version_id: string | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          idempotency_key: string
          recommendation_id: string
          requested_by: string | null
          started_at: string | null
          status: string
        }
        Insert: {
          action_type: string
          after_state?: Json
          after_version_id?: string | null
          before_state?: Json
          before_version_id?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          idempotency_key: string
          recommendation_id: string
          requested_by?: string | null
          started_at?: string | null
          status?: string
        }
        Update: {
          action_type?: string
          after_state?: Json
          after_version_id?: string | null
          before_state?: Json
          before_version_id?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          idempotency_key?: string
          recommendation_id?: string
          requested_by?: string | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "optimization_actions_after_version_id_fkey"
            columns: ["after_version_id"]
            isOneToOne: false
            referencedRelation: "agent_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "optimization_actions_before_version_id_fkey"
            columns: ["before_version_id"]
            isOneToOne: false
            referencedRelation: "agent_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "optimization_actions_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "optimization_recommendations"
            referencedColumns: ["id"]
          },
        ]
      }
      optimization_recommendations: {
        Row: {
          agent_key: string | null
          applied_at: string | null
          category: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_reason: string | null
          description: string
          evidence: Json
          fingerprint: string
          id: string
          rolled_back_at: string | null
          scan_id: string
          severity: string
          status: string
          suggested_change: Json
          title: string
          updated_at: string
        }
        Insert: {
          agent_key?: string | null
          applied_at?: string | null
          category: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          description: string
          evidence?: Json
          fingerprint: string
          id?: string
          rolled_back_at?: string | null
          scan_id: string
          severity: string
          status?: string
          suggested_change?: Json
          title: string
          updated_at?: string
        }
        Update: {
          agent_key?: string | null
          applied_at?: string | null
          category?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          description?: string
          evidence?: Json
          fingerprint?: string
          id?: string
          rolled_back_at?: string | null
          scan_id?: string
          severity?: string
          status?: string
          suggested_change?: Json
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "optimization_recommendations_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "optimization_scans"
            referencedColumns: ["id"]
          },
        ]
      }
      optimization_scans: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          idempotency_key: string
          metrics: Json
          recommendation_count: number
          requested_by: string | null
          scope: string
          started_at: string | null
          status: string
          telemetry_snapshot: Json
          updated_at: string
          window_end: string
          window_start: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          idempotency_key: string
          metrics?: Json
          recommendation_count?: number
          requested_by?: string | null
          scope?: string
          started_at?: string | null
          status?: string
          telemetry_snapshot?: Json
          updated_at?: string
          window_end: string
          window_start: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          idempotency_key?: string
          metrics?: Json
          recommendation_count?: number
          requested_by?: string | null
          scope?: string
          started_at?: string | null
          status?: string
          telemetry_snapshot?: Json
          updated_at?: string
          window_end?: string
          window_start?: string
        }
        Relationships: []
      }
      orchestration_events: {
        Row: {
          action: string | null
          actor_id: string | null
          actor_type: string
          created_at: string
          data: Json
          decision: string | null
          event_type: string
          id: string
          plan_id: string
          reason: string | null
          run_id: string | null
          sequence: number
          step_id: string | null
          task_id: string | null
        }
        Insert: {
          action?: string | null
          actor_id?: string | null
          actor_type: string
          created_at?: string
          data?: Json
          decision?: string | null
          event_type: string
          id?: string
          plan_id: string
          reason?: string | null
          run_id?: string | null
          sequence: number
          step_id?: string | null
          task_id?: string | null
        }
        Update: {
          action?: string | null
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          data?: Json
          decision?: string | null
          event_type?: string
          id?: string
          plan_id?: string
          reason?: string | null
          run_id?: string | null
          sequence?: number
          step_id?: string | null
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orchestration_events_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "orchestration_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orchestration_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "task_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orchestration_events_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "orchestration_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orchestration_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      orchestration_gates: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          gate_type: string
          id: string
          plan_id: string
          reason: string | null
          requested_by: string | null
          runtime_step_id: string
          status: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          gate_type: string
          id?: string
          plan_id: string
          reason?: string | null
          requested_by?: string | null
          runtime_step_id: string
          status?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          gate_type?: string
          id?: string
          plan_id?: string
          reason?: string | null
          requested_by?: string | null
          runtime_step_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "orchestration_gates_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "orchestration_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orchestration_gates_runtime_step_id_fkey"
            columns: ["runtime_step_id"]
            isOneToOne: false
            referencedRelation: "orchestration_step_runtime"
            referencedColumns: ["id"]
          },
        ]
      }
      orchestration_plans: {
        Row: {
          agents: Json
          approval_required: boolean
          approval_status: string
          capabilities: Json
          completed_at: string | null
          context: Json
          created_at: string
          expected_outputs: Json
          id: string
          intent: string
          model_requirements: Json
          owner_id: string
          risk_level: string
          run_id: string | null
          status: string
          supersedes_plan_id: string | null
          task_id: string | null
          title: string
          tools: Json
          updated_at: string
          version: number
        }
        Insert: {
          agents?: Json
          approval_required?: boolean
          approval_status?: string
          capabilities?: Json
          completed_at?: string | null
          context?: Json
          created_at?: string
          expected_outputs?: Json
          id?: string
          intent: string
          model_requirements?: Json
          owner_id: string
          risk_level?: string
          run_id?: string | null
          status?: string
          supersedes_plan_id?: string | null
          task_id?: string | null
          title: string
          tools?: Json
          updated_at?: string
          version?: number
        }
        Update: {
          agents?: Json
          approval_required?: boolean
          approval_status?: string
          capabilities?: Json
          completed_at?: string | null
          context?: Json
          created_at?: string
          expected_outputs?: Json
          id?: string
          intent?: string
          model_requirements?: Json
          owner_id?: string
          risk_level?: string
          run_id?: string | null
          status?: string
          supersedes_plan_id?: string | null
          task_id?: string | null
          title?: string
          tools?: Json
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "orchestration_plans_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "task_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orchestration_plans_supersedes_plan_id_fkey"
            columns: ["supersedes_plan_id"]
            isOneToOne: false
            referencedRelation: "orchestration_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orchestration_plans_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      orchestration_step_runtime: {
        Row: {
          agent_key: string
          completed_at: string | null
          critical: boolean
          depends_on_keys: Json
          errors: Json
          id: string
          lease_expires_at: string | null
          max_retries: number
          orchestration_step_id: string
          plan_id: string
          requires_approval: boolean
          requires_verification: boolean
          result: Json
          retry_count: number
          run_id: string | null
          sequence: number
          started_at: string | null
          status: string
          step_key: string
          timeout_ms: number
          updated_at: string
          warnings: Json
          worker_id: string | null
        }
        Insert: {
          agent_key: string
          completed_at?: string | null
          critical?: boolean
          depends_on_keys?: Json
          errors?: Json
          id?: string
          lease_expires_at?: string | null
          max_retries?: number
          orchestration_step_id: string
          plan_id: string
          requires_approval?: boolean
          requires_verification?: boolean
          result?: Json
          retry_count?: number
          run_id?: string | null
          sequence: number
          started_at?: string | null
          status?: string
          step_key: string
          timeout_ms?: number
          updated_at?: string
          warnings?: Json
          worker_id?: string | null
        }
        Update: {
          agent_key?: string
          completed_at?: string | null
          critical?: boolean
          depends_on_keys?: Json
          errors?: Json
          id?: string
          lease_expires_at?: string | null
          max_retries?: number
          orchestration_step_id?: string
          plan_id?: string
          requires_approval?: boolean
          requires_verification?: boolean
          result?: Json
          retry_count?: number
          run_id?: string | null
          sequence?: number
          started_at?: string | null
          status?: string
          step_key?: string
          timeout_ms?: number
          updated_at?: string
          warnings?: Json
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orchestration_step_runtime_agent_key_fkey"
            columns: ["agent_key"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["agent_key"]
          },
          {
            foreignKeyName: "orchestration_step_runtime_orchestration_step_id_fkey"
            columns: ["orchestration_step_id"]
            isOneToOne: false
            referencedRelation: "orchestration_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orchestration_step_runtime_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "orchestration_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orchestration_step_runtime_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "task_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      orchestration_steps: {
        Row: {
          agent_key: string | null
          approval_required: boolean
          completed_at: string | null
          created_at: string
          dependencies: string[]
          description: string | null
          error: string | null
          expected_output: Json
          id: string
          input_refs: Json
          kind: string
          model_role: string | null
          plan_id: string
          required_capabilities: Json
          result: Json
          risk_level: string
          sequence: number
          started_at: string | null
          status: string
          step_key: string
          task_id: string | null
          title: string
        }
        Insert: {
          agent_key?: string | null
          approval_required?: boolean
          completed_at?: string | null
          created_at?: string
          dependencies?: string[]
          description?: string | null
          error?: string | null
          expected_output?: Json
          id?: string
          input_refs?: Json
          kind: string
          model_role?: string | null
          plan_id: string
          required_capabilities?: Json
          result?: Json
          risk_level?: string
          sequence: number
          started_at?: string | null
          status?: string
          step_key: string
          task_id?: string | null
          title: string
        }
        Update: {
          agent_key?: string | null
          approval_required?: boolean
          completed_at?: string | null
          created_at?: string
          dependencies?: string[]
          description?: string | null
          error?: string | null
          expected_output?: Json
          id?: string
          input_refs?: Json
          kind?: string
          model_role?: string | null
          plan_id?: string
          required_capabilities?: Json
          result?: Json
          risk_level?: string
          sequence?: number
          started_at?: string | null
          status?: string
          step_key?: string
          task_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "orchestration_steps_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "orchestration_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orchestration_steps_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      orchestrator_configs: {
        Row: {
          activated_at: string | null
          change_note: string | null
          config: Json
          created_at: string
          created_by: string | null
          id: string
          rolled_back_at: string | null
          rolled_back_by: string | null
          status: string
          version: number
        }
        Insert: {
          activated_at?: string | null
          change_note?: string | null
          config?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          rolled_back_at?: string | null
          rolled_back_by?: string | null
          status?: string
          version: number
        }
        Update: {
          activated_at?: string | null
          change_note?: string | null
          config?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          rolled_back_at?: string | null
          rolled_back_by?: string | null
          status?: string
          version?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          default_model: string
          display_name: string | null
          id: string
          memory_enabled: boolean
          onboarding_completed: boolean
          preferred_language: string
          response_style: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          default_model?: string
          display_name?: string | null
          id: string
          memory_enabled?: boolean
          onboarding_completed?: boolean
          preferred_language?: string
          response_style?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          default_model?: string
          display_name?: string | null
          id?: string
          memory_enabled?: boolean
          onboarding_completed?: boolean
          preferred_language?: string
          response_style?: string
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          archived: boolean
          created_at: string
          description: string | null
          id: string
          memory_enabled: boolean
          metadata: Json
          name: string
          owner_id: string
          project_type: string
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          description?: string | null
          id?: string
          memory_enabled?: boolean
          metadata?: Json
          name: string
          owner_id: string
          project_type?: string
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          description?: string | null
          id?: string
          memory_enabled?: boolean
          metadata?: Json
          name?: string
          owner_id?: string
          project_type?: string
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      report_versions: {
        Row: {
          archived_at: string | null
          byte_size: number | null
          error: string | null
          file_path: string | null
          file_sha256: string | null
          generated_at: string
          id: string
          idempotency_key: string | null
          owner_id: string
          report_data: Json
          report_id: string
          status: string
          task_id: string | null
          task_run_id: string | null
          version: number
        }
        Insert: {
          archived_at?: string | null
          byte_size?: number | null
          error?: string | null
          file_path?: string | null
          file_sha256?: string | null
          generated_at?: string
          id?: string
          idempotency_key?: string | null
          owner_id: string
          report_data?: Json
          report_id: string
          status?: string
          task_id?: string | null
          task_run_id?: string | null
          version: number
        }
        Update: {
          archived_at?: string | null
          byte_size?: number | null
          error?: string | null
          file_path?: string | null
          file_sha256?: string | null
          generated_at?: string
          id?: string
          idempotency_key?: string | null
          owner_id?: string
          report_data?: Json
          report_id?: string
          status?: string
          task_id?: string | null
          task_run_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "report_versions_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_versions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_versions_task_run_id_fkey"
            columns: ["task_run_id"]
            isOneToOne: false
            referencedRelation: "task_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          approval_status: string
          archived_at: string | null
          created_at: string
          current_version: number
          file_path: string | null
          id: string
          metadata: Json
          owner_id: string
          project_id: string | null
          run_id: string | null
          source_count: number
          title: string
          topic: string | null
          updated_at: string
          verification_run_id: string | null
          verification_status: string
        }
        Insert: {
          approval_status?: string
          archived_at?: string | null
          created_at?: string
          current_version?: number
          file_path?: string | null
          id?: string
          metadata?: Json
          owner_id: string
          project_id?: string | null
          run_id?: string | null
          source_count?: number
          title: string
          topic?: string | null
          updated_at?: string
          verification_run_id?: string | null
          verification_status?: string
        }
        Update: {
          approval_status?: string
          archived_at?: string | null
          created_at?: string
          current_version?: number
          file_path?: string | null
          id?: string
          metadata?: Json
          owner_id?: string
          project_id?: string | null
          run_id?: string | null
          source_count?: number
          title?: string
          topic?: string | null
          updated_at?: string
          verification_run_id?: string | null
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "research_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_verification_run_id_fkey"
            columns: ["verification_run_id"]
            isOneToOne: false
            referencedRelation: "verification_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      research_findings: {
        Row: {
          claim: string
          confidence: number
          contradiction: boolean
          created_at: string
          evidence: string | null
          id: string
          run_id: string
          stage: Database["public"]["Enums"]["knowledge_stage"]
          user_id: string
        }
        Insert: {
          claim: string
          confidence?: number
          contradiction?: boolean
          created_at?: string
          evidence?: string | null
          id?: string
          run_id: string
          stage?: Database["public"]["Enums"]["knowledge_stage"]
          user_id: string
        }
        Update: {
          claim?: string
          confidence?: number
          contradiction?: boolean
          created_at?: string
          evidence?: string | null
          id?: string
          run_id?: string
          stage?: Database["public"]["Enums"]["knowledge_stage"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_findings_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "research_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      research_runs: {
        Row: {
          created_at: string
          depth: string
          duration_minutes: number
          id: string
          project_id: string | null
          source_types: string[]
          status: Database["public"]["Enums"]["task_status"]
          task_id: string | null
          topic: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          depth?: string
          duration_minutes?: number
          id?: string
          project_id?: string | null
          source_types?: string[]
          status?: Database["public"]["Enums"]["task_status"]
          task_id?: string | null
          topic: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          depth?: string
          duration_minutes?: number
          id?: string
          project_id?: string | null
          source_types?: string[]
          status?: Database["public"]["Enums"]["task_status"]
          task_id?: string | null
          topic?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_runs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      research_sources: {
        Row: {
          fetched_at: string
          id: string
          reliability: number | null
          run_id: string
          source_type: string
          title: string | null
          url: string | null
          user_id: string
        }
        Insert: {
          fetched_at?: string
          id?: string
          reliability?: number | null
          run_id: string
          source_type?: string
          title?: string | null
          url?: string | null
          user_id: string
        }
        Update: {
          fetched_at?: string
          id?: string
          reliability?: number | null
          run_id?: string
          source_type?: string
          title?: string | null
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_sources_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "research_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      runtime_quotas: {
        Row: {
          created_at: string
          id: string
          max_concurrent: number
          max_queue_depth: number
          max_retries: number
          max_runtime_ms: number
          scope_id: string | null
          scope_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          max_concurrent?: number
          max_queue_depth?: number
          max_retries?: number
          max_runtime_ms?: number
          scope_id?: string | null
          scope_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          max_concurrent?: number
          max_queue_depth?: number
          max_retries?: number
          max_runtime_ms?: number
          scope_id?: string | null
          scope_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      runtime_workers: {
        Row: {
          capacity: number
          current_run_id: string | null
          last_heartbeat_at: string
          metadata: Json
          started_at: string
          status: string
          updated_at: string
          worker_id: string
        }
        Insert: {
          capacity?: number
          current_run_id?: string | null
          last_heartbeat_at?: string
          metadata?: Json
          started_at?: string
          status?: string
          updated_at?: string
          worker_id: string
        }
        Update: {
          capacity?: number
          current_run_id?: string | null
          last_heartbeat_at?: string
          metadata?: Json
          started_at?: string
          status?: string
          updated_at?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "runtime_workers_current_run_id_fkey"
            columns: ["current_run_id"]
            isOneToOne: false
            referencedRelation: "task_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_bin_chat_messages: {
        Row: {
          actor_id: string
          content: string
          created_at: string
          id: string
          owner_id: string
          result_item_ids: string[]
          role: string
        }
        Insert: {
          actor_id: string
          content: string
          created_at?: string
          id?: string
          owner_id: string
          result_item_ids?: string[]
          role: string
        }
        Update: {
          actor_id?: string
          content?: string
          created_at?: string
          id?: string
          owner_id?: string
          result_item_ids?: string[]
          role?: string
        }
        Relationships: []
      }
      safety_bin_events: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          correlation_id: string | null
          created_at: string
          details: Json
          id: string
          item_id: string | null
          result: string
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          correlation_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          item_id?: string | null
          result?: string
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          correlation_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          item_id?: string | null
          result?: string
        }
        Relationships: [
          {
            foreignKeyName: "safety_bin_events_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "safety_bin_items"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_bin_exports: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          file_name: string | null
          format: string
          id: string
          item_ids: string[]
          owner_id: string
          requested_by: string
          status: string
          storage_path: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          file_name?: string | null
          format: string
          id?: string
          item_ids: string[]
          owner_id: string
          requested_by: string
          status?: string
          storage_path?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          file_name?: string | null
          format?: string
          id?: string
          item_ids?: string[]
          owner_id?: string
          requested_by?: string
          status?: string
          storage_path?: string | null
        }
        Relationships: []
      }
      safety_bin_investigations: {
        Row: {
          closed_at: string | null
          created_at: string
          created_by: string
          id: string
          notes: string | null
          owner_id: string
          status: string
          title: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          created_by: string
          id?: string
          notes?: string | null
          owner_id: string
          status?: string
          title: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          owner_id?: string
          status?: string
          title?: string
        }
        Relationships: []
      }
      safety_bin_items: {
        Row: {
          content: Json
          content_hash: string
          correlation_id: string | null
          created_at: string
          deleted_at: string
          deleted_by_email: string | null
          deleted_by_id: string | null
          deletion_method: string
          deletion_reason: string | null
          id: string
          object_name: string | null
          object_type: string
          original_created_at: string | null
          original_location: string | null
          original_updated_at: string | null
          permanent_deletion_status: string
          recovery_status: string
          related_run_id: string | null
          related_task_id: string | null
          source_object_id: string | null
          source_owner_id: string | null
          source_project_id: string | null
          source_schema: string
          source_table: string
          version: number
        }
        Insert: {
          content?: Json
          content_hash: string
          correlation_id?: string | null
          created_at?: string
          deleted_at?: string
          deleted_by_email?: string | null
          deleted_by_id?: string | null
          deletion_method?: string
          deletion_reason?: string | null
          id?: string
          object_name?: string | null
          object_type: string
          original_created_at?: string | null
          original_location?: string | null
          original_updated_at?: string | null
          permanent_deletion_status?: string
          recovery_status?: string
          related_run_id?: string | null
          related_task_id?: string | null
          source_object_id?: string | null
          source_owner_id?: string | null
          source_project_id?: string | null
          source_schema: string
          source_table: string
          version?: number
        }
        Update: {
          content?: Json
          content_hash?: string
          correlation_id?: string | null
          created_at?: string
          deleted_at?: string
          deleted_by_email?: string | null
          deleted_by_id?: string | null
          deletion_method?: string
          deletion_reason?: string | null
          id?: string
          object_name?: string | null
          object_type?: string
          original_created_at?: string | null
          original_location?: string | null
          original_updated_at?: string | null
          permanent_deletion_status?: string
          recovery_status?: string
          related_run_id?: string | null
          related_task_id?: string | null
          source_object_id?: string | null
          source_owner_id?: string | null
          source_project_id?: string | null
          source_schema?: string
          source_table?: string
          version?: number
        }
        Relationships: []
      }
      safety_bin_purge_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          id: string
          item_id: string
          reason: string | null
          requested_at: string
          requested_by: string
          status: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          id?: string
          item_id: string
          reason?: string | null
          requested_at?: string
          requested_by: string
          status?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          id?: string
          item_id?: string
          reason?: string | null
          requested_at?: string
          requested_by?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "safety_bin_purge_requests_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "safety_bin_items"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_bin_reports: {
        Row: {
          error_message: string | null
          file_name: string | null
          generated_at: string
          generated_by: string
          id: string
          item_count: number
          owner_id: string
          provenance: Json
          report_version: number
          status: string
          storage_path: string | null
          title: string
        }
        Insert: {
          error_message?: string | null
          file_name?: string | null
          generated_at?: string
          generated_by: string
          id?: string
          item_count?: number
          owner_id: string
          provenance?: Json
          report_version?: number
          status?: string
          storage_path?: string | null
          title: string
        }
        Update: {
          error_message?: string | null
          file_name?: string | null
          generated_at?: string
          generated_by?: string
          id?: string
          item_count?: number
          owner_id?: string
          provenance?: Json
          report_version?: number
          status?: string
          storage_path?: string | null
          title?: string
        }
        Relationships: []
      }
      safety_bin_restorations: {
        Row: {
          actor_id: string
          error_message: string | null
          id: string
          item_id: string
          restored_at: string
          result: string
          target_object_id: string | null
          target_table: string
        }
        Insert: {
          actor_id: string
          error_message?: string | null
          id?: string
          item_id: string
          restored_at?: string
          result: string
          target_object_id?: string | null
          target_table: string
        }
        Update: {
          actor_id?: string
          error_message?: string | null
          id?: string
          item_id?: string
          restored_at?: string
          result?: string
          target_object_id?: string | null
          target_table?: string
        }
        Relationships: [
          {
            foreignKeyName: "safety_bin_restorations_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "safety_bin_items"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_bin_versions: {
        Row: {
          captured_at: string
          content: Json
          content_hash: string
          id: string
          item_id: string
          version: number
        }
        Insert: {
          captured_at?: string
          content: Json
          content_hash: string
          id?: string
          item_id: string
          version: number
        }
        Update: {
          captured_at?: string
          content?: Json
          content_hash?: string
          id?: string
          item_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "safety_bin_versions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "safety_bin_items"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_runs: {
        Row: {
          attempt_count: number
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          idempotency_key: string
          lease_expires_at: string | null
          lease_token: string | null
          max_attempts: number
          owner_id: string
          payload: Json
          result: Json | null
          schedule_id: string
          scheduled_for: string
          started_at: string | null
          status: string
          task_id: string | null
          task_run_id: string | null
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key: string
          lease_expires_at?: string | null
          lease_token?: string | null
          max_attempts?: number
          owner_id: string
          payload?: Json
          result?: Json | null
          schedule_id: string
          scheduled_for: string
          started_at?: string | null
          status?: string
          task_id?: string | null
          task_run_id?: string | null
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key?: string
          lease_expires_at?: string | null
          lease_token?: string | null
          max_attempts?: number
          owner_id?: string
          payload?: Json
          result?: Json | null
          schedule_id?: string
          scheduled_for?: string
          started_at?: string | null
          status?: string
          task_id?: string | null
          task_run_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_runs_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_runs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_runs_task_run_id_fkey"
            columns: ["task_run_id"]
            isOneToOne: false
            referencedRelation: "task_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          last_run_at: string | null
          last_run_id: string | null
          name: string
          next_run_at: string | null
          owner_id: string
          payload: Json
          schedule_expression: string
          schedule_kind: string
          task_type: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          last_run_id?: string | null
          name: string
          next_run_at?: string | null
          owner_id: string
          payload?: Json
          schedule_expression: string
          schedule_kind: string
          task_type: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          last_run_id?: string | null
          name?: string
          next_run_at?: string | null
          owner_id?: string
          payload?: Json
          schedule_expression?: string
          schedule_kind?: string
          task_type?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      security_events: {
        Row: {
          action: string | null
          actor_id: string | null
          agent_key: string | null
          created_at: string
          event_type: string
          id: string
          message: string
          metadata: Json
          request_id: string | null
          resource_id: string | null
          resource_type: string | null
          run_id: string | null
          severity: string
          task_id: string | null
        }
        Insert: {
          action?: string | null
          actor_id?: string | null
          agent_key?: string | null
          created_at?: string
          event_type: string
          id?: string
          message: string
          metadata?: Json
          request_id?: string | null
          resource_id?: string | null
          resource_type?: string | null
          run_id?: string | null
          severity: string
          task_id?: string | null
        }
        Update: {
          action?: string | null
          actor_id?: string | null
          agent_key?: string | null
          created_at?: string
          event_type?: string
          id?: string
          message?: string
          metadata?: Json
          request_id?: string | null
          resource_id?: string | null
          resource_type?: string | null
          run_id?: string | null
          severity?: string
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "security_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "task_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      security_incidents: {
        Row: {
          actor_id: string | null
          agent_key: string | null
          assigned_to: string | null
          contained_at: string | null
          containment: Json
          created_at: string
          description: string
          id: string
          incident_key: string
          incident_type: string
          metadata: Json
          opened_at: string
          resolution: string | null
          resolved_at: string | null
          severity: string
          source_event_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          actor_id?: string | null
          agent_key?: string | null
          assigned_to?: string | null
          contained_at?: string | null
          containment?: Json
          created_at?: string
          description?: string
          id?: string
          incident_key: string
          incident_type: string
          metadata?: Json
          opened_at?: string
          resolution?: string | null
          resolved_at?: string | null
          severity: string
          source_event_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          actor_id?: string | null
          agent_key?: string | null
          assigned_to?: string | null
          contained_at?: string | null
          containment?: Json
          created_at?: string
          description?: string
          id?: string
          incident_key?: string
          incident_type?: string
          metadata?: Json
          opened_at?: string
          resolution?: string | null
          resolved_at?: string | null
          severity?: string
          source_event_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "security_incidents_source_event_id_fkey"
            columns: ["source_event_id"]
            isOneToOne: false
            referencedRelation: "security_events"
            referencedColumns: ["id"]
          },
        ]
      }
      security_policies: {
        Row: {
          action_pattern: string
          conditions: Json
          created_at: string
          created_by: string | null
          description: string
          effect: string
          id: string
          policy_key: string
          priority: number
          resource_type_pattern: string
          severity: string
          status: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          action_pattern?: string
          conditions?: Json
          created_at?: string
          created_by?: string | null
          description?: string
          effect: string
          id?: string
          policy_key: string
          priority?: number
          resource_type_pattern?: string
          severity?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          action_pattern?: string
          conditions?: Json
          created_at?: string
          created_by?: string | null
          description?: string
          effect?: string
          id?: string
          policy_key?: string
          priority?: number
          resource_type_pattern?: string
          severity?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: []
      }
      security_requests: {
        Row: {
          action: string
          actor_id: string | null
          agent_key: string | null
          context: Json
          created_at: string
          decision: string
          evaluated_at: string
          expires_at: string | null
          id: string
          idempotency_key: string
          matched_policy_ids: string[]
          reason: string
          resource_id: string | null
          resource_type: string | null
          run_id: string | null
          task_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          agent_key?: string | null
          context?: Json
          created_at?: string
          decision: string
          evaluated_at?: string
          expires_at?: string | null
          id?: string
          idempotency_key: string
          matched_policy_ids?: string[]
          reason: string
          resource_id?: string | null
          resource_type?: string | null
          run_id?: string | null
          task_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          agent_key?: string | null
          context?: Json
          created_at?: string
          decision?: string
          evaluated_at?: string
          expires_at?: string | null
          id?: string
          idempotency_key?: string
          matched_policy_ids?: string[]
          reason?: string
          resource_id?: string | null
          resource_type?: string | null
          run_id?: string | null
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_requests_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "task_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_requests_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_dead_letters: {
        Row: {
          dead_lettered_at: string
          error_message: string | null
          failure_code: string | null
          id: string
          owner_id: string
          payload: Json
          reason: string
          resolved_at: string | null
          resolved_by: string | null
          run_id: string | null
          task_id: string
        }
        Insert: {
          dead_lettered_at?: string
          error_message?: string | null
          failure_code?: string | null
          id?: string
          owner_id: string
          payload?: Json
          reason: string
          resolved_at?: string | null
          resolved_by?: string | null
          run_id?: string | null
          task_id: string
        }
        Update: {
          dead_lettered_at?: string
          error_message?: string | null
          failure_code?: string | null
          id?: string
          owner_id?: string
          payload?: Json
          reason?: string
          resolved_at?: string | null
          resolved_by?: string | null
          run_id?: string | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_dead_letters_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: true
            referencedRelation: "task_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_dead_letters_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_events: {
        Row: {
          actor_id: string | null
          created_at: string
          data: Json
          event_type: string
          from_status: Database["public"]["Enums"]["task_status"] | null
          id: string
          message: string | null
          run_id: string | null
          sequence: number
          task_id: string
          to_status: Database["public"]["Enums"]["task_status"] | null
          worker_id: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          data?: Json
          event_type: string
          from_status?: Database["public"]["Enums"]["task_status"] | null
          id?: string
          message?: string | null
          run_id?: string | null
          sequence: number
          task_id: string
          to_status?: Database["public"]["Enums"]["task_status"] | null
          worker_id?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          data?: Json
          event_type?: string
          from_status?: Database["public"]["Enums"]["task_status"] | null
          id?: string
          message?: string | null
          run_id?: string | null
          sequence?: number
          task_id?: string
          to_status?: Database["public"]["Enums"]["task_status"] | null
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "task_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_runs: {
        Row: {
          aax_model_id: string | null
          agent_id: string | null
          agent_key: string | null
          attempt: number
          cancel_requested_at: string | null
          cancellation_reason: string | null
          created_at: string
          deadline_at: string | null
          duration_ms: number | null
          ended_at: string | null
          error: string | null
          failure_code: string | null
          heartbeat_at: string | null
          id: string
          idempotency_key: string | null
          inputs: Json
          lease_expires_at: string | null
          max_retries: number
          next_attempt_at: string | null
          outputs: Json
          owner_id: string
          retry_count: number
          retry_of: string | null
          retryable: boolean | null
          started_at: string | null
          status: Database["public"]["Enums"]["task_status"]
          task_id: string
          timeout_ms: number
          updated_at: string
          worker_id: string | null
        }
        Insert: {
          aax_model_id?: string | null
          agent_id?: string | null
          agent_key?: string | null
          attempt?: number
          cancel_requested_at?: string | null
          cancellation_reason?: string | null
          created_at?: string
          deadline_at?: string | null
          duration_ms?: number | null
          ended_at?: string | null
          error?: string | null
          failure_code?: string | null
          heartbeat_at?: string | null
          id?: string
          idempotency_key?: string | null
          inputs?: Json
          lease_expires_at?: string | null
          max_retries?: number
          next_attempt_at?: string | null
          outputs?: Json
          owner_id: string
          retry_count?: number
          retry_of?: string | null
          retryable?: boolean | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          task_id: string
          timeout_ms?: number
          updated_at?: string
          worker_id?: string | null
        }
        Update: {
          aax_model_id?: string | null
          agent_id?: string | null
          agent_key?: string | null
          attempt?: number
          cancel_requested_at?: string | null
          cancellation_reason?: string | null
          created_at?: string
          deadline_at?: string | null
          duration_ms?: number | null
          ended_at?: string | null
          error?: string | null
          failure_code?: string | null
          heartbeat_at?: string | null
          id?: string
          idempotency_key?: string | null
          inputs?: Json
          lease_expires_at?: string | null
          max_retries?: number
          next_attempt_at?: string | null
          outputs?: Json
          owner_id?: string
          retry_count?: number
          retry_of?: string | null
          retryable?: boolean | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          task_id?: string
          timeout_ms?: number
          updated_at?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_runs_aax_model_id_fkey"
            columns: ["aax_model_id"]
            isOneToOne: false
            referencedRelation: "aax_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_runs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_runs_retry_of_fkey"
            columns: ["retry_of"]
            isOneToOne: false
            referencedRelation: "task_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_runs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          cancel_requested_at: string | null
          cancellation_reason: string | null
          completed_at: string | null
          created_at: string
          dead_lettered_at: string | null
          deadline_at: string | null
          detail: Json
          heartbeat_at: string | null
          id: string
          idempotency_key: string | null
          kind: string
          last_error_code: string | null
          last_error_message: string | null
          lease_expires_at: string | null
          max_retries: number
          next_attempt_at: string | null
          owner_id: string | null
          priority: number
          progress: number
          project_id: string | null
          retry_count: number
          started_at: string | null
          status: Database["public"]["Enums"]["task_status"]
          timeout_ms: number
          title: string
          updated_at: string
          user_id: string
          worker_id: string | null
        }
        Insert: {
          cancel_requested_at?: string | null
          cancellation_reason?: string | null
          completed_at?: string | null
          created_at?: string
          dead_lettered_at?: string | null
          deadline_at?: string | null
          detail?: Json
          heartbeat_at?: string | null
          id?: string
          idempotency_key?: string | null
          kind?: string
          last_error_code?: string | null
          last_error_message?: string | null
          lease_expires_at?: string | null
          max_retries?: number
          next_attempt_at?: string | null
          owner_id?: string | null
          priority?: number
          progress?: number
          project_id?: string | null
          retry_count?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          timeout_ms?: number
          title: string
          updated_at?: string
          user_id: string
          worker_id?: string | null
        }
        Update: {
          cancel_requested_at?: string | null
          cancellation_reason?: string | null
          completed_at?: string | null
          created_at?: string
          dead_lettered_at?: string | null
          deadline_at?: string | null
          detail?: Json
          heartbeat_at?: string | null
          id?: string
          idempotency_key?: string | null
          kind?: string
          last_error_code?: string | null
          last_error_message?: string | null
          lease_expires_at?: string | null
          max_retries?: number
          next_attempt_at?: string | null
          owner_id?: string | null
          priority?: number
          progress?: number
          project_id?: string | null
          retry_count?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          timeout_ms?: number
          title?: string
          updated_at?: string
          user_id?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_logs: {
        Row: {
          aax_model_id: string | null
          api_key_id: string | null
          cost: number | null
          created_at: string
          id: string
          kind: string
          latency_ms: number | null
          model_role: string | null
          provider: string | null
          provider_model: string | null
          run_id: string | null
          status: string | null
          task_id: string | null
          tokens_in: number
          tokens_out: number
          user_id: string | null
        }
        Insert: {
          aax_model_id?: string | null
          api_key_id?: string | null
          cost?: number | null
          created_at?: string
          id?: string
          kind: string
          latency_ms?: number | null
          model_role?: string | null
          provider?: string | null
          provider_model?: string | null
          run_id?: string | null
          status?: string | null
          task_id?: string | null
          tokens_in?: number
          tokens_out?: number
          user_id?: string | null
        }
        Update: {
          aax_model_id?: string | null
          api_key_id?: string | null
          cost?: number | null
          created_at?: string
          id?: string
          kind?: string
          latency_ms?: number | null
          model_role?: string | null
          provider?: string | null
          provider_model?: string | null
          run_id?: string | null
          status?: string | null
          task_id?: string | null
          tokens_in?: number
          tokens_out?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_logs_aax_model_id_fkey"
            columns: ["aax_model_id"]
            isOneToOne: false
            referencedRelation: "aax_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_logs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "task_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_logs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      user_lifecycle_requests: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          reason: string | null
          request_type: string
          requested_by: string
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          reason?: string | null
          request_type: string
          requested_by: string
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          reason?: string | null
          request_type?: string
          requested_by?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          granted_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          granted_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          granted_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      verification_claims: {
        Row: {
          authority_score: number
          claim: string
          confidence: number
          contradiction_count: number
          created_at: string
          date_mismatch_count: number
          evidence_strength: number
          freshness_score: number
          id: string
          metadata: Json
          missing_evidence: boolean
          normalized_claim: string
          owner_id: string
          requires_review: boolean
          review_reason: string | null
          uncertainty: Json
          updated_at: string
          verification_run_id: string
          verification_state: string
        }
        Insert: {
          authority_score?: number
          claim: string
          confidence?: number
          contradiction_count?: number
          created_at?: string
          date_mismatch_count?: number
          evidence_strength?: number
          freshness_score?: number
          id?: string
          metadata?: Json
          missing_evidence?: boolean
          normalized_claim: string
          owner_id: string
          requires_review?: boolean
          review_reason?: string | null
          uncertainty?: Json
          updated_at?: string
          verification_run_id: string
          verification_state?: string
        }
        Update: {
          authority_score?: number
          claim?: string
          confidence?: number
          contradiction_count?: number
          created_at?: string
          date_mismatch_count?: number
          evidence_strength?: number
          freshness_score?: number
          id?: string
          metadata?: Json
          missing_evidence?: boolean
          normalized_claim?: string
          owner_id?: string
          requires_review?: boolean
          review_reason?: string | null
          uncertainty?: Json
          updated_at?: string
          verification_run_id?: string
          verification_state?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_claims_verification_run_id_fkey"
            columns: ["verification_run_id"]
            isOneToOne: false
            referencedRelation: "verification_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_decisions: {
        Row: {
          actor_id: string | null
          claim_id: string
          created_at: string
          decision: string
          id: string
          metadata: Json
          new_state: string
          owner_id: string
          previous_state: string
          reason: string | null
        }
        Insert: {
          actor_id?: string | null
          claim_id: string
          created_at?: string
          decision: string
          id?: string
          metadata?: Json
          new_state: string
          owner_id: string
          previous_state: string
          reason?: string | null
        }
        Update: {
          actor_id?: string | null
          claim_id?: string
          created_at?: string
          decision?: string
          id?: string
          metadata?: Json
          new_state?: string
          owner_id?: string
          previous_state?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verification_decisions_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "verification_claims"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_evidence: {
        Row: {
          authority_score: number
          claim_id: string
          created_at: string
          evidence_strength: number
          excerpt: string
          freshness_score: number
          id: string
          metadata: Json
          owner_id: string
          published_at: string | null
          retrieved_at: string | null
          source_id: string | null
          source_title: string | null
          source_url: string | null
          supports_claim: boolean
        }
        Insert: {
          authority_score?: number
          claim_id: string
          created_at?: string
          evidence_strength?: number
          excerpt: string
          freshness_score?: number
          id?: string
          metadata?: Json
          owner_id: string
          published_at?: string | null
          retrieved_at?: string | null
          source_id?: string | null
          source_title?: string | null
          source_url?: string | null
          supports_claim: boolean
        }
        Update: {
          authority_score?: number
          claim_id?: string
          created_at?: string
          evidence_strength?: number
          excerpt?: string
          freshness_score?: number
          id?: string
          metadata?: Json
          owner_id?: string
          published_at?: string | null
          retrieved_at?: string | null
          source_id?: string | null
          source_title?: string | null
          source_url?: string | null
          supports_claim?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "verification_evidence_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "verification_claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_evidence_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "aether_research_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          error: string | null
          id: string
          idempotency_key: string | null
          metrics: Json
          owner_id: string
          project_id: string | null
          research_session_id: string | null
          run_id: string | null
          status: string
          summary: string | null
          task_id: string | null
          updated_at: string
          verifier_version: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          idempotency_key?: string | null
          metrics?: Json
          owner_id: string
          project_id?: string | null
          research_session_id?: string | null
          run_id?: string | null
          status?: string
          summary?: string | null
          task_id?: string | null
          updated_at?: string
          verifier_version?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          idempotency_key?: string | null
          metrics?: Json
          owner_id?: string
          project_id?: string | null
          research_session_id?: string | null
          run_id?: string | null
          status?: string
          summary?: string | null
          task_id?: string | null
          updated_at?: string
          verifier_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_runs_research_session_id_fkey"
            columns: ["research_session_id"]
            isOneToOne: false
            referencedRelation: "aether_research_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_runs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "task_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_runs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      aax_platform_knowledge_search: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          body: string
          confidence: number
          current_version: number
          id: string
          rank: number
          sources: Json
          title: string
        }[]
      }
      activate_due_aax_releases: { Args: never; Returns: number }
      aether_api_authenticate: {
        Args: { p_key_hash: string }
        Returns: {
          api_key_id: string
          api_kind: string
          application_name: string
          environment: string
          max_input_tokens: number
          max_output_tokens: number
          max_tokens_per_request: number
          model_generation: number
          model_id: string
          model_key: string
          model_revision: number
          monthly_token_limit: number
          owner_id: string
          project_id: string
          rate_limit_per_minute: number
          scopes: string[]
          status: string
          unlimited_tokens: boolean
        }[]
      }
      aether_api_controls_enabled: { Args: never; Returns: boolean }
      aether_api_idempotency_claim: {
        Args: {
          p_api_key_id: string
          p_idempotency_key: string
          p_owner_id: string
          p_request_hash: string
        }
        Returns: {
          claimed: boolean
          expires_at: string
          request_hash: string
          response_body: Json
          status_code: number
        }[]
      }
      aether_api_idempotency_complete: {
        Args: {
          p_api_key_id: string
          p_idempotency_key: string
          p_request_record_id: string
          p_response_body: Json
          p_success: boolean
        }
        Returns: undefined
      }
      aether_api_monthly_usage: {
        Args: { p_api_key_id: string }
        Returns: {
          period_start: string
          request_count: number
          token_limit: number
          tokens_consumed: number
          tokens_remaining: number
          tokens_reserved: number
        }[]
      }
      aether_api_quota_finalize: {
        Args: {
          p_actual_tokens: number
          p_reservation_id: string
          p_success: boolean
        }
        Returns: {
          consumed_tokens: number
          period_start: string
          released_tokens: number
        }[]
      }
      aether_api_quota_reserve: {
        Args: {
          p_api_key_id: string
          p_request_record_id: string
          p_requested_tokens: number
        }
        Returns: {
          allowed: boolean
          period_start: string
          reason: string
          reservation_id: string
          token_limit: number
          tokens_consumed: number
          tokens_reserved: number
        }[]
      }
      aether_api_rate_allowed:
        | { Args: { p_api_key_id: string; p_limit: number }; Returns: boolean }
        | {
            Args: {
              p_api_key_id: string
              p_limit: number
              p_window_seconds: number
            }
            Returns: boolean
          }
      aether_api_z2_authenticate: {
        Args: { p_key_hash: string }
        Returns: {
          api_key_id: string
          api_kind: string
          application_name: string
          environment: string
          max_input_tokens: number
          max_output_tokens: number
          max_tokens_per_request: number
          model_generation: number
          model_id: string
          model_key: string
          model_revision: number
          monthly_token_limit: number
          owner_id: string
          project_id: string
          rate_limit_per_minute: number
          scopes: string[]
          status: string
          unlimited_tokens: boolean
        }[]
      }
      aether_research_is_stale: {
        Args: {
          max_age_days?: number
          published_at: string
          retrieved_at: string
        }
        Returns: boolean
      }
      agent_activate_operational: {
        Args: { p_actor_id: string; p_agent_id: string; p_reason?: string }
        Returns: {
          activated_at: string | null
          activated_by: string | null
          agent_id: string
          config_hash: string
          created_at: string
          created_by: string | null
          definition: Json
          id: string
          lifecycle_state: string
          parent_version_id: string | null
          retired_at: string | null
          rollback_reason: string | null
          tested_at: string | null
          tested_by: string | null
          validated_at: string | null
          validated_by: string | null
          version: string
        }
        SetofOptions: {
          from: "*"
          to: "agent_versions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      agent_lifecycle_transition: {
        Args: {
          p_actor_id: string
          p_reason?: string
          p_target_state: string
          p_version_id: string
        }
        Returns: {
          activated_at: string | null
          activated_by: string | null
          agent_id: string
          config_hash: string
          created_at: string
          created_by: string | null
          definition: Json
          id: string
          lifecycle_state: string
          parent_version_id: string | null
          retired_at: string | null
          rollback_reason: string | null
          tested_at: string | null
          tested_by: string | null
          validated_at: string | null
          validated_by: string | null
          version: string
        }
        SetofOptions: {
          from: "*"
          to: "agent_versions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      agent_permission_check: {
        Args: { p_agent_key: string; p_permission: string }
        Returns: {
          allowed: boolean
          reason: string
          requires_approval: boolean
        }[]
      }
      agent_rollback_to_version: {
        Args: {
          p_actor_id: string
          p_agent_id: string
          p_reason?: string
          p_target_version_id: string
        }
        Returns: {
          activated_at: string | null
          activated_by: string | null
          agent_id: string
          config_hash: string
          created_at: string
          created_by: string | null
          definition: Json
          id: string
          lifecycle_state: string
          parent_version_id: string | null
          retired_at: string | null
          rollback_reason: string | null
          tested_at: string | null
          tested_by: string | null
          validated_at: string | null
          validated_by: string | null
          version: string
        }
        SetofOptions: {
          from: "*"
          to: "agent_versions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      agent_set_operational_state: {
        Args: {
          p_actor_id: string
          p_agent_id: string
          p_reason?: string
          p_target_state: string
        }
        Returns: {
          activated_at: string | null
          activated_by: string | null
          agent_id: string
          config_hash: string
          created_at: string
          created_by: string | null
          definition: Json
          id: string
          lifecycle_state: string
          parent_version_id: string | null
          retired_at: string | null
          rollback_reason: string | null
          tested_at: string | null
          tested_by: string | null
          validated_at: string | null
          validated_by: string | null
          version: string
        }
        SetofOptions: {
          from: "*"
          to: "agent_versions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      append_agent_message: {
        Args: {
          p_correlation_id?: string
          p_from_agent: string
          p_message_type: string
          p_payload?: Json
          p_run_id: string
          p_task_id: string
          p_to_agent: string
        }
        Returns: {
          correlation_id: string | null
          created_at: string
          from_agent: string
          id: string
          message_type: string
          payload: Json
          run_id: string | null
          sequence: number
          task_id: string | null
          to_agent: string
        }
        SetofOptions: {
          from: "*"
          to: "agent_messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      append_orchestration_event: {
        Args: {
          p_action?: string
          p_actor_id?: string
          p_actor_type: string
          p_data?: Json
          p_decision?: string
          p_event_type: string
          p_plan_id: string
          p_reason?: string
          p_run_id?: string
          p_step_id?: string
          p_task_id?: string
        }
        Returns: {
          action: string | null
          actor_id: string | null
          actor_type: string
          created_at: string
          data: Json
          decision: string | null
          event_type: string
          id: string
          plan_id: string
          reason: string | null
          run_id: string | null
          sequence: number
          step_id: string | null
          task_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "orchestration_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      append_task_event: {
        Args: {
          p_actor_id?: string
          p_data?: Json
          p_event_type: string
          p_from_status?: Database["public"]["Enums"]["task_status"]
          p_message?: string
          p_run_id: string
          p_task_id: string
          p_to_status?: Database["public"]["Enums"]["task_status"]
          p_worker_id?: string
        }
        Returns: {
          actor_id: string | null
          created_at: string
          data: Json
          event_type: string
          from_status: Database["public"]["Enums"]["task_status"] | null
          id: string
          message: string | null
          run_id: string | null
          sequence: number
          task_id: string
          to_status: Database["public"]["Enums"]["task_status"] | null
          worker_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "task_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      apply_phase_y_retention: { Args: { p_limit?: number }; Returns: number }
      claim_due_schedules: {
        Args: { p_lease_seconds?: number; p_limit?: number }
        Returns: {
          attempt_count: number
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          idempotency_key: string
          lease_expires_at: string | null
          lease_token: string | null
          max_attempts: number
          owner_id: string
          payload: Json
          result: Json | null
          schedule_id: string
          scheduled_for: string
          started_at: string | null
          status: string
          task_id: string | null
          task_run_id: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "scheduled_runs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_module_runs: {
        Args: { p_limit?: number; p_worker_id: string }
        Returns: {
          attempt: number
          completed_at: string | null
          created_at: string
          error_message: string | null
          heartbeat_at: string | null
          id: string
          idempotency_key: string | null
          inputs: Json
          lease_expires_at: string | null
          max_attempts: number
          module_id: string
          module_version_id: string
          next_attempt_at: string | null
          outputs: Json
          owner_id: string
          run_id: string | null
          started_at: string | null
          status: string
          task_id: string | null
          updated_at: string
          worker_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "module_runs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_next_runtime_run: {
        Args: { p_lease_seconds?: number; p_worker_id: string }
        Returns: {
          attempt: number
          deadline_at: string
          inputs: Json
          owner_id: string
          project_id: string
          run_id: string
          run_status: Database["public"]["Enums"]["task_status"]
          task_detail: Json
          task_id: string
          task_kind: string
          task_status: Database["public"]["Enums"]["task_status"]
          timeout_ms: number
        }[]
      }
      claim_phase_n_step: {
        Args: { p_actor_id: string; p_runtime_step_id: string }
        Returns: {
          agent_key: string
          completed_at: string | null
          critical: boolean
          depends_on_keys: Json
          errors: Json
          id: string
          lease_expires_at: string | null
          max_retries: number
          orchestration_step_id: string
          plan_id: string
          requires_approval: boolean
          requires_verification: boolean
          result: Json
          retry_count: number
          run_id: string | null
          sequence: number
          started_at: string | null
          status: string
          step_key: string
          timeout_ms: number
          updated_at: string
          warnings: Json
          worker_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "orchestration_step_runtime"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_queued_scheduled_runs: {
        Args: { p_lease_seconds?: number; p_limit?: number }
        Returns: {
          attempt_count: number
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          idempotency_key: string
          lease_expires_at: string | null
          lease_token: string | null
          max_attempts: number
          owner_id: string
          payload: Json
          result: Json | null
          schedule_id: string
          scheduled_for: string
          started_at: string | null
          status: string
          task_id: string | null
          task_run_id: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "scheduled_runs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      complete_module_run: {
        Args: {
          p_error?: string
          p_outputs?: Json
          p_run_id: string
          p_status: string
        }
        Returns: {
          attempt: number
          completed_at: string | null
          created_at: string
          error_message: string | null
          heartbeat_at: string | null
          id: string
          idempotency_key: string | null
          inputs: Json
          lease_expires_at: string | null
          max_attempts: number
          module_id: string
          module_version_id: string
          next_attempt_at: string | null
          outputs: Json
          owner_id: string
          run_id: string | null
          started_at: string | null
          status: string
          task_id: string | null
          updated_at: string
          worker_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "module_runs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_phase_n_step: {
        Args: {
          p_actor_id: string
          p_errors: Json
          p_result: Json
          p_runtime_step_id: string
          p_status: string
          p_warnings: Json
        }
        Returns: Json
      }
      consume_aether_research_rate_limit: {
        Args: {
          p_domain: string
          p_max_requests?: number
          p_owner_id: string
          p_window_seconds?: number
        }
        Returns: boolean
      }
      create_phase_n_orchestration_plan: {
        Args: {
          p_context: Json
          p_idempotency_key: string
          p_objective: string
          p_owner_id: string
          p_steps: Json
          p_task_id: string
        }
        Returns: Json
      }
      create_security_incident: {
        Args: {
          p_actor_id?: string
          p_agent_key?: string
          p_description?: string
          p_incident_key: string
          p_incident_type: string
          p_metadata?: Json
          p_severity: string
          p_source_event_id?: string
          p_title: string
        }
        Returns: {
          actor_id: string | null
          agent_key: string | null
          assigned_to: string | null
          contained_at: string | null
          containment: Json
          created_at: string
          description: string
          id: string
          incident_key: string
          incident_type: string
          metadata: Json
          opened_at: string
          resolution: string | null
          resolved_at: string | null
          severity: string
          source_event_id: string | null
          status: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "security_incidents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cron_field_matches:
        | { Args: { field: string; value: number }; Returns: boolean }
        | {
            Args: {
              p_field: string
              p_max: number
              p_min: number
              p_value: number
            }
            Returns: boolean
          }
      export_user_data: { Args: { p_user_id?: string }; Returns: Json }
      freeze_safety_bin_item: {
        Args: { p_frozen: boolean; p_item_id: string }
        Returns: boolean
      }
      get_available_aax_model: {
        Args: { p_model_key: string }
        Returns: {
          available_at: string
          capabilities: string[]
          config: Json
          context_window: number
          display_name: string
          generation: number
          id: string
          model_key: string
          output_limit: number
          provider: string
          provider_model: string
          release_status: string
          revision: number
          specializations: string[]
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      module_lifecycle_transition: {
        Args: {
          p_actor_id: string
          p_reason?: string
          p_target_state: string
          p_version_id: string
        }
        Returns: {
          activated_at: string | null
          activated_by: string | null
          config: Json
          config_hash: string
          created_at: string
          created_by: string | null
          id: string
          lifecycle_state: string
          manifest: Json
          module_id: string
          parent_version_id: string | null
          reason: string | null
          retired_at: string | null
          tested_at: string | null
          tested_by: string | null
          validated_at: string | null
          validated_by: string | null
          version: string
        }
        SetofOptions: {
          from: "*"
          to: "module_versions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      next_cron_run: {
        Args: { p_after: string; p_expr: string; p_timezone?: string }
        Returns: string
      }
      process_user_deletion_request: {
        Args: { p_request_id: string }
        Returns: Json
      }
      promote_aether_memory_candidate: {
        Args: { p_actor_id: string; p_candidate_id: string }
        Returns: string
      }
      purge_safety_bin_item: {
        Args: { p_item_id: string; p_reason?: string }
        Returns: boolean
      }
      record_ai_stat_change: {
        Args: {
          p_delta: number
          p_entity_id: string
          p_entity_type: string
          p_evaluation_id?: string
          p_evidence?: Json
          p_knowledge_event_id?: string
          p_metric_key: string
          p_reason: string
          p_run_id?: string
          p_task_id?: string
        }
        Returns: {
          created_at: string
          delta: number
          entity_id: string
          entity_type: string
          evaluation_id: string | null
          evidence: Json
          id: string
          knowledge_event_id: string | null
          metric_key: string
          new_value: number
          previous_value: number
          reason: string
          run_id: string | null
          task_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "ai_stat_register"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      recover_expired_module_runs: {
        Args: { p_limit?: number }
        Returns: number
      }
      recover_expired_scheduled_runs: {
        Args: { p_limit?: number }
        Returns: number
      }
      recover_phase_n_steps: { Args: never; Returns: number }
      replace_aether_memory: {
        Args: {
          p_actor_id: string
          p_confidence?: number
          p_content: string
          p_importance?: number
          p_memory_id: string
          p_memory_type?: string
          p_reason?: string
        }
        Returns: string
      }
      request_phase_n_gate: {
        Args: {
          p_actor_id: string
          p_gate_type: string
          p_reason: string
          p_runtime_step_id: string
        }
        Returns: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          gate_type: string
          id: string
          plan_id: string
          reason: string | null
          requested_by: string | null
          runtime_step_id: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "orchestration_gates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      requeue_expired_runtime_work: {
        Args: { p_limit?: number }
        Returns: number
      }
      restore_safety_bin_item: { Args: { p_item_id: string }; Returns: Json }
      retrieve_aether_memories: {
        Args: {
          p_limit?: number
          p_min_rank?: number
          p_project_id?: string
          p_query: string
        }
        Returns: {
          confidence: number
          content: string
          id: string
          importance: number
          memory_type: string
          project_id: string
          rank: number
          reason: string
          scope: string
          source_conversation_id: string
          source_message_id: string
          version: number
        }[]
      }
      safety_bin_actor_email: { Args: { p_actor: string }; Returns: string }
      security_authorize_action: {
        Args: {
          p_action: string
          p_actor_id: string
          p_agent_key: string
          p_context?: Json
          p_idempotency_key: string
          p_resource_id?: string
          p_resource_type?: string
          p_run_id?: string
          p_task_id?: string
        }
        Returns: Json
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      verify_safety_bin_integrity: {
        Args: { p_item_id: string }
        Returns: boolean
      }
    }
    Enums: {
      agent_status: "enabled" | "disabled" | "maintenance"
      api_key_status: "active" | "revoked" | "expired"
      app_role: "user" | "admin"
      knowledge_stage: "sandbox" | "verified" | "approved" | "production"
      task_status:
        | "running"
        | "completed"
        | "failed"
        | "cancelled"
        | "waiting_approval"
        | "queued"
        | "paused"
        | "retrying"
        | "scheduled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      agent_status: ["enabled", "disabled", "maintenance"],
      api_key_status: ["active", "revoked", "expired"],
      app_role: ["user", "admin"],
      knowledge_stage: ["sandbox", "verified", "approved", "production"],
      task_status: [
        "running",
        "completed",
        "failed",
        "cancelled",
        "waiting_approval",
        "queued",
        "paused",
        "retrying",
        "scheduled",
      ],
    },
  },
} as const
