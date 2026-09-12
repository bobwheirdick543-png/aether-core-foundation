import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell } from "@/components/layout/AdminShell";
import { PageHeader, Panel, Tag } from "@/components/common/Primitives";
import { getPhaseUSafeSettings, setPhaseUSafeSetting } from "@/lib/admin/phase-u-settings.functions";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({ meta: [{ title: "Admin settings — Aether" }, { name: "robots", content: "noindex" }] }),
  component: Page,
});

function Page() {
  const qc = useQueryClient();
  const load = useServerFn(getPhaseUSafeSettings);
  const save = useServerFn(setPhaseUSafeSetting);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("{}");
  const { data = [], isLoading } = useQuery({ queryKey: ["phase-u-settings"], queryFn: () => load({}) });

  const submit = async () => {
    if (!key.trim()) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      alert("Value must be valid JSON");
      return;
    }
    try {
      await save({ key: key.trim(), value: parsed });
      setKey("");
      setValue("{}");
      await qc.invalidateQueries({ queryKey: ["phase-u-settings"] });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not save setting");
    }
  };

  return (
    <AdminShell>
      <div className="space-y-6">
        <PageHeader eyebrow="Control plane" title="Platform settings" description="Validated administrator configuration with server-side authorization and an audit trail." backFallback="/admin" />
        <Panel className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
            <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="setting.key" className="rounded-md border bg-background px-3 py-2 text-sm" />
            <input value={value} onChange={(e) => setValue(e.target.value)} placeholder='JSON value, e.g. {"enabled":true}' className="rounded-md border bg-background px-3 py-2 font-mono text-sm" />
            <button onClick={submit} className="rounded-md border border-admin/30 px-4 py-2 text-sm hover:bg-admin/10">Save</button>
          </div>
          <p className="text-[11px] text-muted-foreground">Only explicit JSON values are accepted. Secret-like setting keys are rejected server-side; secrets must remain in server-side secret storage.</p>
        </Panel>
        <Panel className="space-y-0 p-0">
          {isLoading ? <p className="px-5 py-5 text-sm text-muted-foreground">Loading settings…</p> : data.length === 0 ? <p className="px-5 py-5 text-sm text-muted-foreground">No platform settings have been configured.</p> : data.map((s: any, i: number) => (
            <div key={s.key} className={`px-5 py-4 ${i < data.length - 1 ? "border-b border-border/50" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="font-mono text-sm">{s.key}</p><p className="mt-1 text-xs text-muted-foreground">Updated {new Date(s.updated_at).toLocaleString()}</p></div>
                <Tag tone="admin">audited</Tag>
              </div>
              <pre className="mt-3 overflow-x-auto rounded border bg-muted/30 p-3 text-xs">{JSON.stringify(s.value, null, 2)}</pre>
            </div>
          ))}
        </Panel>
      </div>
    </AdminShell>
  );
}
