import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { SupabaseClient } from "@supabase/supabase-js";

async function requireAdmin(context: { supabase: unknown; userId: string }) {
  const db = context.supabase as SupabaseClient;
  const { data, error } = await db.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error) throw new Response("Unable to verify administrator authorization", { status: 500 });
  if (!data) throw new Response("Forbidden", { status: 403 });
}

export const getLiveTaskActivity = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).inputValidator((d?: { admin?: boolean; limit?: number }) => ({ admin: Boolean(d?.admin), limit: Math.min(20, Math.max(1, Math.floor(d?.limit ?? 8))) })).handler(async ({ context, data }) => {
  if (data.admin) await requireAdmin(context);
  let taskQuery = supabaseAdmin.from("tasks").select("id,user_id,title,kind,status,progress,priority,started_at,completed_at,deadline_at,worker_id,updated_at,detail").in("status", ["queued","running","paused","waiting_approval"]).order("priority", { ascending: false }).order("updated_at", { ascending: false }).limit(data.limit);
  if (!data.admin) taskQuery = taskQuery.eq("user_id", context.userId);
  const { data: tasks, error: taskError } = await taskQuery;
  if (taskError) throw new Response(`Could not load live tasks: ${taskError.message}`, { status: 500 });
  const ids = (tasks ?? []).map((task) => task.id);
  if (!ids.length) return [];
  const { data: events, error: eventError } = await supabaseAdmin.from("task_events").select("id,task_id,run_id,sequence,event_type,from_status,to_status,message,data,worker_id,created_at").in("task_id", ids).order("sequence", { ascending: true }).limit(data.limit * 80);
  if (eventError) throw new Response(`Could not load live task events: ${eventError.message}`, { status: 500 });
  return (tasks ?? []).map((task) => ({ task, events: (events ?? []).filter((event) => event.task_id === task.id) }));
});
