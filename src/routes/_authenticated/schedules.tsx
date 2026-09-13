import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, Panel, EmptyState, Tag } from "@/components/common/Primitives";
import { Button } from "@/components/ui/button";
import { createSchedule, listSchedules, updateSchedule, deleteSchedule, runScheduleNow } from "@/lib/aether/scheduler.functions";
import { supabase } from "@/integrations/supabase/client";

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
  const create = useServerFn(createSchedule);
  const update = useServerFn(updateSchedule);
  const remove = useServerFn(deleteSchedule);
  const runNow = useServerFn(runScheduleNow);
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

  const [name, setName] = useState("");
  const [kind, setKind] = useState<"cron" | "interval" | "once">("cron");
  const [expression, setExpression] = useState("0 9 * * *");
  const [timezone, setTimezone] = useState("UTC");
  const [taskType, setTaskType] = useState("general");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFormError("");
    try {
      const { data: auth } = await supabase.auth.getUser();
      const ownerId = auth.user?.id;
      if (!ownerId) throw new Error("Not authenticated");
      await create({
        data: {
          ownerId,
          name: name.trim(),
          kind,
          expression: expression.trim(),
          timezone: timezone.trim() || "UTC",
          taskType: taskType.trim() || "general",
          payload: {},
          enabled: true,
        },
      });
      setName("");
      setExpression(kind === "cron" ? "0 9 * * *" : kind === "interval" ? "3600" : new Date(Date.now() + 3600_000).toISOString());
      await qc.invalidateQueries({ queryKey: ["schedules"] });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not create schedule");
    } finally {
      setBusy(false);
    }
  };

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

  const fire = async (id: string) => {
    try {
      await runNow({ data: { id } });
      alert("Run queued. Execution starts when a worker is available.");
      await qc.invalidateQueries({ queryKey: ["schedules"] });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not queue run");
    }
  };

  return (
    <AppShell>
      <div className="animate-in-up space-y-6">
        <PageHeader
          title="Schedules"
          description="Persistent schedules survive browser closure, restarts and worker handoffs. Create and manage them here."
          backFallback="/dashboard"
        />

        <Panel>
          <form onSubmit={onCreate} className="space-y-4">
            <h2 className="text-sm font-semibold">Create schedule</h2>
            <p className="text-xs text-muted-foreground">
              Definitions and next-run times are stored durably. Firing requires a background worker (Phase L).
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                className="h-9 rounded-md border bg-background px-3 text-sm"
                required
                minLength={2}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Schedule name"
              />
              <select
                className="h-9 rounded-md border bg-background px-3 text-sm"
                value={kind}
                onChange={(e) => {
                  const k = e.target.value as "cron" | "interval" | "once";
                  setKind(k);
                  if (k === "cron") setExpression("0 9 * * *");
                  else if (k === "interval") setExpression("3600");
                  else setExpression(new Date(Date.now() + 3600_000).toISOString());
                }}
              >
                <option value="cron">Cron</option>
                <option value="interval">Interval (seconds)</option>
                <option value="once">Once (ISO time)</option>
              </select>
              <input
                className="h-9 rounded-md border bg-background px-3 text-sm"
                required
                value={expression}
                onChange={(e) => setExpression(e.target.value)}
                placeholder={kind === "cron" ? "0 9 * * *" : kind === "interval" ? "3600" : "ISO datetime"}
              />
              <input
                className="h-9 rounded-md border bg-background px-3 text-sm"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="Timezone (UTC)"
              />
              <input
                className="h-9 rounded-md border bg-background px-3 text-sm sm:col-span-2"
                value={taskType}
                onChange={(e) => setTaskType(e.target.value)}
                placeholder="Task type (e.g. general, research)"
              />
            </div>
            {formError && <p className="text-xs text-destructive">{formError}</p>}
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy ? "Creating…" : "Create schedule"}
            </Button>
          </form>
        </Panel>

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
            title="No schedules yet"
            description="Create one above. Definitions and runs are stored durably on the server."
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
                      <Tag tone={s.enabled ? "primary" : "neutral"}>{s.enabled ? "enabled" : "paused"}</Tag>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {s.schedule_kind} · {s.schedule_expression} · {s.timezone} · {s.task_type}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Next: {s.next_run_at ? new Date(s.next_run_at).toLocaleString() : "not scheduled"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => void fire(s.id)}>
                      Run now
                    </Button>
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
