import { createFileRoute } from "@tanstack/react-router";
import { InfoPage } from "@/components/marketing/InfoPage";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms — Aether AI Platform" },
      { name: "description", content: "Terms of use for the Aether AI platform foundation build." },
      { property: "og:title", content: "Terms — Aether AI Platform" },
      { property: "og:description", content: "Terms of use for the Aether AI platform foundation build." },
    ],
  }),
  component: () => (
    <InfoPage
      eyebrow="Legal"
      title="Terms"
      description="Placeholder terms for the foundation build. Replace this text before any public launch."
    >
      <div className="panel space-y-3 p-6 text-sm leading-relaxed text-muted-foreground">
        <p>Aether is under active development. Platform intelligence, agents and the developer API are not yet operational.</p>
        <p>Accounts are provided as-is during the foundation phase and data may be reset while the schema evolves.</p>
      </div>
    </InfoPage>
  ),
});
