import { describe, expect, it } from "vitest";
import { buildSafetyBinPdf, buildSafetyBinReportFileName, normalizeSafetyBinQuery } from "./safety-bin";

describe("Phase Y Safety Bin", () => {
  it("normalizes bounded search input", () => {
    expect(normalizeSafetyBinQuery("  person@example.com  ")).toBe("person@example.com");
    expect(normalizeSafetyBinQuery("x".repeat(200), 10)).toHaveLength(10);
  });

  it("creates deterministic report filenames", () => {
    const name = buildSafetyBinReportFileName(new Date("2026-09-12T12:34:56.000Z"));
    expect(name).toBe("Aether_Safety_Bin_Report_2026-09-12T12-34-56-000Z.pdf");
  });

  it("produces a valid PDF header with evidence metadata", () => {
    const pdf = buildSafetyBinPdf("Evidence", [{
      id: "00000000-0000-4000-8000-000000000001",
      source_schema: "public",
      source_table: "tasks",
      source_object_id: "task-1",
      source_owner_id: null,
      source_project_id: null,
      object_type: "tasks",
      object_name: "Test task",
      original_location: "public.tasks:task-1",
      original_created_at: null,
      original_updated_at: null,
      deleted_by_id: null,
      deleted_by_email: "person@example.com",
      deleted_at: "2026-09-12T12:00:00.000Z",
      deletion_reason: null,
      deletion_method: "delete",
      content: {},
      content_hash: "abc123",
      version: 1,
      recovery_status: "available",
      permanent_deletion_status: "preserved",
      related_task_id: null,
      related_run_id: null,
      correlation_id: null,
    }]);
    const text = new TextDecoder().decode(pdf);
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("AETHER");
    expect(text).toContain("person@example.com");
    expect(text).toContain("abc123");
    expect(text.endsWith("%%EOF")).toBe(true);
  });
});
