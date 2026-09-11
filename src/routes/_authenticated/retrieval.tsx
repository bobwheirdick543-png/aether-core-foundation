import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { listPhaseIIndexJobs, retrievePhaseI } from "@/lib/aether/phase-i-retrieval.functions";

export const Route = createFileRoute("/_authenticated/retrieval")({ component: RetrievalWorkspace });

function RetrievalWorkspace() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"hybrid" | "lexical" | "semantic" | "graph">("hybrid");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [results, setResults] = useState<Array<{ rank: number; title: string; snippet: string; finalScore: number; provenance: Record<string, unknown> }>>([]);
  const [jobs, setJobs] = useState<unknown[]>([]);

  async function search() {
    if (!query.trim()) return;
    setLoading(true); setMessage("");
    try { const response = await retrievePhaseI({ data: { query, mode, topK: 10 } }); setResults(response.results); setMessage(`${response.results.length} authorized result${response.results.length === 1 ? "" : "s"} returned.`); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Retrieval failed."); }
    finally { setLoading(false); }
  }

  async function refreshJobs() {
    try { setJobs(await listPhaseIIndexJobs({ data: {} })); setMessage("Index status refreshed."); } catch { setMessage("Could not load index status."); }
  }

  return <main className="mx-auto max-w-6xl space-y-6 p-6">
    <header><p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Phase I</p><h1 className="text-3xl font-semibold">Retrieval & Knowledge Graph</h1><p className="mt-2 text-muted-foreground">Permission-filtered hybrid retrieval over approved production knowledge.</p></header>
    <section className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row"><input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void search(); }} placeholder="Ask the production knowledge index…" className="min-w-0 flex-1 rounded-xl border bg-background px-4 py-3" />
      <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} className="rounded-xl border bg-background px-4 py-3"><option value="hybrid">Hybrid</option><option value="lexical">Lexical</option><option value="semantic">Semantic</option><option value="graph">Graph</option></select>
      <button type="button" onClick={() => void search()} disabled={loading} className="rounded-xl bg-primary px-5 py-3 text-primary-foreground disabled:opacity-50">{loading ? "Searching…" : "Retrieve"}</button></div>
      {message && <p className="mt-3 text-sm text-muted-foreground">{message}</p>}
    </section>
    <section className="space-y-3"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Results</h2><span className="text-xs text-muted-foreground">Production knowledge only</span></div>
      {results.length === 0 ? <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">No retrieval results yet.</div> : results.map((result) => <article key={`${result.rank}-${result.provenance.version}`} className="rounded-2xl border bg-card p-5"><div className="flex items-center justify-between gap-4"><h3 className="font-medium">{result.rank}. {result.title}</h3><span className="text-xs text-muted-foreground">score {result.finalScore.toFixed(3)}</span></div><p className="mt-2 text-sm leading-6">{result.snippet}</p><p className="mt-3 text-xs text-muted-foreground">Version {String(result.provenance.version ?? "—")} · {String(result.provenance.source ?? "production-knowledge")}</p></article>)}
    </section>
    <section className="rounded-2xl border bg-card p-5"><div className="flex items-center justify-between"><div><h2 className="font-semibold">Index rebuilds</h2><p className="text-sm text-muted-foreground">Production knowledge changes automatically create durable rebuild jobs.</p></div><button type="button" onClick={() => void refreshJobs()} className="rounded-xl border px-4 py-2 text-sm">Refresh</button></div><p className="mt-4 text-sm text-muted-foreground">{jobs.length ? `${jobs.length} recent job${jobs.length === 1 ? "" : "s"}.` : "No jobs loaded."}</p></section>
  </main>;
}
