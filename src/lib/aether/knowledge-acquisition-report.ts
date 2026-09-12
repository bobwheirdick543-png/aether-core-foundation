import type { SupabaseClient } from "@supabase/supabase-js";

function pdfEscape(value: string): string { return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/\r?\n/g, " "); }
function wrap(value: string, width = 92): string[] { const words = value.split(/\s+/); const lines: string[] = []; let line = ""; for (const word of words) { if (!word) continue; if ((line + " " + word).trim().length > width) { if (line) lines.push(line); line = word; } else line = (line + " " + word).trim(); } if (line) lines.push(line); return lines; }
export function buildAcquisitionPdf(title: string, sections: Array<{ heading: string; body: string }>): Uint8Array {
  const lines: string[] = [title, "Aether Knowledge Acquisition Report", "", ...sections.flatMap((section) => [section.heading, ...wrap(section.body), ""])];
  const contentLines = ["BT", "/F1 10 Tf", "50 760 Td", ...lines.flatMap((line, i) => [`(${pdfEscape(line)}) Tj`, i < lines.length - 1 ? "0 -14 Td" : ""]), "ET"].filter(Boolean);
  const content = contentLines.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  const chunks: string[] = ["%PDF-1.4\n%âãÏÓ\n"]; const offsets: number[] = [0]; let offset = chunks[0].length;
  objects.forEach((object, index) => { offsets[index + 1] = offset; const chunk = `${index + 1} 0 obj\n${object}\nendobj\n`; chunks.push(chunk); offset += chunk.length; });
  const xref = offset; chunks.push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((v) => `${String(v).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new TextEncoder().encode(chunks.join(""));
}

export async function createAcquisitionReportAndNotify(admin: SupabaseClient, input: {
  job: any;
  candidateId: string;
  coverage: number;
  confidence: number;
  sourceCount: number;
  domainCount: number;
  unresolvedItems: unknown[];
  relatedConcepts: unknown[];
  sourceSummary: string;
}): Promise<{ reportId: string; filePath: string }> {
  const now = new Date().toISOString();
  const durationMs = input.job.started_at ? Math.max(0, Date.now() - new Date(input.job.started_at).getTime()) : 0;
  const reportId = crypto.randomUUID();
  const filePath = `knowledge-acquisition/${input.job.owner_id}/${input.job.id}/aether-knowledge-report-v1.pdf`;
  const pdf = buildAcquisitionPdf(`Aether — ${input.job.subject}`, [
    { heading: "Mission", body: `${input.job.title}. Subject: ${input.job.subject}. Target: ${input.job.target_type}. Requested scope is bounded to core subject, essential context, necessary relationships, terminology and verification.` },
    { heading: "Execution", body: `Started: ${input.job.started_at ?? "not recorded"}. Ended: ${now}. Duration: ${Math.round(durationMs / 1000)} seconds. Research budget: ${Math.round(Number(input.job.time_budget_ms) / 60000)} minutes. Coverage: ${Math.round(input.coverage * 100)}% of defined scope. Confidence: ${Math.round(input.confidence * 100)}%.` },
    { heading: "Evidence", body: `${input.sourceCount} sources across ${input.domainCount} domains. ${input.sourceSummary}` },
    { heading: "Relationships and remaining work", body: `Related concepts: ${JSON.stringify(input.relatedConcepts).slice(0, 6000)}. Unresolved items: ${JSON.stringify(input.unresolvedItems).slice(0, 6000)}.` },
    { heading: "Approval gate", body: "This report and candidate are awaiting explicit verification/approval. Nothing has been globally published from this acquisition merely because the research completed." },
  ]);
  const { error: uploadError } = await admin.storage.from("aether-reports").upload(filePath, pdf, { contentType: "application/pdf", upsert: true });
  if (uploadError) throw new Error(`Report upload failed: ${uploadError.message}`);
  const { error: reportError } = await admin.from("reports").insert({ id: reportId, owner_id: input.job.owner_id, run_id: input.job.run_id, project_id: input.job.project_id ?? null, title: `Knowledge Acquisition — ${input.job.subject}`, topic: input.job.subject, source_count: input.sourceCount, verification_status: "pending", approval_status: "pending", file_path: filePath, current_version: 1, metadata: { kind: "knowledge-acquisition", acquisitionJobId: input.job.id, candidateId: input.candidateId, coverage: input.coverage, confidence: input.confidence, domainCount: input.domainCount, durationMs, bucket: "aether-reports", generatedAt: now } });
  if (reportError) throw new Error(`Report record failed: ${reportError.message}`);
  const { data: admins } = await admin.from("user_roles").select("user_id").eq("role", "admin");
  const recipients = [...new Set([input.job.owner_id, ...(admins ?? []).map((row: any) => row.user_id)])];
  if (recipients.length) await admin.from("notifications").upsert(recipients.map((recipientId) => ({ recipient_id: recipientId, audience: recipientId === input.job.owner_id ? "user" : "admin", event_type: "knowledge_acquisition.awaiting_approval", title: `Knowledge acquisition awaiting verification: ${input.job.subject}`, body: `A bounded research mission completed at ${Math.round(input.coverage * 100)}% of its defined scope. Nothing has been globally distributed. Review the report and candidate before approval.`, resource_type: "knowledge_acquisition", resource_id: input.candidateId, link: recipientId === input.job.owner_id ? "/knowledge" : "/admin/knowledge-acquisition", status: "pending", idempotency_key: `ka-approval:${input.job.id}:${recipientId}` , metadata: { acquisitionJobId: input.job.id, candidateId: input.candidateId, reportId, reportBucket: "aether-reports", reportPath: filePath, attachment: { bucket: "aether-reports", path: filePath, contentType: "application/pdf", filename: `aether-knowledge-${input.job.id}.pdf` } } })), { onConflict: "recipient_id,idempotency_key", ignoreDuplicates: true });
  return { reportId, filePath };
}
