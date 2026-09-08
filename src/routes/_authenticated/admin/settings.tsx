import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell } from "@/components/layout/AdminShell";
import { PageHeader, Panel, Tag } from "@/components/common/Primitives";
import { getMyProfile } from "@/lib/auth/profile.functions";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({
    meta: [
      { title: "Admin settings — Aether" },
      { name: "description", content: "Administrator account and platform accountability." },
      { property: "og:title", content: "Admin settings — Aether" },
      { property: "og:description", content: "Administrator account and platform accountability." },
    ],
  }),
  component: Page,
});

function Page() {
  const load = useServerFn(getMyProfile);
  const { data, isLoading } = useQuery({ queryKey: ["my-profile"], queryFn: () => load({}) });

  return (
    <AdminShell>
      <div className="animate-in-up space-y-6">
        <PageHeader
          eyebrow="Control plane"
          title="Admin settings"
          description="Your administrator identity and security posture. Secrets are never displayed."
          backFallback="/admin"
        />

        {isLoading ? (
          <Panel>
            <p className="text-sm text-muted-foreground">Loading…</p>
          </Panel>
        ) : (
          <>
            <Panel className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold">Administrator identity</h2>
                <Tag tone="admin">admin</Tag>
              </div>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Email</dt>
                  <dd className="mt-0.5">{data?.email || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Display name</dt>
                  <dd className="mt-0.5">{data?.profile?.display_name || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Roles</dt>
                  <dd className="mt-0.5">{(data?.roles ?? []).join(", ") || "—"}</dd>
                </div>
              </dl>
              <p className="text-xs text-muted-foreground">
                Profile, avatar and password changes use the same secure account settings as the user
                workspace.{" "}
                <Link to="/settings" className="text-primary hover:underline">
                  Open account settings
                </Link>
              </p>
            </Panel>

            <Panel className="space-y-2">
              <h2 className="text-sm font-semibold">Security notes</h2>
              <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                <li>Bootstrap secrets, service-role keys and raw API secrets are never shown here.</li>
                <li>Administrator role is enforced server-side on every admin route and action.</li>
                <li>Password recovery uses Supabase Auth recovery email links.</li>
                <li>Audit events for admin sessions are recorded in Logs.</li>
              </ul>
            </Panel>

            <Panel className="space-y-2">
              <h2 className="text-sm font-semibold">Platform controls</h2>
              <p className="text-xs text-muted-foreground">
                System configuration, agent enablement and workforce controls live under Team, System
                and related admin sections. Those activate as each backend subsystem is completed —
                this page does not invent platform switches.
              </p>
            </Panel>
          </>
        )}
      </div>
    </AdminShell>
  );
}
