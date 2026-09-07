import { createFileRoute, Link } from "@tanstack/react-router";
import {
  MessagesSquare,
  Telescope,
  FolderKanban,
  Library,
  FileText,
  ArrowRight,
  Boxes,
} from "lucide-react";
import { AppShell, QuickAction } from "@/components/layout/AppShell";
import { PageHeader, Panel, Tag, PhaseNote } from "@/components/common/Primitives";
import { MOCK_CONVERSATIONS, MOCK_TASKS, MOCK_PROJECTS } from "@/lib/aether/mock";
import { MODEL_ROLES } from "@/lib/aether/models";
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

function Page() {
  const { user } = useSession();
  const name =
    (user?.user_metadata?.display_name as string | undefined) ||
    user?.email?.split("@")[0] ||
    "there";

  return (
    <AppShell>
      <div className="animate-in-up space-y-8">
        {/* Welcome */}
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
            Workspace
          </p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight sm:text-[28px]">
            {greeting()}, {name}.
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            How can Aether help you today?
          </p>
        </div>

        <PhaseNote>
          Interface foundation — data and actions connect as platform phases land.
        </PhaseNote>

        {/* Quick actions */}
        <section>
          <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Start something new
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <QuickAction
              to="/chat"
              label="New Chat"
              description="Start a conversation"
              icon={MessagesSquare}
            />
            <QuickAction
              to="/research"
              label="Research"
              description="Launch a research task"
              icon={Telescope}
            />
            <QuickAction
              to="/projects"
              label="Create Project"
              description="Open a new workspace"
              icon={FolderKanban}
            />
            <QuickAction
              to="/knowledge"
              label="Upload Knowledge"
              description="Add to your knowledge base"
              icon={Library}
            />
            <QuickAction
              to="/reports"
              label="Generate Report"
              description="Turn research into a report"
              icon={FileText}
            />
          </div>
        </section>

        {/* Recent + Tasks */}
        <div className="grid gap-6 lg:grid-cols-2">
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Recent conversations
              </h2>
              <Link
                to="/chat"
                className="inline-flex items-center gap-1 text-xs text-primary transition-colors hover:underline"
              >
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="space-y-2">
              {MOCK_CONVERSATIONS.map((c) => (
                <Link
                  key={c.id}
                  to="/chat"
                  className="panel group flex items-center justify-between gap-3 p-4 transition-colors hover:border-primary/35"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{c.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {c.model} · {c.updated}
                    </p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Active tasks
              </h2>
              <Link
                to="/tasks"
                className="inline-flex items-center gap-1 text-xs text-primary transition-colors hover:underline"
              >
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="space-y-2">
              {MOCK_TASKS.slice(0, 3).map((t) => (
                <div key={t.id} className="panel p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium">{t.title}</p>
                    <Tag
                      tone={
                        t.status === "running"
                          ? "primary"
                          : t.status === "completed"
                            ? "success"
                            : t.status === "failed"
                              ? "danger"
                              : "warning"
                      }
                    >
                      {t.status.replace("_", " ")}
                    </Tag>
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{t.elapsed}</span>
                    <span>·</span>
                    <span>{t.sources} sources</span>
                  </div>
                  {t.status === "running" ? (
                    <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${t.progress}%` }}
                      />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Projects + Models */}
        <div className="grid gap-6 lg:grid-cols-2">
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Projects
              </h2>
              <Link
                to="/projects"
                className="inline-flex items-center gap-1 text-xs text-primary transition-colors hover:underline"
              >
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {MOCK_PROJECTS.slice(0, 4).map((p) => (
                <Link
                  key={p.id}
                  to="/projects"
                  className="panel group p-4 transition-colors hover:border-primary/35"
                >
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="mt-0.5 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                    {p.type}
                  </p>
                  <div className="mt-3 flex gap-3 text-xs text-muted-foreground">
                    <span>{p.conversations} chats</span>
                    <span>{p.knowledge} knowledge</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Available models
              </h2>
              <Link
                to="/models"
                className="inline-flex items-center gap-1 text-xs text-primary transition-colors hover:underline"
              >
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {MODEL_ROLES.slice(0, 4).map((m) => (
                <Link
                  key={m.key}
                  to="/models"
                  className="panel group flex items-start gap-3 p-4 transition-colors hover:border-primary/35"
                >
                  <span className="mt-0.5 rounded-md border border-border bg-elevated p-1.5 text-primary">
                    <Boxes className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <p className="text-sm font-medium">{m.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                      {m.description}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
