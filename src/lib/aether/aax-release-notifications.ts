import type { SupabaseClient } from "@supabase/supabase-js";

export async function announceAaxRelease(admin: SupabaseClient, modelId: string, title: string, body: string) {
  const { data: users, error: usersError } = await admin.from("profiles").select("id");
  if (usersError) throw new Error(usersError.message);
  if (!users?.length) return { created: 0 };

  const rows = users.map((user) => ({
    recipient_id: user.id,
    audience: "user",
    event_type: "aax.release",
    title,
    body,
    resource_type: "aax_model",
    resource_id: modelId,
    link: "/models",
    status: "pending",
  }));
  const { error } = await admin.from("notifications").insert(rows);
  if (error) throw new Error(error.message);
  return { created: rows.length };
}
