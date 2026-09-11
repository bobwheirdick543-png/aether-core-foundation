import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const db = (value: unknown) => value as SupabaseClient;
const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || "project";
const assertOwnedProject = async (client: SupabaseClient, projectId: string, userId: string, includeArchived = true) => {
  let query = client.from("projects").select("id,name,slug,description,project_type,status,archived,memory_enabled,metadata,created_at,updated_at").eq("id", projectId).eq("owner_id", userId);
  if (!includeArchived) query = query.eq("archived", false);
  const { data, error } = await query.maybeSingle();
  if (error || !data) throw new Response("Project not found or not owned by the current user", { status: 404 });
  return data;
};

export const listAetherProjects = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).validator((input?: { includeArchived?: boolean; search?: string }) => input ?? {}).handler(async ({ context, data }) => {
  let query = db(context.supabase).from("projects").select("id,name,slug,description,project_type,status,archived,memory_enabled,metadata,created_at,updated_at").eq("owner_id", context.userId).order("updated_at", { ascending: false }).limit(200);
  if (!data.includeArchived) query = query.eq("archived", false);
  if (data.search?.trim()) query = query.ilike("name", `%${data.search.trim().replace(/[%_]/g, "\\$&")}%`);
  const { data: rows, error } = await query;
  if (error) throw new Response(`Could not load projects: ${error.message}`, { status: 500 });
  return rows ?? [];
});

export const createAetherProject = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((input: { name: string; description?: string; projectType?: string }) => input).handler(async ({ context, data }) => {
  const name = data.name.trim().slice(0, 120); if (!name) throw new Response("Project name is required", { status: 400 });
  const base = slugify(name); const slug = `${base}-${crypto.randomUUID().slice(0, 8)}`;
  const { data: project, error } = await db(context.supabase).from("projects").insert({ owner_id: context.userId, name, slug, description: data.description?.trim().slice(0, 1000) || null, project_type: data.projectType?.trim().slice(0, 40) || "general", status: "active", archived: false, memory_enabled: true }).select("id,name,slug,description,project_type,status,archived,memory_enabled,metadata,created_at,updated_at").single();
  if (error || !project) throw new Response(`Could not create project: ${error?.message ?? "unknown error"}`, { status: 500 });
  return project;
});

export const updateAetherProject = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((input: { projectId: string; name?: string; description?: string; projectType?: string; memoryEnabled?: boolean }) => input).handler(async ({ context, data }) => {
  await assertOwnedProject(db(context.supabase), data.projectId, context.userId);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.name !== undefined) { const name = data.name.trim().slice(0, 120); if (!name) throw new Response("Project name is required", { status: 400 }); patch.name = name; }
  if (data.description !== undefined) patch.description = data.description.trim().slice(0, 1000) || null;
  if (data.projectType !== undefined) patch.project_type = data.projectType.trim().slice(0, 40) || "general";
  if (data.memoryEnabled !== undefined) patch.memory_enabled = data.memoryEnabled;
  const { error } = await db(context.supabase).from("projects").update(patch).eq("id", data.projectId).eq("owner_id", context.userId);
  if (error) throw new Response(`Could not update project: ${error.message}`, { status: 500 });
  return { ok: true };
});

export const archiveAetherProject = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((input: { projectId: string }) => input).handler(async ({ context, data }) => {
  await assertOwnedProject(db(context.supabase), data.projectId, context.userId, false);
  const { error } = await db(context.supabase).from("projects").update({ archived: true, status: "archived", updated_at: new Date().toISOString() }).eq("id", data.projectId).eq("owner_id", context.userId);
  if (error) throw new Response(`Could not archive project: ${error.message}`, { status: 500 }); return { ok: true };
});

export const restoreAetherProject = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((input: { projectId: string }) => input).handler(async ({ context, data }) => {
  await assertOwnedProject(db(context.supabase), data.projectId, context.userId, true);
  const { error } = await db(context.supabase).from("projects").update({ archived: false, status: "active", updated_at: new Date().toISOString() }).eq("id", data.projectId).eq("owner_id", context.userId);
  if (error) throw new Response(`Could not restore project: ${error.message}`, { status: 500 }); return { ok: true };
});

export const deleteAetherProject = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((input: { projectId: string }) => input).handler(async ({ context, data }) => {
  await assertOwnedProject(db(context.supabase), data.projectId, context.userId, true);
  const { data: files } = await db(context.supabase).from("aether_project_files").select("storage_path").eq("project_id", data.projectId).eq("owner_id", context.userId);
  if (files?.length) await supabaseAdmin.storage.from("aether-project-files").remove(files.map((file) => file.storage_path));
  const { error } = await db(context.supabase).from("projects").delete().eq("id", data.projectId).eq("owner_id", context.userId);
  if (error) throw new Response(`Could not delete project: ${error.message}`, { status: 500 }); return { ok: true };
});

export const getAetherProjectWorkspace = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).validator((input: { projectId: string }) => input).handler(async ({ context, data }) => {
  const project = await assertOwnedProject(db(context.supabase), data.projectId, context.userId);
  const [filesResult, memoriesResult, conversationsResult] = await Promise.all([
    db(context.supabase).from("aether_project_files").select("id,filename,mime_type,size_bytes,extraction_status,metadata,created_at,updated_at").eq("project_id", data.projectId).eq("owner_id", context.userId).order("created_at", { ascending: false }).limit(200),
    db(context.supabase).from("aether_memories").select("id,scope,memory_type,content,status,confidence,importance,version,created_at,updated_at").eq("project_id", data.projectId).eq("owner_id", context.userId).eq("status", "active").order("updated_at", { ascending: false }).limit(200),
    db(context.supabase).from("aax_conversations").select("id,title,updated_at,archived").eq("project_id", data.projectId).eq("owner_id", context.userId).order("updated_at", { ascending: false }).limit(100),
  ]);
  if (filesResult.error) throw new Response(`Could not load project files: ${filesResult.error.message}`, { status: 500 });
  if (memoriesResult.error) throw new Response(`Could not load project memories: ${memoriesResult.error.message}`, { status: 500 });
  if (conversationsResult.error) throw new Response(`Could not load project conversations: ${conversationsResult.error.message}`, { status: 500 });
  return { project, files: filesResult.data ?? [], memories: memoriesResult.data ?? [], conversations: conversationsResult.data ?? [] };
});

export const registerAetherProjectFile = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((input: { projectId: string; storagePath: string; filename: string; mimeType: string; sizeBytes: number }) => input).handler(async ({ context, data }) => {
  await assertOwnedProject(db(context.supabase), data.projectId, context.userId, false);
  const expectedPrefix = `${context.userId}/${data.projectId}/`; if (!data.storagePath.startsWith(expectedPrefix)) throw new Response("Invalid project file path", { status: 403 });
  if (data.sizeBytes <= 0 || data.sizeBytes > 25 * 1024 * 1024) throw new Response("Project files are limited to 25 MB", { status: 413 });
  const allowed = new Set(["application/pdf","text/plain","text/markdown","text/csv","application/json","application/xml","text/xml","text/html","image/jpeg","image/png","image/webp","image/gif"]); if (!allowed.has(data.mimeType)) throw new Response("Unsupported project file type", { status: 415 });
  const { data: file, error } = await db(context.supabase).from("aether_project_files").insert({ owner_id: context.userId, project_id: data.projectId, storage_path: data.storagePath, filename: data.filename.slice(0,255), mime_type: data.mimeType, size_bytes: data.sizeBytes, extraction_status: "pending" }).select("id,filename,mime_type,size_bytes,extraction_status,created_at").single();
  if (error || !file) throw new Response(`Could not register project file: ${error?.message ?? "unknown error"}`, { status: 500 }); return file;
});

export const deleteAetherProjectFile = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((input: { fileId: string }) => input).handler(async ({ context, data }) => {
  const { data: file, error } = await db(context.supabase).from("aether_project_files").select("id,storage_path").eq("id", data.fileId).eq("owner_id", context.userId).maybeSingle();
  if (error || !file) throw new Response("Project file not found", { status: 404 });
  await supabaseAdmin.storage.from("aether-project-files").remove([file.storage_path]);
  const { error: deleteError } = await db(context.supabase).from("aether_project_files").delete().eq("id", file.id).eq("owner_id", context.userId);
  if (deleteError) throw new Response(`Could not delete project file: ${deleteError.message}`, { status: 500 }); return { ok: true };
});

export const getAetherProjectFileDownloadUrl = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((input: { fileId: string }) => input).handler(async ({ context, data }) => {
  const { data: file, error } = await db(context.supabase).from("aether_project_files").select("storage_path,filename").eq("id", data.fileId).eq("owner_id", context.userId).maybeSingle();
  if (error || !file) throw new Response("Project file not found", { status: 404 });
  const { data: signed, error: signedError } = await supabaseAdmin.storage.from("aether-project-files").createSignedUrl(file.storage_path, 300);
  if (signedError || !signed?.signedUrl) throw new Response("Could not create project file URL", { status: 500 }); return { url: signed.signedUrl, filename: file.filename };
});
