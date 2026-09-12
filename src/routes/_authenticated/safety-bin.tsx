import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Recycle, Search, ShieldCheck, RotateCcw, Snowflake, Trash2, FileDown, Send, Database, History, FolderSearch, UserRound, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, Panel, Tag } from "@/components/common/Primitives";
import { useRoles } from "@/hooks/useRoles";
import {
  freezeSafetyBinItem,
  generateSafetyBinPdf,
  getSafetyBinSummary,
  listSafetyBinChat,
  listSafetyBinItems,
  purgeSafetyBinItem,
  requestMyDataDeletion,
  requestMyDataExport,
  restoreSafetyBinItem,
  sendRecyclingAgentMessage,
} from "@/lib/aether/safety-bin.functions";

export const Route = createFileRoute("/_authenticated/safety-bin")({
  head: () => ({ meta: [{ title: "Safety Bin — Aether" }, { name: "description", content: "Aether Safety Bin and Recycling Agent ecosystem." }] }),
  component: SafetyBinPage,
});

function SafetyBinPage() {
  const queryClient = useQueryClient();
  const { data: roles } = useRoles();
  const list = useServerFn(listSafetyBinItems);
  const summaryFn = useServerFn(getSafetyBinSummary);
  const chatFn = useServerFn(listSafetyBinChat);
  const sendChat = useServerFn(sendRecyclingAgentMessage);
  const restore = useServerFn(restoreSafetyBinItem);
  const freeze = useServerFn(freezeSafetyBinItem);
  const purge = useServerFn(purgeSafetyBinItem);
  const makePdf = useServerFn(generateSafetyBinPdf);
  const requestExport = useServerFn(requestMyDataExport);
  const requestDeletion = useServerFn(requestMyDataDeletion);
  const [email, setEmail] = useState("");
  const [sourceTable, setSourceTable] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState<"overview" | "deleted" | "agent" | "lifecycle">("overview");

  const itemsQuery = useQuery({ queryKey: ["safety-bin-items", email, sourceTable], queryFn: () => list({ data: { email, sourceTable, limit: 100 } }) });
  const summaryQuery = useQuery({ queryKey: ["safety-bin-summary"], queryFn: () => summaryFn({}) });
  const chatQuery = useQuery({ queryKey: ["safety-bin-chat"], queryFn: () => chatFn({}) });
  const items = itemsQuery.data?.items ?? [];
  const selectedItems = useMemo(() => items.filter((item) => selected.includes(item.id)), [items, selected]);

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["safety-bin-items"] }),
      queryClient.invalidateQueries({ queryKey: ["safety-bin-summary"] }),
      queryClient.invalidateQueries({ queryKey: ["safety-bin-chat"] }),
    ]);
  }

  async function handleRestore(id: string) {
    const result = await restore({ data: { id } });
    if (!result.ok) toast.error(result.message ?? "Restore failed"); else toast.success("Record restored; deletion history remains preserved.");
    await refresh();
  }

  async function handleFreeze(id: string, frozen: boolean) {
    const result = await freeze({ data: { id, frozen } });
    if (!result.ok) toast.error(result.message ?? "Freeze operation failed"); else toast.success(frozen ? "Evidence frozen." : "Evidence released.");
    await refresh();
  }

  async function handlePurge(id: string) {
    if (!window.confirm("Permanently destroy this Safety Bin record? This cannot be undone.")) return;
    const result = await purge({ data: { id, confirm: true, reason: "Administrator-authorized permanent purge" } });
    if (!result.ok) toast.error(result.message ?? "Permanent purge failed"); else toast.success("Record permanently purged.");
    await refresh();
  }

  async function handlePdf() {
    const result = await makePdf({ data: { itemIds: selected, title: "Aether Safety Bin Evidence Report" } });
    if (!result.ok) return toast.error(result.message ?? "PDF generation failed");
    setSelected([]);
    window.open(result.signedUrl, "_blank", "noopener,noreferrer");
    toast.success("Aether Safety Bin PDF generated.");
  }

  async function handleChat() {
    const text = message.trim();
    if (!text) return;
    setMessage("");
    const result = await sendChat({ data: { message: text } });
    if (!result.ok) toast.error(result.message ?? "Recycling Agent failed");
    else {
      if (result.itemIds?.length) setSelected(result.itemIds);
      await refresh();
    }
  }

  return (
    <AppShell>
      <div className="animate-in-up space-y-6">
        <PageHeader eyebrow="Independent ecosystem" title="♻️ Aether Safety Bin" description="Deleted platform records are preserved here until an explicitly authorized permanent purge. The Recycling Agent operates this ecosystem without bypassing Aether security." />

        <div className="grid gap-2 sm:grid-cols-4">
          {[['overview','Overview',Database],['deleted','Deleted Items',History],['agent','Recycling Agent',Recycle],['lifecycle','Lifecycle & Export',ShieldCheck]].map(([key,label,Icon]) => (
            <button key={key as string} type="button" onClick={() => setTab(key as typeof tab)} className={`flex items-center gap-2 rounded-md border px-4 py-3 text-left text-sm transition-colors ${tab === key ? "border-primary/50 bg-primary/[0.06] text-foreground" : "border-border text-muted-foreground hover:bg-accent"}`}><Icon className="h-4 w-4" />{label as string}</button>
          ))}
        </div>

        {tab === "overview" ? <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Panel><p className="text-xs uppercase tracking-wider text-muted-foreground">Preserved records</p><p className="mt-2 text-3xl font-semibold">{summaryQuery.data?.total ?? 0}</p></Panel>
            <Panel><p className="text-xs uppercase tracking-wider text-muted-foreground">Frozen evidence</p><p className="mt-2 text-3xl font-semibold">{summaryQuery.data?.frozen ?? 0}</p></Panel>
            <Panel><p className="text-xs uppercase tracking-wider text-muted-foreground">Restored</p><p className="mt-2 text-3xl font-semibold">{summaryQuery.data?.restored ?? 0}</p></Panel>
          </div>
          <Panel className="border-primary/20 bg-primary/[0.03]"><div className="flex items-start gap-3"><Recycle className="mt-0.5 h-5 w-5 text-primary" /><div><h2 className="text-sm font-semibold">Recycling Agent</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Search who deleted records, verify integrity, organize evidence, support authorized recovery and prepare Aether-branded reports. It cannot grant itself permissions or permanently purge evidence.</p><button type="button" className="mt-3 text-xs font-medium text-primary hover:underline" onClick={() => setTab("agent")}>Open Recycling Agent →</button></div></div></Panel>
          <Panel><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 text-primary" /><div><h2 className="text-sm font-semibold">Chain of custody</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Created → Active → Deleted → Safety Bin → Restore / Export / Investigate → Authorized Purge. Integrity hashes and deletion actor metadata are retained with the record.</p></div></div></Panel>
        </> : null}

        {tab === "deleted" ? <Panel>
          <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row"><label className="flex flex-1 items-center gap-2 rounded-md border border-border px-3 py-2"><UserRound className="h-4 w-4 text-muted-foreground" /><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Search deleting user email" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label><label className="flex items-center gap-2 rounded-md border border-border px-3 py-2"><FolderSearch className="h-4 w-4 text-muted-foreground" /><input value={sourceTable} onChange={(e) => setSourceTable(e.target.value)} placeholder="Source table" className="w-full bg-transparent text-sm outline-none sm:w-48" /></label><button type="button" onClick={() => void itemsQuery.refetch()} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"><Search className="mr-2 inline h-4 w-4" />Search</button></div>
          <div className="mt-4 flex flex-wrap items-center gap-2"><Tag tone="neutral">{items.length} shown</Tag><button type="button" disabled={!selected.length} onClick={() => void handlePdf()} className="rounded-md border border-border px-3 py-2 text-xs disabled:opacity-40"><FileDown className="mr-1.5 inline h-3.5 w-3.5" />Generate PDF ({selected.length})</button></div>
          <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-xs"><thead className="text-muted-foreground"><tr><th className="px-2 py-2"></th><th className="px-2 py-2">Record</th><th className="px-2 py-2">Deleted by</th><th className="px-2 py-2">Date / time</th><th className="px-2 py-2">Source</th><th className="px-2 py-2">State</th><th className="px-2 py-2">Actions</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-t border-border/50"><td className="px-2 py-3"><input type="checkbox" checked={selected.includes(item.id)} onChange={(e) => setSelected((current) => e.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} /></td><td className="max-w-56 px-2 py-3"><p className="truncate font-medium">{item.object_name ?? item.source_object_id ?? item.id}</p><p className="truncate text-muted-foreground">{item.object_type}</p></td><td className="px-2 py-3">{item.deleted_by_email ?? "Unknown"}</td><td className="whitespace-nowrap px-2 py-3">{new Date(item.deleted_at).toLocaleString()}</td><td className="px-2 py-3">{item.source_table}</td><td className="px-2 py-3"><Tag tone={item.recovery_status === "frozen" ? "warning" : "neutral"}>{item.recovery_status}</Tag></td><td className="whitespace-nowrap px-2 py-3"><button type="button" onClick={() => void handleRestore(item.id)} className="mr-1 rounded border border-border p-1.5" title="Restore"><RotateCcw className="h-3.5 w-3.5" /></button>{roles?.isAdmin ? <><button type="button" onClick={() => void handleFreeze(item.id, item.recovery_status !== "frozen")} className="mr-1 rounded border border-border p-1.5" title="Freeze"><Snowflake className="h-3.5 w-3.5" /></button><button type="button" onClick={() => void handlePurge(item.id)} className="rounded border border-destructive/40 p-1.5 text-destructive" title="Permanent purge"><Trash2 className="h-3.5 w-3.5" /></button></> : null}</td></tr>)}</tbody></table>{!items.length ? <p className="py-10 text-center text-sm text-muted-foreground">No preserved records match this search.</p> : null}</div>
        </Panel> : null}

        {tab === "agent" ? <Panel className="flex min-h-[560px] flex-col"><div className="flex items-center gap-3 border-b border-border pb-4"><span className="rounded-md border border-primary/30 bg-primary/[0.06] p-2 text-primary"><Recycle className="h-5 w-5" /></span><div><h2 className="text-sm font-semibold">Recycling Agent</h2><p className="text-xs text-muted-foreground">♻️ Independent Safety Bin operations</p></div></div><div className="flex-1 space-y-3 overflow-y-auto py-5">{(chatQuery.data ?? []).map((entry) => <div key={entry.id} className={`max-w-2xl rounded-lg border px-4 py-3 text-sm ${entry.role === "user" ? "ml-auto border-primary/20 bg-primary/[0.04]" : "border-border bg-card"}`}><p className="whitespace-pre-wrap">{entry.content}</p><p className="mt-2 text-[10px] text-muted-foreground">{new Date(entry.created_at).toLocaleString()}</p></div>)}{!(chatQuery.data?.length) ? <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">Ask: “Give me everything they have deleted for person@example.com.”</div> : null}</div><div className="flex gap-2 border-t border-border pt-4"><input value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleChat(); } }} placeholder="Ask the Recycling Agent…" className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" /><button type="button" onClick={() => void handleChat()} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"><Send className="h-4 w-4" /></button></div></Panel> : null}

        {tab === "lifecycle" ? <div className="grid gap-4 lg:grid-cols-2"><Panel><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-primary" /><div><h2 className="text-sm font-semibold">Your data controls</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Export requests and deletion requests are durable workflows. Approved deletion preserves application records in the Safety Bin before the account is removed.</p><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={async () => { const r = await requestExport({}); if (!r.ok) toast.error(r.message); else toast.success("Data export request submitted."); }} className="rounded-md border border-border px-3 py-2 text-xs">Request data export</button><button type="button" onClick={async () => { const r = await requestDeletion({ data: { reason: "User-requested account deletion" } }); if (!r.ok) toast.error(r.message); else toast.success("Deletion request submitted for policy review."); }} className="rounded-md border border-destructive/40 px-3 py-2 text-xs text-destructive">Request account deletion</button></div></div></div></Panel><Panel><h2 className="text-sm font-semibold">Lifecycle boundary</h2><ul className="mt-3 space-y-2 text-xs text-muted-foreground"><li>• Retention policies run server-side and preserve deletion evidence.</li><li>• Archive/soft-delete semantics remain distinct from permanent destruction.</li><li>• Restore does not erase the original deletion event.</li><li>• Frozen evidence cannot be purged through normal Safety Bin controls.</li><li>• Phase X remains the final authorization boundary for privileged actions.</li></ul></Panel></div> : null}
      </div>
    </AppShell>
  );
}
