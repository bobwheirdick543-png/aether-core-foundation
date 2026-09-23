/** Aether durable runtime worker entrypoint. Supabase is the queue/source of truth. */
import { supabaseAdmin } from "../integrations/supabase/client.server";
import { runNextRuntimeWork } from "../lib/aether/runtime-worker";

const workerId = process.env.AETHER_WORKER_ID?.trim() || `aether-worker-${process.pid}`;
const leaseSeconds = Math.max(10, Number(process.env.AETHER_WORKER_LEASE_SECONDS ?? 60));
const pollMs = Math.max(250, Number(process.env.AETHER_WORKER_POLL_MS ?? 1000));

let stopping = false;
process.on("SIGTERM", () => { stopping = true; });
process.on("SIGINT", () => { stopping = true; });

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  while (!stopping) {
    try {
      const result = await runNextRuntimeWork(supabaseAdmin, {
        workerId,
        leaseSeconds,
        recoveryLimit: 100,
      });
      if (!result.claimed) await sleep(pollMs);
    } catch (error) {
      console.error(`[Aether worker ${workerId}] iteration failed:`, error instanceof Error ? error.message : error);
      await sleep(Math.max(pollMs, 2000));
    }
  }
}

if (process.argv.includes("--check")) {
  console.log("Aether runtime worker entrypoint OK");
} else {
  await run();
}
