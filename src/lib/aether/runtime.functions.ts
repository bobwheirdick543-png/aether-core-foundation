/**
 * AETHER RUNTIME OPERATIONS
 *
 * Administrative/worker entry points for the universal runtime. These functions
 * expose only runtime operations; domain permissions remain enforced by agents.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { recoverExpiredRuntimeWork, runNextRuntimeWork } from "./runtime-worker";

async function requireAdmin(context: any): Promise<void> {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

export const runRuntimeWorkerOnce = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { workerId?: string; leaseSeconds?: number }) => ({
    workerId: data?.workerId?.trim().slice(0, 120) || `admin-worker:${crypto.randomUUID()}`,
    leaseSeconds: Math.max(10, Math.min(300, Math.floor(data?.leaseSeconds ?? 60))),
  }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return runNextRuntimeWork(supabaseAdmin, data);
  });

export const recoverRuntimeWorkerLeases = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { limit?: number }) => ({ limit: Math.max(1, Math.min(500, Math.floor(data?.limit ?? 100))) }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return { recovered: await recoverExpiredRuntimeWork(supabaseAdmin, data.limit) };
  });
