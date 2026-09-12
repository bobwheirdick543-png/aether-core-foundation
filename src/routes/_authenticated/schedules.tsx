import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, Panel, EmptyState, Tag } from "@/components/common/Primitives";
import { Button } from "@/components/ui/button";
import { listSchedules, updateSchedule, deleteSchedule } from "@/lib/aether/scheduler.functions";

export const Route = createFileRoute("/_authenticated/schedules")({
  head: () => ({
    meta: [
      { title: "Schedules — Aether" },
      { name: "description", content: "Persistent background schedules and durable run state." },
    ],
  }),
  component: Page,
});

function Page() {
  const qc = useQueryClient();
  const load = useServerFn(listSchedules);
  const update = useServerFn(updateSchedule);
  const remove = useServerFn(deleteSchedule);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["schedules"],
    queryFn: async () => {
      try {
        return await load({});
      } catch (e) {
        console.error("[schedules]", e);
        return [];
      }
    },
    retry: 1,
  });

  const toggle = async (id: string, enabled: boolean) => {
    try {
      await update({ data: { id, enabled } });
      await qc.invalidateQueries({ queryKey: ["schedules"] });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not update schedule");
    }
  };

  const del = async (id: string) => {
    try {
      await remove({ data: { id } });
      await qc.invalidateQueries({ queryKey: ["schedules"] });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not delete schedule");
    }
  };

  return (
    <AppShell>
      <div className="animate-in-up space-y-6">
        <PageHeader
          title="Schedules"
          description="Persistent schedules survive browser closure, restarts and worker handoffs."
          backFallback="/dashboard"
        />
        {isError && (
          <Panel>
            <p className="text-sm text-destructive">Schedules could not be fully loaded.</p>
            <p className="mt-1 text-xs text-muted-foreground">The page stays open; data appears when the backend is ready.</p>
          </Panel>
        )}
        {isLoading ? (
          <Panel>
            <p className="text-sm text-muted-foreground">Loading schedules…</p>
          </Panel>
        ) : (data?.length ?? 0) === 0 ? (
          <EmptyState
            title="No schedules"
            description="Create schedules through the Aether scheduling API. Their definitions and runs are stored durably."
            icon={<CalendarClock className="h-5 w-5" />}
          />
        ) : (
          <div className="space-y-2">
            {data!.map((s: any) => (
              <Panel key={s.id} className="space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{s.name}</h3>
                      <Tag tone={s.enabled ? "primary" : "neutral"}>
                        {s.enabled ? "enabled" : "paused"}
                      </Tag>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {s.schedule_kind} · {s.schedule_expression} · {s.timezone}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Next: {s.next_run_at ? new Date(s.next_run_at).toLocaleString() : "not scheduled"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => void toggle(s.id, !s.enabled)}>
                      {s.enabled ? "Pause" : "Resume"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void del(s.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
              </Panel>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
