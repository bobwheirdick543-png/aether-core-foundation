/** Phase Y — Safety Bin service contracts. Delete is preservation; purge is explicit destruction. */

export type SafetyBinStatus = "available" | "restored" | "restore_failed" | "frozen";

export interface SafetyBinItem {
  id: string;
  source_schema: string;
  source_table: string;
  source_object_id: string | null;
  source_owner_id: string | null;
  source_project_id: string | null;
  object_type: string;
  object_name: string | null;
  original_location: string | null;
  original_created_at: string | null;
  original_updated_at: string | null;
  deleted_by_id: string | null;
  deleted_by_email: string | null;
  deleted_at: string;
  deletion_reason: string | null;
  deletion_method: string;
  content: Record<string, unknown>;
  content_hash: string;
  version: number;
  recovery_status: SafetyBinStatus;
  permanent_deletion_status: "preserved" | "purge_requested" | "purged";
  related_task_id: string | null;
  related_run_id: string | null;
  correlation_id: string | null;
}

export function normalizeSafetyBinQuery(value: unknown, max = 160): string {
  return String(value ?? "").trim().slice(0, max);
}

export function buildSafetyBinReportFileName(now = new Date()): string {
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  return `Aether_Safety_Bin_Report_${stamp}.pdf`;
}

function pdfEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/[^\x20-\x7E]/g, "?");
}

/** Minimal dependency-free PDF writer. The report is deliberately deterministic and text-first. */
export function buildSafetyBinPdf(title: string, items: SafetyBinItem[], generatedAt = new Date()): Uint8Array {
  const lines: string[] = [
    "AETHER",
    "SAFETY BIN — CHAIN OF CUSTODY REPORT",
    title,
    `Generated: ${generatedAt.toISOString()}`,
    `Records: ${items.length}`,
    "",
  ];

  for (const item of items) {
    lines.push(`Record ${item.id}`);
    lines.push(`Type: ${item.object_type} | Source: ${item.source_schema}.${item.source_table}`);
    lines.push(`Object: ${item.object_name ?? item.source_object_id ?? "unnamed"}`);
    lines.push(`Deleted by: ${item.deleted_by_email ?? item.deleted_by_id ?? "unknown"}`);
    lines.push(`Deleted at: ${item.deleted_at}`);
    lines.push(`Original location: ${item.original_location ?? "unknown"}`);
    lines.push(`Integrity SHA-256: ${item.content_hash}`);
    lines.push(`Recovery: ${item.recovery_status} | Permanent status: ${item.permanent_deletion_status}`);
    lines.push(`Correlation: ${item.correlation_id ?? "none"}`);
    lines.push("");
  }

  const pageLines = 46;
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += pageLines) pages.push(lines.slice(i, i + pageLines));
  if (!pages.length) pages.push([]);

  const objects: string[] = [];
  const pageIds: number[] = [];
  const contentIds: number[] = [];
  let nextId = 1;

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(`<< /Type /Pages /Kids [${pages.map((_, i) => `${3 + i * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`);

  for (const page of pages) {
    const pageId = nextId + 2;
    const contentId = nextId + 3;
    pageIds.push(pageId);
    contentIds.push(contentId);
    const stream = [
      "BT",
      "/F1 10 Tf",
      "50 770 Td",
      ...page.map((line, index) => `${index === 0 ? "" : "0 -15 Td"} (${pdfEscape(line.slice(0, 150))}) Tj`),
      "ET",
    ].join("\n");
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${3 + pages.length * 2} 0 R >> >> /Contents ${contentId} 0 R >>`);
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    nextId += 2;
  }
  const fontId = 3 + pages.length * 2;
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i += 1) pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}
