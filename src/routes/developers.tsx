import { createFileRoute } from "@tanstack/react-router";
import { InfoPage } from "@/components/marketing/InfoPage";
import { API_SCOPES } from "@/lib/aether/api";
import { Tag } from "@/components/common/Primitives";

export const Route = createFileRoute("/developers")({
  head: () => ({
    meta: [
      { title: "Developers — Aether AI Platform" },
      {
        name: "description",
        content: "Scoped API keys, rate limits and module endpoints for applications built on Aether.",
      },
      { property: "og:title", content: "Developers — Aether AI Platform" },
      {
        property: "og:description",
        content: "Connect external applications to Aether with scoped, revocable API keys.",
      },
    ],
  }),
  component: DevelopersPage,
});

function DevelopersPage() {
  return (
    <InfoPage
      eyebrow="Developers"
      title="Build on Aether"
      description="External applications — including future messaging bots and game modules — will connect through scoped API keys. Key issuing is available in the workspace; request execution ships with the Aether API in a later phase."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-5">
          <h3 className="text-sm font-semibold">Scopes</h3>
          <ul className="mt-4 space-y-2">
            {API_SCOPES.map((s) => (
              <li key={s.scope} className="flex items-center justify-between gap-3 text-sm">
                <code className="font-mono text-xs text-primary">{s.scope}</code>
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="panel p-5">
          <h3 className="text-sm font-semibold">Key handling</h3>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li>Keys are shown once at creation and never again.</li>
            <li>Only a hash and a short prefix are stored.</li>
            <li>Every key carries scopes, a rate limit and an optional expiry.</li>
            <li>Keys can be revoked instantly.</li>
          </ul>
          <div className="mt-5 flex gap-2">
            <Tag tone="primary">REST</Tag>
            <Tag>Webhooks planned</Tag>
            <Tag>Module execution planned</Tag>
          </div>
        </div>
      </div>
    </InfoPage>
  );
}
