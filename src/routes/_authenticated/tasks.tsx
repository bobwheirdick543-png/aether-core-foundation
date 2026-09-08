import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ListChecks } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, Panel, Tag, EmptyState } from "@/components/common/Primitives";
import { getMyTasks } from "@/lib/workspace/workspace.functions";

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
  succeeded: "success",
  failed: "warning",
  running: "primary",
  queued: "neutral",
  cancelled: "neutral",
};

function Page() {
  const fetchTasks = useServerFn(getMyTasks);
  const { data, isLoading } = useQuery({ queryKey: ["my-tasks"], queryFn: () => fetchTasks({}) });

  return (
    <AppShell>
      <div className="animate-in-up space-y-6">
        <PageHeader
          title="Tasks"
          description="Long-running work continues on the server, even when you close this window."
        />
        {isLoading ? (
          <Panel>
            <p className="text-sm text-muted-foreground">Loading your tasks…</p>
          </Panel>
        ) : (data?.length ?? 0) === 0 ? (
          <EmptyState
            title="No tasks yet"
            description="Work you start — research, reports, knowledge jobs — will show up here with its full run history."
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
                      {t.kind} · started {new Date(t.created_at).toLocaleString()}
                    </p>
                  </div>
                  <Tag tone={TONE[t.status] ?? "neutral"}>{t.status}</Tag>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${t.progress}%` }} />
                </div>
                {t.runs.length > 0 ? (
                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    {t.runs.map((r) => (
                      <div key={r.id} className="flex items-center justify-between gap-3">
                        <span>Attempt {r.attempt}</span>
                        <span>{r.error ?? r.status}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </Panel>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
