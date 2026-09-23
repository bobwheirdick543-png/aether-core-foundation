import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, Download, Archive, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, Panel, Tag, EmptyState } from "@/components/common/Primitives";
import { Button } from "@/components/ui/button";
import {
  archiveReport,
  generateReport,
  getReport,
  getReportDownloadUrl,
  listReports,
} from "@/lib/aether/report.functions";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports — Aether" },
      { name: "description", content: "Generated research and analysis reports." },
    ],
  }),
  component: Page,
});

type Row = {
  id: string;
  title: string;
  topic: string | null;
  current_version: number;
  source_count: number;
  verification_status: string;
  approval_status: string;
  updated_at: string;
  archived_at: string | null;
};

function toneFor(status: string): "success" | "warning" | "primary" | "neutral" | "danger" {
  const s = (status || "").toLowerCase();
  if (s.includes("verified") || s.includes("approved") || s === "ready") return "success";
  if (s.includes("fail") || s.includes("reject")) return "danger";
  if (s.includes("pending") || s.includes("review")) return "warning";
  if (s.includes("run") || s.includes("gen")) return "primary";
  return "neutral";
}

function Page() {
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [session, setSession] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof getReport>> | null>(null);
  const [loadError, setLoadError] = useState("");

  const refresh = async () => {
    try {
      setLoadError("");
      const result = await listReports({ data: { search, includeArchived: true } });
      setRows(Array.isArray(result) ? (result as Row[]) : []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
      setRows([]);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const generate = async () => {
    if (!session.trim()) {
      setMsg("Enter a research session ID (from Research → Open session timeline).");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const r = await generateReport({
        data: {
          researchSessionId: session.trim(),
          idempotencyKey: `reports:${session.trim()}:${Date.now()}`,
        },
      });
      setMsg(`Report ${r.reportId} version ${r.version} generated. Aether-branded PDF is stored privately.`);
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const open = async (id: string) => {
    setBusy(true);
    try {
      const result = await getReport({ data: { reportId: id } });
      setDetail({ ...result, versions: Array.isArray(result.versions) ? result.versions : [] });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const download = async (id: string, version?: number) => {
    setBusy(true);
    try {
      const r = await getReportDownloadUrl({ data: { reportId: id, version } });
      window.open(r.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const archive = async (id: string) => {
    setBusy(true);
    try {
      await archiveReport({ data: { reportId: id } });
      setMsg("Report archived. Prior versions remain preserved.");
      setDetail(null);
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Reports"
        description="Durable, reviewable Aether research artifacts (Phase J). PDFs include branding, sources, verification and version."
        backFallback="/dashboard"
      />
      <div className="mt-6 space-y-4">
        <Panel>
          <h2 className="text-sm font-semibold">Generate from research session</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Uses structured session data only — no invented findings. Regeneration creates a new version and keeps prior
            artifacts.
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <input
              className="rounded-md border bg-background px-3 py-2 text-sm"
              value={session}
              onChange={(e) => setSession(e.target.value)}
              placeholder="Research session ID"
            />
            <input
              className="rounded-md border bg-background px-3 py-2 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void refresh();
              }}
              placeholder="Search reports"
            />
            <Button type="button" disabled={busy} onClick={() => void generate()}>
              {busy ? "Working…" : "Generate PDF"}
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Tip: open{" "}
            <Link to="/research" className="text-primary hover:underline">
              Research
            </Link>
            , then copy the session id from the session URL.
          </p>
          {msg && <p className="mt-3 text-sm text-muted-foreground">{msg}</p>}
        </Panel>

        {loadError && (
          <Panel>
            <p className="text-sm text-destructive">Could not load reports: {loadError}</p>
            <p className="mt-1 text-xs text-muted-foreground">The page stays usable. Retry when the backend is ready.</p>
          </Panel>
        )}

        <Panel>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <h2 className="text-sm font-semibold">Report library</h2>
            </div>
            <Button type="button" size="sm" variant="ghost" onClick={() => void refresh()}>
              <RefreshCw className="mr-1 h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>
          {!rows.length ? (
            <EmptyState
              title="No reports yet"
              description="Generate a PDF from a research session ID above. Only real session data is used."
              icon={<FileText className="h-5 w-5" />}
            />
          ) : (
            <div className="mt-4 divide-y divide-border">
              {(Array.isArray(rows) ? rows : []).map((r) => (
                <div
                  key={r.id}
                  className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between"
                >
                  <button type="button" className="text-left" onClick={() => void open(r.id)}>
                    <div className="font-medium">{r.title}</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Tag>v{r.current_version}</Tag>
                      <Tag>{r.source_count} sources</Tag>
                      <Tag tone={toneFor(r.verification_status)}>{r.verification_status}</Tag>
                      <Tag tone={toneFor(r.approval_status)}>{r.approval_status}</Tag>
                      {r.archived_at ? <Tag>archived</Tag> : null}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {r.topic ?? "—"} · updated {new Date(r.updated_at).toLocaleString()}
                    </div>
                  </button>
                  <div className="flex gap-2">
                    {!r.archived_at && (
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => void archive(r.id)}>
                        <Archive className="mr-1 h-3.5 w-3.5" />
                        Archive
                      </Button>
                    )}
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => void download(r.id)}>
                      <Download className="mr-1 h-3.5 w-3.5" />
                      Download
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {detail && (
          <Panel>
            <div className="flex justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">{detail.report.title}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Version history · {detail.report.verification_status} · {detail.report.approval_status}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Report ID: <code className="font-mono">{detail.report.id}</code>
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setDetail(null)}>
                Close
              </Button>
            </div>
            <div className="mt-4 space-y-2">
              {(Array.isArray(detail?.versions) ? detail.versions : []).map((v) => (
                <div
                  key={v.id}
                  className="flex flex-col gap-2 rounded-md border p-3 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      Version {v.version}
                      <Tag tone={toneFor(v.status)}>{v.status}</Tag>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {v.byte_size ? `${v.byte_size.toLocaleString()} bytes` : "No artifact"} ·{" "}
                      {v.generated_at ? new Date(v.generated_at).toLocaleString() : "—"}
                    </div>
                    {v.error && <div className="mt-1 text-xs text-destructive">{v.error}</div>}
                  </div>
                  {v.status === "ready" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void download(detail.report.id, v.version)}
                    >
                      <Download className="mr-1 h-3.5 w-3.5" />
                      Download version
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </Panel>
        )}
      </div>
    </AppShell>
  );
}
