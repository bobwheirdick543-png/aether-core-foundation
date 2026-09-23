import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, Panel, Tag, EmptyState } from "@/components/common/Primitives";
import { Button } from "@/components/ui/button";
import { getMyNotifications, markNotificationRead } from "@/lib/workspace/workspace.functions";
import { Link } from "@tanstack/react-router";
import { getMyProfile } from "@/lib/auth/profile.functions";

function formatNotificationDateTime(timestamp: string, timezone?: string | null) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    ...(timezone ? { timeZone: timezone } : {}),
  }).format(date);
}


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
  const loadProfile = useServerFn(getMyProfile);
  const { data: profileData } = useQuery({ queryKey: ["my-profile"], queryFn: () => loadProfile({}) });
  const { data, isLoading } = useQuery({
    queryKey: ["my-notifications"],
    queryFn: () => load({}),
  });

  const notifications = Array.isArray(data) ? data : Array.isArray((data as any)?.notifications) ? (data as any).notifications : Array.isArray((data as any)?.data) ? (data as any).data : [];

  async function onMarkRead(id: string) {
    const result = await markRead({ data: { id } });
    if (result.ok) {
      window.dispatchEvent(new Event("aether:notification-read"));
      queryClient.invalidateQueries({ queryKey: ["my-notifications"] });
    }
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
        ) : notifications.length === 0 ? (
          <EmptyState
            title="No notifications"
            description="When tasks or research runs produce real events for you, they will appear here."
            icon={<Bell className="h-5 w-5" />}
          />
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => (
              <Panel key={n.id} className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <Link
                    to={n.link || "/dashboard"}
                    onClick={() => void onMarkRead(n.id)}
                    className="min-w-0 flex-1 rounded-md -m-2 p-2 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    aria-label={`Open notification: ${n.title}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-medium">{n.title}</h3>
                      <Tag tone={n.status === "read" ? "neutral" : "primary"}>{n.status}</Tag>
                    </div>
                    {n.body ? (
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{n.body}</p>
                    ) : null}
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {n.event_type} · {formatNotificationDateTime(n.created_at, profileData?.profile?.timezone)}
                    </p>
                    <p className="mt-2 text-[11px] font-medium text-primary">
                      Open related Aether page →
                    </p>
                  </Link>
                  {n.status !== "read" ? (
                    <Button type="button" size="sm" variant="ghost" onClick={() => void onMarkRead(n.id)}>
                      Mark read
                    </Button>
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
