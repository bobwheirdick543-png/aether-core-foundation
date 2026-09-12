import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { authorizeSecurityBoundary } from "./security-boundary";
import { buildSafetyBinPdf, buildSafetyBinReportFileName, normalizeSafetyBinQuery, type SafetyBinItem } from "./safety-bin";

const ADMIN_CAPABILITY = "safety_bin.admin";

async function isAdmin(sb: Awaited<ReturnType<typeof requireSupabaseAuth>> extends never ? never : any, userId: string): Promise<boolean> {
  const { data } = await sb.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  return Boolean(data);
}

export const listSafetyBinItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { email?: string; sourceTable?: string; objectType?: string; limit?: number }) => ({
    email: normalizeSafetyBinQuery(data?.email, 320),
    sourceTable: normalizeSafetyBinQuery(data?.sourceTable, 100),
    objectType: normalizeSafetyBinQuery(data?.objectType, 100),
    limit: Math.min(Math.max(Number(data?.limit ?? 100), 1), 250),
  }))
  .handler(async ({ context, data }) => {
    let query = context.supabase
      .from("safety_bin_items")
      .select("id,source_schema,source_table,source_object_id,source_owner_id,source_project_id,object_type,object_name,original_location,original_created_at,original_updated_at,deleted_by_id,deleted_by_email,deleted_at,deletion_reason,deletion_method,content,content_hash,version,recovery_status,permanent_deletion_status,related_task_id,related_run_id,correlation_id")
      .order("deleted_at", { ascending: false })
      .limit(data.limit);
    if (data.email) query = query.ilike("deleted_by_email", data.email.includes("%") ? data.email : `%${data.email}%`);
    if (data.sourceTable) query = query.eq("source_table", data.sourceTable);
    if (data.objectType) query = query.eq("object_type", data.objectType);
    const { data: items, error } = await query;
    if (error) return { ok: false as const, message: "Could not read Safety Bin records.", items: [] as SafetyBinItem[] };
    return { ok: true as const, items: (items ?? []) as SafetyBinItem[] };
  });

export const getSafetyBinSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { count } = await context.supabase.from("safety_bin_items").select("id", { count: "exact", head: true });
    const { count: frozen } = await context.supabase.from("safety_bin_items").select("id", { count: "exact", head: true }).eq("recovery_status", "frozen");
    const { count: restored } = await context.supabase.from("safety_bin_items").select("id", { count: "exact", head: true }).eq("recovery_status", "restored");
    return { total: count ?? 0, frozen: frozen ?? 0, restored: restored ?? 0 };
  });

export const restoreSafetyBinItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => ({ id: String(data?.id ?? "") }))
  .handler(async ({ context, data }) => {
    if (!data.id) return { ok: false as const, message: "Safety Bin item id is required." };
    const { data: item } = await context.supabase.from("safety_bin_items").select("source_owner_id,deleted_by_id,source_project_id").eq("id", data.id).maybeSingle();
    if (!item) return { ok: false as const, message: "Safety Bin item not found." };
    const admin = await isAdmin(context.supabase, context.userId);
    await authorizeSecurityBoundary({
      actor: { userId: context.userId, roles: admin ? ["admin"] : ["user"], source: "session" },
      action: "safety_bin.restore",
      resourceType: "platform",
      resourceId: data.id,
      ownerId: admin ? undefined : (item.source_owner_id ?? item.deleted_by_id),
      projectOwnerId: admin ? undefined : undefined,
      requiredCapability: admin ? null : "safety_bin.restore",
    });
    const { data: result, error } = await context.supabase.rpc("restore_safety_bin_item", { p_item_id: data.id });
    if (error) return { ok: false as const, message: error.message };
    return result as { ok: boolean; message?: string; restored_id?: string };
  });

export const freezeSafetyBinItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; frozen: boolean }) => ({ id: String(data?.id ?? ""), frozen: Boolean(data?.frozen) }))
  .handler(async ({ context, data }) => {
    const admin = await isAdmin(context.supabase, context.userId);
    await authorizeSecurityBoundary({ actor: { userId: context.userId, roles: admin ? ["admin"] : ["user"], source: "session" }, action: "admin.safety_bin.freeze", resourceType: "platform", resourceId: data.id, requiredCapability: ADMIN_CAPABILITY });
    const { data: ok, error } = await context.supabase.rpc("freeze_safety_bin_item", { p_item_id: data.id, p_frozen: data.frozen });
    return error ? { ok: false as const, message: error.message } : { ok: Boolean(ok) };
  });

export const purgeSafetyBinItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; reason?: string; confirm?: boolean }) => ({ id: String(data?.id ?? ""), reason: normalizeSafetyBinQuery(data?.reason, 500), confirm: Boolean(data?.confirm) }))
  .handler(async ({ context, data }) => {
    if (!data.confirm) return { ok: false as const, message: "Permanent purge requires explicit confirmation." };
    const admin = await isAdmin(context.supabase, context.userId);
    await authorizeSecurityBoundary({ actor: { userId: context.userId, roles: admin ? ["admin"] : ["user"], source: "session" }, action: "admin.safety_bin.purge", resourceType: "platform", resourceId: data.id, requiredCapability: ADMIN_CAPABILITY });
    const { data: ok, error } = await context.supabase.rpc("purge_safety_bin_item", { p_item_id: data.id, p_reason: data.reason || "Authorized permanent purge" });
    return error ? { ok: false as const, message: error.message } : { ok: Boolean(ok) };
  });

export const listSafetyBinChat = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("safety_bin_chat_messages").select("id,role,content,result_item_ids,created_at").eq("owner_id", context.userId).order("created_at", { ascending: true }).limit(100);
    return data ?? [];
  });

function extractEmail(text: string): string | null {
  const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0] ?? null;
}

export const sendRecyclingAgentMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { message: string }) => ({ message: normalizeSafetyBinQuery(data?.message, 2000) }))
  .handler(async ({ context, data }) => {
    if (!data.message) return { ok: false as const, message: "Message is required." };
    const { error: userError } = await context.supabase.from("safety_bin_chat_messages").insert({ owner_id: context.userId, actor_id: context.userId, role: "user", content: data.message });
    if (userError) return { ok: false as const, message: "Could not save Recycling Agent message." };

    const email = extractEmail(data.message);
    let query = context.supabase.from("safety_bin_items").select("id,object_type,object_name,source_table,deleted_by_email,deleted_at,original_location,recovery_status,content_hash").order("deleted_at", { ascending: false }).limit(100);
    if (email) query = query.ilike("deleted_by_email", email);
    const { data: items, error } = await query;
    if (error) return { ok: false as const, message: "Recycling Agent could not inspect the Safety Bin." };

    let reply: string;
    if (email) {
      reply = items?.length
        ? `I found ${items.length} Safety Bin record(s) deleted by ${email}. I can organize them by date, type, source, or prepare a PDF report.`
        : `I found no Safety Bin records attributed to ${email}.`;
    } else if (/freeze|investigat/i.test(data.message)) {
      reply = "I can preserve evidence by freezing selected Safety Bin records. Select a record and use Freeze from the Safety Bin controls.";
    } else if (/pdf|report|export/i.test(data.message)) {
      reply = "Select the Safety Bin records you want included and use Generate PDF. The report is stored privately and can be downloaded through an authenticated signed URL.";
    } else {
      reply = "I am the Recycling Agent. Ask me who deleted something, for example: 'Give me everything they have deleted for person@example.com'. I can also help with recovery, investigations, integrity checks and PDF evidence reports.";
    }

    const ids = (items ?? []).map((item) => item.id);
    await context.supabase.from("safety_bin_chat_messages").insert({ owner_id: context.userId, actor_id: context.userId, role: "agent", content: reply, result_item_ids: ids });
    return { ok: true as const, reply, itemIds: ids };
  });

export const generateSafetyBinPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { itemIds: string[]; title?: string }) => ({ itemIds: Array.isArray(data?.itemIds) ? data.itemIds.slice(0, 100) : [], title: normalizeSafetyBinQuery(data?.title, 200) || "Safety Bin Evidence Report" }))
  .handler(async ({ context, data }) => {
    if (!data.itemIds.length) return { ok: false as const, message: "Select at least one Safety Bin record." };
    const { data: items, error } = await context.supabase.from("safety_bin_items").select("*").in("id", data.itemIds);
    if (error || !items?.length) return { ok: false as const, message: "No authorized Safety Bin records were found." };
    const reportId = crypto.randomUUID();
    const fileName = buildSafetyBinReportFileName();
    const path = `${context.userId}/${reportId}/${fileName}`;
    const pdf = buildSafetyBinPdf(data.title, items as SafetyBinItem[]);
    const { error: uploadError } = await context.supabase.storage.from("aether-safety-bin-reports").upload(path, pdf, { contentType: "application/pdf", upsert: false });
    if (uploadError) return { ok: false as const, message: "Could not store the Safety Bin PDF." };
    await context.supabase.from("safety_bin_reports").insert({ id: reportId, owner_id: context.userId, generated_by: context.userId, title: data.title, item_count: items.length, storage_path: path, file_name: fileName, status: "completed", provenance: { source: "Aether Safety Bin", record_ids: data.itemIds, generated_at: new Date().toISOString() } });
    const { data: signed, error: signedError } = await context.supabase.storage.from("aether-safety-bin-reports").createSignedUrl(path, 600);
    if (signedError || !signed?.signedUrl) return { ok: false as const, message: "Report was created but a secure download link could not be issued." };
    return { ok: true as const, reportId, fileName, signedUrl: signed.signedUrl };
  });

export const requestMyDataExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("user_lifecycle_requests").insert({ user_id: context.userId, requested_by: context.userId, request_type: "export", status: "requested" }).select("id,status,created_at").single();
    return error ? { ok: false as const, message: error.message } : { ok: true as const, request: data };
  });

export const requestMyDataDeletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { reason?: string }) => ({ reason: normalizeSafetyBinQuery(data?.reason, 500) }))
  .handler(async ({ context, data }) => {
    const { data: request, error } = await context.supabase.from("user_lifecycle_requests").insert({ user_id: context.userId, requested_by: context.userId, request_type: "deletion", status: "requested", reason: data.reason || null }).select("id,status,created_at").single();
    return error ? { ok: false as const, message: error.message } : { ok: true as const, request };
  });
