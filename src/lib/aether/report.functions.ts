/**
 * AETHER REPORT / PDF ARCHIVE SERVER FUNCTIONS
 * Registers generated reports and lists them with strict ownership.
 * Actual PDF bytes are expected to be uploaded to Supabase Storage separately.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildReportFileName, buildStoragePath, type ReportType } from "./pdf-report";

export const listMyReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("reports")
      .select("id, title, topic, source_count, verification_status, approval_status, file_path, created_at, updated_at, run_id, project_id")
      .eq("owner_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const registerReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    title: string;
    topic?: string;
    reportType?: ReportType;
    runId?: string;
    projectId?: string;
    sourceCount?: number;
    verificationStatus?: string;
    approvalStatus?: string;
    storagePath?: string;
  }) => {
    const title = String(data?.title ?? "").trim();
    if (!title) throw new Error("Title is required");
    return {
      title: title.slice(0, 300),
      topic: data?.topic?.trim().slice(0, 300) || null,
      reportType: (data?.reportType || "research") as ReportType,
      runId: data?.runId || null,
      projectId: data?.projectId || null,
      sourceCount: data?.sourceCount ?? 0,
      verificationStatus: data?.verificationStatus || "pending",
      approvalStatus: data?.approvalStatus || "pending",
      storagePath: data?.storagePath || null,
    };
  })
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const generatedAt = new Date();
    const fileName = buildReportFileName({
      type: data.reportType,
      topic: data.topic || data.title,
      generatedAt,
      runId: data.runId || undefined,
      version: 1,
    });
    const storagePath = data.storagePath || buildStoragePath(context.userId, fileName);

    const { data: row, error } = await supabaseAdmin
      .from("reports")
      .insert({
        owner_id: context.userId,
        run_id: data.runId,
        project_id: data.projectId,
        title: data.title,
        topic: data.topic,
        source_count: data.sourceCount,
        verification_status: data.verificationStatus,
        approval_status: data.approvalStatus,
        file_path: storagePath,
      })
      .select("id, file_path, created_at")
      .single();

    if (error || !row) throw new Error(error?.message || "Failed to register report");

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "report.registered",
      target_type: "reports",
      target_id: row.id,
      metadata: { file_name: fileName, storage_path: storagePath },
    });

    return {
      reportId: row.id,
      fileName,
      storagePath: row.file_path,
      createdAt: row.created_at,
    };
  });

export const listAdminReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Response("Forbidden", { status: 403 });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("reports")
      .select("id, title, topic, source_count, verification_status, approval_status, file_path, owner_id, created_at, run_id, project_id")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
