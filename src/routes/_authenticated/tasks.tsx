import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ListChecks } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, Panel, Tag, EmptyState } from "@/components/common/Primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cancelMyTask, createMyTask, getMyTasks } from "@/lib/workspace/workspace.functions";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({
    meta: [
      { title: "Tasks — Aether" },
      { name: "description", content: "Background work running on your behalf." },
      { property: "og:title", content: "Tasks — Aether" },
      { property: "og:description", content: "Background work running on your behalf." },
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
  const fetchTasks = useServerFn(getMyTasks);
  const createTask = useServerFn(createMyTask);
  const cancelTask = useServerFn(cancelMyTask);
  const { data, isLoading } = useQuery({ queryKey: ["my-tasks"], queryFn: () => fetchTasks({}) });

  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("general");
  const [busy, setBusy] = useState(false);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await createTask({ data: { title, kind } });
      if (result.ok) {
        toast.success("Task queued. Execution starts when a worker is available.");
        setTitle("");
        queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
      } else toast.error(result.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create task.");
    } finally {
      setBusy(false);
    }
  }

  async function onCancel(id: string) {
    const result = await cancelTask({ data: { id } });
    if (result.ok) {
      toast.success("Task cancelled.");
      queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
    } else toast.error(result.message);
  }

  return (
    <AppShell>
      <div className="animate-in-up space-y-6">
        <PageHeader
          title="Tasks"
          description="Request work that persists on the server. Runs stay queued until a background worker executes them — nothing is invented in the browser."
          backFallback="/dashboard"
        />

        <Panel>
          <form onSubmit={onCreate} className="space-y-4">
            <h2 className="text-sm font-semibold">Create a task</h2>
            <p className="text-xs text-muted-foreground">
              Creates a real Task and Run #1 in status <span className="font-mono">queued</span>. No
              fake completion or fabricated agent output.
            </p>
            <div className="grid gap-3 sm:grid-cols-[1fr_160px_auto]">
              <div className="space-y-1.5">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  required
                  minLength={2}
                  maxLength={200}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Research competitor pricing"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="kind">Kind</Label>
                <Input
                  id="kind"
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
                  placeholder="general"
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={busy} className="w-full sm:w-auto">
                  {busy ? "Creating…" : "Queue task"}
                </Button>
              </div>
            </div>
          </form>
        </Panel>

        {isLoading ? (
          <Panel>
            <p className="text-sm text-muted-foreground">Loading your tasks…</p>
          </Panel>
        ) : (data?.length ?? 0) === 0 ? (
          <EmptyState
            title="No tasks yet"
            description="Create a task above. It will appear here with run history once queued."
            icon={<ListChecks className="h-5 w-5" />}
          />
        ) : (
          <div className="space-y-3">
            {data!.map((t) => (
              <Panel key={t.id} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-medium">{t.title}</h3>
                    <p className="text-xs text-muted-foreground">
                      {t.kind} · created {new Date(t.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Tag tone={TONE[t.status] ?? "neutral"}>{t.status}</Tag>
                    {t.status === "queued" || t.status === "running" || t.status === "waiting_approval" ? (
                      <Button type="button" variant="ghost" size="sm" onClick={() => onCancel(t.id)}>
                        Cancel
                      </Button>
                    ) : null}
                  </div>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary transition-all" style={{ width: `${t.progress}%` }} />
                </div>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground/80">Runs</p>
                  {t.runs.length === 0 ? (
                    <p>No run records yet.</p>
                  ) : (
                    t.runs.map((r) => (
                      <div key={r.id} className="flex items-center justify-between gap-3 rounded-md border border-border/50 px-2.5 py-1.5">
                        <span>Attempt {r.attempt}</span>
                        <span className="font-mono">{r.error ?? r.status}</span>
                      </div>
                    ))
                  )}
                </div>
              </Panel>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
