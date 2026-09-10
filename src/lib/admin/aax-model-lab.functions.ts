import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAaxAdmin, listAaxTrainingJobs, getAaxTrainingJob } from "./aax-model-lab.server";

export const getAaxModelLabJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAaxAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return listAaxTrainingJobs(supabaseAdmin);
  });

export const getAaxModelLabJob = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: { jobId: string }) => input)
  .handler(async ({ context, data }) => {
    if (!data.jobId) throw new Error("jobId is required");
    await assertAaxAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return getAaxTrainingJob(supabaseAdmin, data.jobId);
  });
