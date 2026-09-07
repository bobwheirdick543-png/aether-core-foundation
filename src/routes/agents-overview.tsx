import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/layout/SiteChrome";
import { Section } from "@/components/marketing/Sections";
import { Tag } from "@/components/common/Primitives";
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
        eyebrow="Agents"
        title="Specialised, supervised, permission-bounded"
        description="Agent management lives in the private admin console. This is the public architecture view."
        className="border-t-0"
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {AGENTS.map((a) => (
            <div key={a.key} className="panel p-5">
              <h3 className="text-sm font-semibold">{a.name}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{a.purpose}</p>
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
            </div>
          ))}
        </div>
      </Section>
      <SiteFooter />
    </div>
  );
}
