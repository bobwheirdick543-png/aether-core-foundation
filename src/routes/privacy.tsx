import { createFileRoute } from "@tanstack/react-router";
import { InfoPage } from "@/components/marketing/InfoPage";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy — Aether AI Platform" },
      { name: "description", content: "How Aether handles accounts, conversations, knowledge and secrets." },
      { property: "og:title", content: "Privacy — Aether AI Platform" },
      { property: "og:description", content: "How Aether handles accounts, conversations, knowledge and secrets." },
    ],
  }),
  component: () => (
    <InfoPage
      eyebrow="Legal"
      title="Privacy"
      description="Placeholder policy for the foundation build. Replace this text before any public launch."
    >
      <div className="panel space-y-3 p-6 text-sm leading-relaxed text-muted-foreground">
        <p>Accounts, profiles, conversations, knowledge and API keys are stored per user and readable only by that user and the platform owner.</p>
        <p>Secrets — administrator credentials and provider keys — are held server-side and never sent to the browser.</p>
        <p>Full API keys are never stored; only a hash and a short prefix are retained.</p>
      </div>
    </InfoPage>
  ),
});
