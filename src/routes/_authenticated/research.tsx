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
import { createMyResearchRun, getMyResearchRuns } from "@/lib/workspace/research.functions";

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
  const { data, isLoading } = useQuery({
    queryKey: ["my-research-runs"],
    queryFn: () => load({}),
  });

  const [topic, setTopic] = useState("");
  const [depth, setDepth] = useState("basic");
  const [busy, setBusy] = useState(false);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await create({ data: { topic, depth, durationMinutes: 5 } });
      if (result.ok) {
        toast.success("Research run queued. No findings until a worker executes.");
        setTopic("");
        queryClient.invalidateQueries({ queryKey: ["my-research-runs"] });
        queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
        queryClient.invalidateQueries({ queryKey: ["my-notifications"] });
      } else toast.error(result.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create research run.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="animate-in-up space-y-6">
        <PageHeader
          title="Research"
          description="Queue research work. Sources and findings only appear from real worker execution — never invented in the UI."
          backFallback="/dashboard"
        />

        <Panel>
          <form onSubmit={onCreate} className="space-y-4">
            <h2 className="text-sm font-semibold">New research run</h2>
            <p className="text-xs text-muted-foreground">
              Creates a real <span className="font-mono">research_runs</span> row in status{" "}
              <span className="font-mono">queued</span>, plus a linked task when possible.
            </p>
            <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto]">
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
              <div className="space-y-1.5">
                <Label htmlFor="depth">Depth</Label>
                <Input id="depth" value={depth} onChange={(e) => setDepth(e.target.value)} />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={busy} className="w-full sm:w-auto">
                  {busy ? "Queuing…" : "Queue research"}
                </Button>
              </div>
            </div>
          </form>
        </Panel>

        {isLoading ? (
          <Panel>
            <p className="text-sm text-muted-foreground">Loading research runs…</p>
          </Panel>
        ) : (data?.length ?? 0) === 0 ? (
          <EmptyState
            title="No research runs yet"
            description="Queue a topic above. Source and finding counts stay at zero until a research worker runs."
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
                      {r.depth} · {r.duration_minutes} min · created{" "}
                      {new Date(r.created_at).toLocaleString()}
                    </p>
                  </div>
                  <Tag tone={TONE[r.status] ?? "neutral"}>{r.status}</Tag>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>Sources: {r.sourceCount}</span>
                  <span>Findings: {r.findingCount}</span>
                  {r.sourceCount === 0 && r.findingCount === 0 ? (
                    <span>Waiting for worker execution</span>
                  ) : null}
                </div>
              </Panel>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
