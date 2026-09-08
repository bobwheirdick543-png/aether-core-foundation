import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, Panel, Tag, EmptyState } from "@/components/common/Primitives";
import { Button } from "@/components/ui/button";
import { getMyNotifications, markNotificationRead } from "@/lib/workspace/workspace.functions";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Aether" },
      { name: "description", content: "In-app notifications for your account." },
      { property: "og:title", content: "Notifications — Aether" },
      { property: "og:description", content: "In-app notifications for your account." },
    ],
  }),
  component: Page,
});

function Page() {
  const queryClient = useQueryClient();
  const load = useServerFn(getMyNotifications);
  const markRead = useServerFn(markNotificationRead);
  const { data, isLoading } = useQuery({
    queryKey: ["my-notifications"],
    queryFn: () => load({}),
  });

  async function onMarkRead(id: string) {
    await markRead({ data: { id } });
    queryClient.invalidateQueries({ queryKey: ["my-notifications"] });
  }

  return (
    <AppShell>
      <div className="animate-in-up space-y-6">
        <PageHeader
          title="Notifications"
          description="Events that belong to your account only. Nothing is invented for empty inboxes."
          backFallback="/dashboard"
        />

        {isLoading ? (
          <Panel>
            <p className="text-sm text-muted-foreground">Loading notifications…</p>
          </Panel>
        ) : (data?.length ?? 0) === 0 ? (
          <EmptyState
            title="No notifications"
            description="When tasks or research runs produce real events for you, they will appear here."
            icon={<Bell className="h-5 w-5" />}
          />
        ) : (
          <div className="space-y-2">
            {data!.map((n) => (
              <Panel key={n.id} className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-medium">{n.title}</h3>
                      <Tag tone={n.status === "read" ? "neutral" : "primary"}>{n.status}</Tag>
                    </div>
                    {n.body ? (
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{n.body}</p>
                    ) : null}
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {n.event_type} · {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    {n.link ? (
                      <Button asChild size="sm" variant="outline">
                        <Link to={n.link}>{n.link.replace(/^\//, "") || "Open"}</Link>
                      </Button>
                    ) : null}
                    {n.status !== "read" ? (
                      <Button type="button" size="sm" variant="ghost" onClick={() => onMarkRead(n.id)}>
                        Mark read
                      </Button>
                    ) : null}
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
