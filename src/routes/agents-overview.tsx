import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/layout/SiteChrome";
import { Section } from "@/components/marketing/Sections";
import { Tag } from "@/components/common/Primitives";
import { Button } from "@/components/ui/button";
import { AGENTS } from "@/lib/aether/agents";

export const Route = createFileRoute("/agents-overview")({
  head: () => ({
    meta: [
      { title: "Agents — Aether AI Platform" },
      {
        name: "description",
        content:
          "Research, verification, curation, reporting and module agents — each bounded by an explicit permission model.",
      },
      { property: "og:title", content: "Agents — Aether AI Platform" },
      {
        property: "og:description",
        content: "Aether agents are bounded by an explicit permission model with human approval gates.",
      },
    ],
  }),
  component: AgentsOverview,
});

function AgentsOverview() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <Section
        eyebrow="Agents · Phase M"
        title="Specialised, supervised, permission-bounded"
        description="Each agent has a mission, tools and an explicit permission model. Runtime execution is durable and server-side. Management and independent workstations live in the private admin console."
        className="border-t-0"
      >
        <div className="mb-6 rounded-xl border border-border/70 bg-surface/40 p-4 text-sm text-muted-foreground">
          Agents cannot grant themselves roles. Production knowledge publish requires explicit approval. Live work
          visibility (Part 9B) shows current agent and stage from real execution events only.
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {AGENTS.map((a) => (
            <div key={a.key} className="panel p-5">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-semibold">{a.name}</h3>
                <Tag tone={a.status === "enabled" ? "success" : "neutral"}>{a.status}</Tag>
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">{a.purpose}</p>
              {a.tools?.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Tools</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {a.tools.map((t) => (
                      <span
                        key={t}
                        className="rounded-md border bg-elevated/50 px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {a.permissions.length > 0 && (
                <ul className="mt-4 space-y-1.5">
                  {a.permissions.map((p) => (
                    <li key={p.permission} className="flex items-center gap-2 text-xs">
                      <Tag tone={p.allowed ? (p.requiresApproval ? "warning" : "success") : "danger"}>
                        {p.allowed ? (p.requiresApproval ? "approval" : "allowed") : "denied"}
                      </Tag>
                      <span className="text-muted-foreground">{p.label}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link to="/login" search={{ redirect: "/admin/team" }}>
              Admin Team workstations
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <Link to="/docs">Documentation</Link>
          </Button>
        </div>
      </Section>
      <SiteFooter />
    </div>
  );
}
