/**
 * AETHER TASK SERVER FUNCTIONS
 * Authenticated entry points for the universal Task/Run runtime.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createTask, createRun, getTaskWithRuns, getTaskEvents } from "./task-service";
import { planWorkflow } from "./orchestrator";
import { resolveTimeoutMs, type TimeoutPreset } from "./task-runtime";

export const createUserTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    title: string; kind: string; projectId?: string; detail?: Record<string, unknown>;
    timeout?: number | TimeoutPreset; maxRetries?: number; priority?: number; idempotencyKey?: string;
  }) => {
    const title = String(data?.title ?? "").trim();
    const kind = String(data?.kind ?? "general").trim();
    if (!title) throw new Error("Title is required");
    if (title.length > 200) throw new Error("Title too long");
    const timeoutMs = resolveTimeoutMs(data?.timeout);
    return {
      title, kind: kind.slice(0, 64), projectId: data?.projectId ?? null,
      detail: data?.detail ?? {}, timeoutMs,
      maxRetries: Math.max(0, Math.min(20, Math.floor(data?.maxRetries ?? 3))),
      priority: Math.max(-100, Math.min(100, Math.floor(data?.priority ?? 0))),
      idempotencyKey: data?.idempotencyKey?.trim().slice(0, 255) || undefined,
    };
  })
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const task = await createTask(supabaseAdmin, {
      owner_id: context.userId, project_id: data.projectId, title: data.title, kind: data.kind,
      detail: data.detail, status: "queued", timeout_ms: data.timeoutMs,
      max_retries: data.maxRetries, priority: data.priority, idempotency_key: data.idempotencyKey,
    });
    const run = await createRun(supabaseAdmin, {
      task_id: task.id, owner_id: context.userId, inputs: { title: data.title, kind: data.kind, ...data.detail },
      attempt: 1, timeout_ms: data.timeoutMs, max_retries: data.maxRetries,
    });
    const plan = planWorkflow(data.kind, task.id);
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId, action: "task.created", target_type: "tasks", target_id: task.id,
      metadata: { kind: data.kind, run_id: run.id, plan_steps: plan.steps.length, timeout_ms: data.timeoutMs },
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
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    return getTaskWithRuns(supabaseAdmin, data.taskId, context.userId, Boolean(isAdmin));
  });

export const getMyTaskEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { taskId: string }) => {
    if (!data?.taskId) throw new Error("taskId required");
    return { taskId: String(data.taskId) };
  })
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    return getTaskEvents(supabaseAdmin, data.taskId, context.userId, Boolean(isAdmin));
  });

export const listMyTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("tasks")
      .select("id, title, kind, status, progress, priority, timeout_ms, deadline_at, retry_count, max_retries, created_at, updated_at, completed_at")
      .eq("user_id", context.userId).order("created_at", { ascending: false }).limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
