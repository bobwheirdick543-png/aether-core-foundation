import { createFileRoute } from "@tanstack/react-router";
import { runNextRuntimeWork } from "@/lib/aether/runtime-worker";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/cron/aether-worker")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const expected = process.env.CRON_SECRET?.trim();
        const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
        if (!expected || supplied !== expected) return new Response("Unauthorized", { status: 401 });
        const workerId = "vercel-cron-" + crypto.randomUUID();
        try {
          const result = await runNextRuntimeWork(supabaseAdmin, { workerId, leaseSeconds: 55, recoveryLimit: 100 });
          return Response.json({ ok: true, workerId, ...result }, { headers: { "Cache-Control": "no-store" } });
        } catch (error) {
          return Response.json({ ok: false, workerId, error: error instanceof Error ? error.message : "Runtime worker failed" }, { status: 500, headers: { "Cache-Control": "no-store" } });
        }
      },
    },
  },
});
