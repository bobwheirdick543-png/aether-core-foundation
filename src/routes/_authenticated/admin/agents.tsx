import { createFileRoute } from "@tanstack/react-router";
import { Settings2, Activity, ListChecks } from "lucide-react";
import { AdminShell } from "@/components/layout/AdminShell";
import { PageHeader, Tag, PhaseNote, StatusDot } from "@/components/common/Primitives";
import { Button } from "@/components/ui/button";
import { AGENTS } from "@/lib/aether/agents";

export const Route = createFileRoute("/_authenticated/admin/agents")({
  head: () => ({
    meta: [
      { title: "AI agents — Aether" },
      { name: "description", content: "Agent definitions and permissions." },
      { property: "og:title", content: "AI agents — Aether" },
      { property: "og:description", content: "Agent definitions and permissions." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <AdminShell>
      <div className="animate-in-up space-y-6">
        <PageHeader
          eyebrow="Control plane"
          title="AI Agents"
          description="Platform agents with explicit permissions. No autonomous execution in this foundation build."
        />

        <PhaseNote>
          Agent management interface — execution, scheduling and tool wiring land in later phases.
        </PhaseNote>

        <div className="grid gap-4 lg:grid-cols-2">
          {AGENTS.map((agent) => (
            <div
              key={agent.key}
              className="panel group overflow-hidden transition-all duration-200 hover:border-admin/40"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
                <div>
                  <h3 className="text-sm font-semibold tracking-tight">{agent.name}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">{agent.purpose}</p>
                </div>
                <StatusDot
                  status={agent.status === "enabled" ? "online" : agent.status === "maintenance" ? "maintenance" : "offline"}
                  label={agent.status}
                />
              </div>

              {/* Body */}
              <div className="space-y-4 px-5 py-4">
                <p className="text-sm leading-relaxed text-muted-foreground">{agent.description}</p>

                {/* Tools */}
                <div>
                  <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Tools
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {agent.tools.map((t) => (
                      <span
                        key={t}
                        className="rounded-md border border-border/60 bg-elevated/50 px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Permissions */}
                <div>
                  <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Permissions
                  </p>
                  <div className="space-y-1">
                    {agent.permissions.map((p) => (
                      <div key={p.permission} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-muted-foreground">{p.label}</span>
                        <Tag tone={p.allowed ? (p.requiresApproval ? "warning" : "success") : "neutral"}>
                          {p.allowed
                            ? p.requiresApproval
                              ? "approval required"
                              : "allowed"
                            : "denied"}
                        </Tag>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Meta */}
                <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Activity className="h-3 w-3" />
                    {agent.lastActivity}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <ListChecks className="h-3 w-3" />
                    {agent.openTasks} open tasks
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 border-t border-border/60 px-5 py-3">
                <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
                  <Settings2 className="h-3 w-3" />
                  Configure
                </Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs">
                  View activity
                </Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs">
                  View tasks
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
