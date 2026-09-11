/** Phase L background worker contract. Every tick uses durable Supabase state and hands work to the Phase A runtime. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface SchedulerTickOptions { limit?: number; leaseSeconds?: number; }
export interface SchedulerTickResult { recovered: number; fired: number; dispatched: number; }
const bounded = (value: number | undefined, fallback: number, min: number, max: number) => Math.min(max, Math.max(min, Math.floor(Number(value ?? fallback))));

export async function runSchedulerWorkerTick(options: SchedulerTickOptions = {}): Promise<SchedulerTickResult> {
  const limit = bounded(options.limit, 10, 1, 50);
  const leaseSeconds = bounded(options.leaseSeconds, 120, 30, 900);
  const { data: recovered, error: recoveryError } = await supabaseAdmin.rpc("recover_expired_scheduled_runs", { p_limit: limit * 2 });
  if (recoveryError) throw recoveryError;
  const { data: fired, error: fireError } = await supabaseAdmin.rpc("claim_due_schedules", { p_limit: limit, p_lease_seconds: leaseSeconds });
  if (fireError) throw fireError;
  const { data: dispatched, error: dispatchError } = await supabaseAdmin.rpc("claim_queued_scheduled_runs", { p_limit: limit, p_lease_seconds: leaseSeconds });
  if (dispatchError) throw dispatchError;
  return { recovered: Number(recovered || 0), fired: fired?.length || 0, dispatched: dispatched?.length || 0 };
}
