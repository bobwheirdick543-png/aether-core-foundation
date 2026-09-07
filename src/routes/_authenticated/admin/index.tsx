import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/layout/AdminShell";
import { PageHeader, StatCard, PhaseNote, Panel, Tag } from "@/components/common/Primitives";
import { MOCK_ADMIN_STATS, MOCK_AUDIT_LOG } from "@/lib/aether/mock";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Admin — Aether" },
      { name: "description", content: "Aether platform control center." },
      { property: "og:title", content: "Admin — Aether" },
      { property: "og:description", content: "Aether platform control center." },
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
          title="Overview"
          description="Platform-level health, usage and activity at a glance."
        />

        <PhaseNote>
          Admin overview — live metrics connect as backend services come online. Counts below are placeholders.
        </PhaseNote>

        {/* Stats grid */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {MOCK_ADMIN_STATS.map((s) => (
            <StatCard key={s.label} label={s.label} value={s.value} hint={s.hint} />
          ))}
        </div>

        {/* System status + recent audit */}
        <div className="grid gap-6 lg:grid-cols-2">
          <section>
            <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              System status
            </h2>
            <Panel className="space-y-3">
              {[
                { label: "API gateway", status: "operational" as const },
                { label: "Auth service", status: "operational" as const },
                { label: "Model router", status: "planned" as const },
                { label: "Research workers", status: "planned" as const },
                { label: "Knowledge pipeline", status: "planned" as const },
              ].map((s) => (
                <div key={s.label} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{s.label}</span>
                  <Tag tone={s.status === "operational" ? "success" : "neutral"}>{s.status}</Tag>
                </div>
              ))}
            </Panel>
          </section>

          <section>
            <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Recent audit log
            </h2>
            <Panel className="space-y-0 p-0">
              {MOCK_AUDIT_LOG.map((l, i) => (
                <div
                  key={l.id}
                  className={`flex items-start gap-3 px-5 py-3 text-xs ${i < MOCK_AUDIT_LOG.length - 1 ? "border-b border-border/50" : ""}`}
                >
                  <span className="shrink-0 font-mono text-muted-foreground">{l.time}</span>
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">{l.action}</span>
                    <span className="text-muted-foreground"> · {l.actor}</span>
                    <p className="mt-0.5 text-muted-foreground">{l.target}</p>
                  </div>
                  <Tag tone={l.level === "warn" ? "warning" : "neutral"}>{l.level}</Tag>
                </div>
              ))}
            </Panel>
          </section>
        </div>
      </div>
    </AdminShell>
  );
}
