import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const migration = (name: string) => readFileSync(resolve(root, "supabase/migrations", name), "utf8");

describe("Phase E memory contracts", () => {
  it("defines durable memory with explicit scope and candidate separation", () => {
    const sql = migration("20260911073456_phase_e_memory_system.sql");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.aether_memories");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.aether_memory_candidates");
    expect(sql).toContain("scope IN ('global','project')");
    expect(sql).toContain("status IN ('active','superseded','deleted')");
    expect(sql).toContain("status IN ('candidate','approved','rejected','promoted','expired')");
    expect(sql).toContain("WITH CHECK ((select auth.uid()) = owner_id");
  });

  it("keeps memory retrieval bounded to active, authorized scope", () => {
    const sql = migration("20260911073456_phase_e_memory_system.sql");
    expect(sql).toContain("m.owner_id = (select auth.uid())");
    expect(sql).toContain("m.status = 'active'");
    expect(sql).toContain("m.deleted_at IS NULL");
    expect(sql).toContain("LIMIT LEAST(GREATEST(p_limit, 1), 50)");
  });

  it("preserves history when memory content changes", () => {
    const sql = migration("20260911073602_phase_e_memory_versioning_rpc.sql");
    expect(sql).toContain("previous_memory_id");
    expect(sql).toContain("old_memory.version + 1");
    expect(sql).toContain("status = 'superseded'");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.replace_aether_memory");
  });

  it("keeps project files private and ownership-bound", () => {
    const sql = migration("20260911073548_phase_e_project_files.sql");
    expect(sql).toContain("public.aether_project_files");
    expect(sql).toContain("public = false");
    expect(sql).toContain("bucket_id = 'aether-project-files'");
    expect(sql).toContain("split_part(name, '/', 1) = (select auth.uid())::text");
  });

  it("bridges existing chat memory actions into governed candidates", () => {
    const sql = migration("20260911074427_phase_e_chat_memory_bridge.sql");
    expect(sql).toContain("aax_chat_memory_candidates");
    expect(sql).toContain("aether_memory_candidates");
    expect(sql).toContain("bridge_aax_chat_memory_candidate");
  });
});
