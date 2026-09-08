import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  MessagesSquare,
  Telescope,
  FolderKanban,
  Library,
  FileText,
  ListChecks,
} from "lucide-react";
import { AppShell, QuickAction } from "@/components/layout/AppShell";
import { PageHeader, Panel, Tag, EmptyState } from "@/components/common/Primitives";
import { getWorkspaceSummary } from "@/lib/workspace/workspace.functions";
import { useSession } from "@/hooks/useSession";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Aether" },
      { name: "description", content: "Your Aether workspace at a glance." },
      { property: "og:title", content: "Dashboard — Aether" },
      { property: "og:description", content: "Your Aether workspace at a glance." },
    ],
  }),
  component: Page,
});

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function Section({
  title,
  to,
  children,
}: {
  title: string;
  to: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {title}
        </h2>
        <Link to={to} className="text-xs text-primary hover:underline">
          View all
        </Link>
      </div>
      {children}
    </section>
  );
}

function Page() {
  const { user } = useSession();
  const fetchSummary = useServerFn(getWorkspaceSummary);
  const { data, isLoading } = useQuery({
    queryKey: ["workspace-summary"],
    queryFn: () => fetchSummary({}),
  });

  const name =
    (user?.user_metadata?.['display_name'] as string | undefined) ||
    user?.email?.split("@")[0] ||
    "there";

  const empty = (label: string, description: string, icon: React.ReactNode) => (
    <EmptyState title={label} description={description} icon={icon} />
  );

  return (
    <AppShell>
      <div className="animate-in-up space-y-8">
        <PageHeader
          eyebrow={greeting()}
          title={name}
          description="Everything you have running inside Aether."
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickAction to="/chat" icon={MessagesSquare} label="New conversation" description="Ask Aether anything" />
          <QuickAction to="/research" icon={Telescope} label="Start research" description="Investigate a topic in depth" />
          <QuickAction to="/projects" icon={FolderKanban} label="Open projects" description="Your workspaces and modules" />
          <QuickAction to="/knowledge" icon={Library} label="Knowledge base" description="Verified, approved knowledge" />
        </div>

        {isLoading ? (
          <Panel>
            <p className="text-sm text-muted-foreground">Loading your workspace…</p>
          </Panel>
        ) : (
          <div className="grid gap-8 lg:grid-cols-2">
            <Section title="Conversations" to="/chat">
              {(data?.conversations.length ?? 0) === 0 ? (
                empty(
                  "No conversations yet",
                  "Start a conversation to see it here.",
                  <MessagesSquare className="h-5 w-5" />,
                )
              ) : (
                <Panel className="space-y-0 p-0">
                  {data!.conversations.map((c, i) => (
                    <div
                      key={c.id}
                      className={`px-5 py-3 text-sm ${i < data!.conversations.length - 1 ? "border-b border-border/50" : ""}`}
                    >
                      <p className="truncate font-medium">{c.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.model_role} · {new Date(c.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </Panel>
              )}
            </Section>

            <Section title="Tasks" to="/tasks">
              {(data?.tasks.length ?? 0) === 0 ? (
                empty(
                  "No background work",
                  "Tasks you start will keep running on the server.",
                  <ListChecks className="h-5 w-5" />,
                )
              ) : (
                <Panel className="space-y-0 p-0">
                  {data!.tasks.map((t, i) => (
                    <div
                      key={t.id}
                      className={`flex items-center justify-between gap-3 px-5 py-3 text-sm ${i < data!.tasks.length - 1 ? "border-b border-border/50" : ""}`}
                    >
                      <span className="truncate">{t.title}</span>
                      <Tag tone={t.status === "failed" ? "warning" : "neutral"}>{t.status}</Tag>
                    </div>
                  ))}
                </Panel>
              )}
            </Section>

            <Section title="Projects" to="/projects">
              {(data?.projects.length ?? 0) === 0 ? (
                empty(
                  "No projects yet",
                  "Projects group conversations, knowledge and reports together.",
                  <FolderKanban className="h-5 w-5" />,
                )
              ) : (
                <Panel className="space-y-0 p-0">
                  {data!.projects.map((p, i) => (
                    <div
                      key={p.id}
                      className={`px-5 py-3 text-sm ${i < data!.projects.length - 1 ? "border-b border-border/50" : ""}`}
                    >
                      <p className="truncate font-medium">{p.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {p.description ?? p.project_type}
                      </p>
                    </div>
                  ))}
                </Panel>
              )}
            </Section>

            <Section title="Reports" to="/reports">
              {(data?.reports.length ?? 0) === 0 ? (
                empty(
                  "No reports yet",
                  "Completed research produces reports you can download.",
                  <FileText className="h-5 w-5" />,
                )
              ) : (
                <Panel className="space-y-0 p-0">
                  {data!.reports.map((r, i) => (
                    <div
                      key={r.id}
                      className={`flex items-center justify-between gap-3 px-5 py-3 text-sm ${i < data!.reports.length - 1 ? "border-b border-border/50" : ""}`}
                    >
                      <span className="truncate">{r.title}</span>
                      <Tag tone="neutral">{r.approval_status}</Tag>
                    </div>
                  ))}
                </Panel>
              )}
            </Section>
          </div>
        )}
      </div>
    </AppShell>
  );
}
