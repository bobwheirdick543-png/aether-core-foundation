import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Telescope } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, Panel, Tag, EmptyState } from "@/components/common/Primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VerificationPanel } from "@/components/research/VerificationPanel";
import {
  createMyResearchRun,
  getMyResearchRuns,
  processResearchSeedUrl,
} from "@/lib/workspace/research.functions";

export const Route = createFileRoute("/_authenticated/research")({
  head: () => ({
    meta: [
      { title: "Research — Aether" },
      { name: "description", content: "Web research runs and their sources." },
      { property: "og:title", content: "Research — Aether" },
      { property: "og:description", content: "Web research runs and their sources." },
    ],
  }),
  component: Page,
});

const TONE: Record<string, "success" | "warning" | "primary" | "neutral"> = {
  completed: "success",
  failed: "warning",
  running: "primary",
  queued: "neutral",
  cancelled: "neutral",
  waiting_approval: "warning",
};

function Page() {
  const queryClient = useQueryClient();
  const load = useServerFn(getMyResearchRuns);
  const create = useServerFn(createMyResearchRun);
  const processUrl = useServerFn(processResearchSeedUrl);
  const { data, isLoading } = useQuery({
    queryKey: ["my-research-runs"],
    queryFn: () => load({}),
  });

  const [topic, setTopic] = useState("");
  const [depth, setDepth] = useState("basic");
  const [seedUrl, setSeedUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [processBusy, setProcessBusy] = useState<string | null>(null);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await create({
        data: { topic, depth, durationMinutes: 5, seedUrl: seedUrl || undefined },
      });
      if (result.ok) {
        toast.success("Research run queued.");
        setTopic("");
        setSeedUrl("");
        queryClient.invalidateQueries({ queryKey: ["my-research-runs"] });
        queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
        queryClient.invalidateQueries({ queryKey: ["my-notifications"] });

        if (seedUrl && result.run?.id) {
          setProcessBusy(result.run.id);
          const processed = await processUrl({ data: { runId: result.run.id, url: seedUrl } });
          setProcessBusy(null);
          if (processed.ok) {
            toast.success("Seed URL retrieved and stored as a source.");
            queryClient.invalidateQueries({ queryKey: ["my-research-runs"] });
          } else toast.error(processed.message);
        }
      } else toast.error(result.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create research run.");
    } finally {
      setBusy(false);
      setProcessBusy(null);
    }
  }

  return (
    <AppShell>
      <div className="animate-in-up space-y-6">
        <PageHeader
          title="Research"
          description="Queue research and optionally retrieve a seed URL with Aether's native fetch/extract engine. No AI findings are invented."
          backFallback="/dashboard"
        />

        <Panel>
          <form onSubmit={onCreate} className="space-y-4">
            <h2 className="text-sm font-semibold">New research run</h2>
            <p className="text-xs text-muted-foreground">
              Creates a real research run. Optional seed URL is fetched server-side (HTML → text) and
              stored as a source with hash + metadata.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="topic">Topic</Label>
              <Input
                id="topic"
                required
                minLength={3}
                maxLength={500}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Battery recycling regulations in the EU"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="depth">Depth</Label>
                <Input id="depth" value={depth} onChange={(e) => setDepth(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="seedUrl">Seed URL (optional)</Label>
                <Input
                  id="seedUrl"
                  type="url"
                  value={seedUrl}
                  onChange={(e) => setSeedUrl(e.target.value)}
                  placeholder="https://…"
                />
              </div>
            </div>
            <Button type="submit" disabled={busy}>
              {busy || processBusy ? "Working…" : "Queue research"}
            </Button>
          </form>
        </Panel>

        {isLoading ? (
          <Panel>
            <p className="text-sm text-muted-foreground">Loading research runs…</p>
          </Panel>
        ) : (data?.length ?? 0) === 0 ? (
          <EmptyState
            title="No research runs yet"
            description="Queue a topic above. Source counts rise only after real retrieval."
            icon={<Telescope className="h-5 w-5" />}
          />
        ) : (
          <div className="space-y-3">
            {data!.map((r) => (
              <Panel key={r.id} className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-medium">{r.topic}</h3>
                    <p className="text-xs text-muted-foreground">
                      {r.depth} · {r.duration_minutes} min · {new Date(r.created_at).toLocaleString()}
                    </p>
                  </div>
                  <Tag tone={TONE[r.status] ?? "neutral"}>{r.status}</Tag>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>Sources: {r.sourceCount}</span>
                  <span>Findings: {r.findingCount}</span>
                  {r.findingCount === 0 ? (
                    <span>No AI findings — verification not run</span>
                  ) : null}
                </div>
              </Panel>
            ))}
          </div>
        )}

        <VerificationPanel />
      </div>
    </AppShell>
  );
}
