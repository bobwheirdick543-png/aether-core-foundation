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
      admin_bootstrap: {
        Row: {
          completed_at: string
          completed_by: string | null
          completed_email: string | null
          id: boolean
        }
        Insert: {
          completed_at?: string
          completed_by?: string | null
          completed_email?: string | null
          id?: boolean
        }
        Update: {
          completed_at?: string
          completed_by?: string | null
          completed_email?: string | null
          id?: boolean
        }
        Relationships: []
      }
      admin_bootstrap_attempts: {
        Row: {
          attempted_at: string
          fingerprint: string
          id: string
          succeeded: boolean
        }
        Insert: {
          attempted_at?: string
          fingerprint: string
          id?: string
          succeeded?: boolean
        }
        Update: {
          attempted_at?: string
          fingerprint?: string
          id?: string
          succeeded?: boolean
        }
        Relationships: []
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
      model_configs: {
        Row: {
          capabilities: string[]
          context_window: number
          created_at: string
          description: string
          display_name: string
          id: string
          provider: string | null
          provider_model: string | null
          role_key: string
          sort_order: number
          speed: string
          status: string
          updated_at: string
        }
        Insert: {
          capabilities?: string[]
          context_window?: number
          created_at?: string
          description: string
          display_name: string
          id?: string
          provider?: string | null
          provider_model?: string | null
          role_key: string
          sort_order?: number
          speed?: string
          status?: string
          updated_at?: string
        }
        Update: {
          capabilities?: string[]
          context_window?: number
          created_at?: string
          description?: string
          display_name?: string
          id?: string
          provider?: string | null
          provider_model?: string | null
          role_key?: string
          sort_order?: number
          speed?: string
          status?: string
          updated_at?: string
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
          link: string | null
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
          link?: string | null
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
          link?: string | null
          read_at?: string | null
          recipient_id?: string
          resource_id?: string | null
          resource_type?: string | null
          status?: string
          title?: string
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
      reports: {
        Row: {
          approval_status: string
          created_at: string
          file_path: string | null
          id: string
          owner_id: string
          project_id: string | null
          run_id: string | null
          source_count: number
          title: string
          topic: string | null
          updated_at: string
          verification_status: string
        }
        Insert: {
          approval_status?: string
          created_at?: string
          file_path?: string | null
          id?: string
          owner_id: string
          project_id?: string | null
          run_id?: string | null
          source_count?: number
          title: string
          topic?: string | null
          updated_at?: string
          verification_status?: string
        }
        Update: {
          approval_status?: string
          created_at?: string
          file_path?: string | null
          id?: string
          owner_id?: string
          project_id?: string | null
          run_id?: string | null
          source_count?: number
          title?: string
          topic?: string | null
          updated_at?: string
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
      task_runs: {
        Row: {
          agent_id: string | null
          attempt: number
          created_at: string
          ended_at: string | null
          error: string | null
          id: string
          idempotency_key: string | null
          inputs: Json
          outputs: Json
          owner_id: string
          retry_of: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["task_status"]
          task_id: string
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          attempt?: number
          created_at?: string
          ended_at?: string | null
          error?: string | null
          id?: string
          idempotency_key?: string | null
          inputs?: Json
          outputs?: Json
          owner_id: string
          retry_of?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          task_id: string
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          attempt?: number
          created_at?: string
          ended_at?: string | null
          error?: string | null
          id?: string
          idempotency_key?: string | null
          inputs?: Json
          outputs?: Json
          owner_id?: string
          retry_of?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          task_id?: string
          updated_at?: string
        }
        Relationships: [
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
          completed_at: string | null
          created_at: string
          detail: Json
          id: string
          kind: string
          progress: number
          project_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          detail?: Json
          id?: string
          kind?: string
          progress?: number
          project_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          detail?: Json
          id?: string
          kind?: string
          progress?: number
          project_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
          user_id?: string
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
          api_key_id: string | null
          created_at: string
          id: string
          kind: string
          latency_ms: number | null
          model_role: string | null
          tokens_in: number
          tokens_out: number
          user_id: string | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          id?: string
          kind: string
          latency_ms?: number | null
          model_role?: string | null
          tokens_in?: number
          tokens_out?: number
          user_id?: string | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          latency_ms?: number | null
          model_role?: string | null
          tokens_in?: number
          tokens_out?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
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
      ],
    },
  },
} as const
