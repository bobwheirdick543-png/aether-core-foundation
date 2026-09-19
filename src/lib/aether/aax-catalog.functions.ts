import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const listPublicAaxModels = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin.from("aax_models")
    .select("model_key,display_name,generation,revision,description,capabilities,specializations,context_window,output_limit,release_status,scheduled_release_at,available_at,disabled_at,specialization_profile,improvements")
    .eq("release_status", "available")
    .is("disabled_at", null)
    .or(`available_at.is.null,available_at.lte.${new Date().toISOString()}`)
    .order("generation", { ascending: false })
    .order("revision", { ascending: false });
  if (error) throw new Error(`Could not load AAX catalogue: ${error.message}`);
  return data ?? [];
});
