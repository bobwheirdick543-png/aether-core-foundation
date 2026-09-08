import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell } from "@/components/layout/AdminShell";
import { PageHeader, Panel, Tag } from "@/components/common/Primitives";
import { getAdminUsers } from "@/lib/admin/console.functions";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({
    meta: [
      { title: "Users — Aether" },
      { name: "description", content: "All accounts and their roles." },
      { property: "og:title", content: "Users — Aether" },
      { property: "og:description", content: "All accounts and their roles." },
    ],
  }),
  component: Page,
});

function Page() {
  const fetchUsers = useServerFn(getAdminUsers);
  const { data, isLoading } = useQuery({ queryKey: ["admin-users"], queryFn: () => fetchUsers({}) });

  return (
    <AdminShell>
      <div className="animate-in-up space-y-6">
        <PageHeader title="Users" description="Every account on the platform and the roles it holds." />
        <Panel className="space-y-0 p-0">
          {isLoading ? (
            <p className="px-5 py-4 text-sm text-muted-foreground">Loading accounts…</p>
          ) : (data?.length ?? 0) === 0 ? (
            <p className="px-5 py-4 text-sm text-muted-foreground">No accounts yet.</p>
          ) : (
            data!.map((u, i) => (
              <div
                key={u.id}
                className={`flex flex-wrap items-center gap-3 px-5 py-3 text-sm ${
                  i < data!.length - 1 ? "border-b border-border/50" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{u.displayName ?? u.email ?? u.id}</p>
                  <p className="truncate text-xs text-muted-foreground">{u.email ?? "—"}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {u.roles.length === 0 ? (
                    <Tag tone="neutral">user</Tag>
                  ) : (
                    u.roles.map((r) => (
                      <Tag key={r} tone={r === "admin" ? "warning" : "primary"}>
                        {r}
                      </Tag>
                    ))
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {u.lastSignInAt ? `Last seen ${new Date(u.lastSignInAt).toLocaleDateString()}` : "Never signed in"}
                </span>
              </div>
            ))
          )}
        </Panel>
      </div>
    </AdminShell>
  );
}
