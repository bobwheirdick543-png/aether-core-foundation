import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listMyVerificationSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("aether_research_sessions")
      .select("id,project_id,query,status,source_count,created_at,completed_at")
      .eq("owner_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Response(`Could not load research sessions: ${error.message}`, { status: 500 });
    return data ?? [];
  });
