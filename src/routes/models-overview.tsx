import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/layout/SiteChrome";
import { Section } from "@/components/marketing/Sections";
import { Tag } from "@/components/common/Primitives";
import { MODEL_ROLES, formatContext } from "@/lib/aether/models";

export const Route = createFileRoute("/models-overview")({
  head: () => ({
    meta: [
      { title: "Model roles — Aether AI Platform" },
      {
        name: "description",
        content:
          "Aether Fast, Think, Code, Vision, Long and Translate: product-level model roles resolved by the Aether model router.",
      },
      { property: "og:title", content: "Model roles — Aether AI Platform" },
      {
        property: "og:description",
        content: "Six product-level model roles, resolved to real providers by the Aether model router.",
      },
    ],
  }),
  component: ModelsOverview,
});

function ModelsOverview() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <Section
        eyebrow="Models"
        title="Six roles, one routing layer"
        description="A role describes intent. The router maps that intent to whichever provider or local model is best at the time."
        className="border-t-0"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODEL_ROLES.map((m) => (
            <div key={m.key} className="panel flex h-full flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-semibold">{m.name}</h3>
                <Tag>{m.status}</Tag>
              </div>
              <p className="mt-2 flex-1 text-sm text-muted-foreground">{m.description}</p>
              <ul className="mt-4 flex flex-wrap gap-1.5">
                {m.capabilities.map((c) => (
                  <li key={c}>
                    <Tag tone="primary">{c}</Tag>
                  </li>
                ))}
              </ul>
              <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                {formatContext(m.contextWindow)} · {m.speed}
              </p>
            </div>
          ))}
        </div>
      </Section>
      <SiteFooter />
    </div>
  );
}
