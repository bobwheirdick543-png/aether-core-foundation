import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FileText, Download, Archive, RefreshCw } from "lucide-react";
import { AdminShell } from "@/components/layout/AdminShell";
import { PageHeader, Panel, Tag, EmptyState } from "@/components/common/Primitives";
import { Button } from "@/components/ui/button";
import {
  archiveReport,
  getReport,
  getReportDownloadUrl,
  listReports,
} from "@/lib/aether/report.functions";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  head: () => ({
    meta: [
      { title: "Reports — Aether Admin" },
      { name: "robots", content: "noindex" },
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
  owner_id?: string;
};

function toneFor(status: string): "success" | "warning" | "primary" | "neutral" | "danger" {
  const s = (status || "").toLowerCase();
  if (s.includes("verified") || s.includes("approved") || s === "ready") return "success";
  if (s.includes("fail") || s.includes("reject")) return "danger";
  if (s.includes("pending") || s.includes("review")) return "warning";
  return "neutral";
}

function Page() {
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
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

  const open = async (id: string) => {
    setBusy(true);
    try {
      setDetail(await getReport({ data: { reportId: id } }));
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
      setMsg("Report archived.");
      setDetail(null);
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminShell>
      <div className="space-y-6">
        <PageHeader
          title="Platform reports"
          description="Admin view of durable Aether research PDFs across owners (Phase J). Download and archive only — no fabricated content."
          backFallback="/admin"
        />

        <Panel>
          <div className="flex flex-wrap gap-3">
            <input
              className="min-w-[200px] flex-1 rounded-md border bg-background px-3 py-2 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void refresh();
              }}
              placeholder="Search title or topic"
            />
            <Button type="button" size="sm" variant="outline" onClick={() => void refresh()}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>
          {msg && <p className="mt-3 text-sm text-muted-foreground">{msg}</p>}
        </Panel>

        {loadError && (
          <Panel>
            <p className="text-sm text-destructive">Could not load reports: {loadError}</p>
          </Panel>
        )}

        <Panel>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <h2 className="text-sm font-semibold">Report library</h2>
            <span className="text-xs text-muted-foreground">{rows.length} shown</span>
          </div>
          {!rows.length ? (
            <EmptyState
              title="No platform reports"
              description="Reports appear when users generate PDFs from research sessions."
              icon={<FileText className="h-5 w-5" />}
            />
          ) : (
            <div className="mt-4 divide-y divide-border">
              {rows.map((r) => (
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
                      {r.topic ?? "—"}
                      {r.owner_id ? ` · owner ${r.owner_id.slice(0, 8)}…` : ""} ·{" "}
                      {new Date(r.updated_at).toLocaleString()}
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
                  {detail.report.verification_status} · {detail.report.approval_status}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setDetail(null)}>
                Close
              </Button>
            </div>
            <div className="mt-4 space-y-2">
              {detail.versions.map((v) => (
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
                      Download
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </Panel>
        )}
      </div>
    </AdminShell>
  );
}
