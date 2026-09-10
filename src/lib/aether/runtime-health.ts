import type { SupabaseClient } from "@supabase/supabase-js";

export interface RuntimeHealth {
  status: "healthy" | "degraded";
  checkedAt: string;
  queued: number;
  running: number;
  retrying: number;
  expiredLeases: number;
  workers: { total: number; active: number; stale: number };
}

export async function getRuntimeHealth(admin: SupabaseClient): Promise<RuntimeHealth> {
  const now = Date.now();
  const staleBefore = new Date(now - 90_000).toISOString();
  const [{ count: queued }, { count: running }, { count: retrying }, { count: expiredLeases }, { count: workers }, { count: activeWorkers }, { count: staleWorkers }] = await Promise.all([
    admin.from("tasks").select("id", { count: "exact", head: true }).in("status", ["queued", "scheduled"]),
    admin.from("task_runs").select("id", { count: "exact", head: true }).eq("status", "running"),
    admin.from("task_runs").select("id", { count: "exact", head: true }).eq("status", "retrying"),
    admin.from("task_runs").select("id", { count: "exact", head: true }).eq("status", "running").lt("lease_expires_at", new Date(now).toISOString()),
    admin.from("runtime_workers").select("worker_id", { count: "exact", head: true }),
    admin.from("runtime_workers").select("worker_id", { count: "exact", head: true }).eq("status", "running"),
    admin.from("runtime_workers").select("worker_id", { count: "exact", head: true }).neq("status", "offline").lt("last_heartbeat_at", staleBefore),
  ]);
  return {
    status: (expiredLeases ?? 0) > 0 || (staleWorkers ?? 0) > 0 ? "degraded" : "healthy",
    checkedAt: new Date(now).toISOString(), queued: queued ?? 0, running: running ?? 0, retrying: retrying ?? 0, expiredLeases: expiredLeases ?? 0,
    workers: { total: workers ?? 0, active: activeWorkers ?? 0, stale: staleWorkers ?? 0 },
  };
}
