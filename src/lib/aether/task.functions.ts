/**
 * AETHER TASK SERVER FUNCTIONS
 * Authenticated, ownership-checked entry points for the Task/Run engine.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createTask, createRun, getTaskWithRuns } from "./task-service";
import { planWorkflow } from "./orchestrator";

export const createUserTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { title: string; kind: string; projectId?: string; detail?: Record<string, unknown> }) => {
    const title = String(data?.title ?? "").trim();
    const kind = String(data?.kind ?? "general").trim();
    if (!title) throw new Error("Title is required");
    if (title.length > 200) throw new Error("Title too long");
    return {
      title,
      kind: kind.slice(0, 64),
      projectId: data?.projectId ?? null,
      detail: data?.detail ?? {},
    };
  })
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const task = await createTask(supabaseAdmin, {
      owner_id: context.userId,
      project_id: data.projectId,
      title: data.title,
      kind: data.kind,
      detail: data.detail,
      status: "queued",
    });

    // Create the first run
    const run = await createRun(supabaseAdmin, {
      task_id: task.id,
      owner_id: context.userId,
      inputs: { title: data.title, kind: data.kind, ...data.detail },
      attempt: 1,
    });

    // Plan the workflow (pure, no execution yet)
    const plan = planWorkflow(data.kind, task.id);

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "task.created",
      target_type: "tasks",
      target_id: task.id,
      metadata: { kind: data.kind, run_id: run.id, plan_steps: plan.steps.length },
    });

    return { taskId: task.id, runId: run.id, plan };
  });

export const getMyTask = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { taskId: string }) => {
    if (!data?.taskId) throw new Error("taskId required");
    return { taskId: String(data.taskId) };
  })
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Check if caller is admin
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });

    return getTaskWithRuns(supabaseAdmin, data.taskId, context.userId, Boolean(isAdmin));
  });

export const listMyTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("tasks")
      .select("id, title, kind, status, progress, created_at, updated_at, completed_at")
      .eq("owner_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw new Error(error.message);
    return data ?? [];
  });
