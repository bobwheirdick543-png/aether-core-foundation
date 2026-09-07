import { createFileRoute } from "@tanstack/react-router";
import { InfoPage } from "@/components/marketing/InfoPage";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — Aether AI Platform" },
      { name: "description", content: "Reach the Aether platform team." },
      { property: "og:title", content: "Contact — Aether AI Platform" },
      { property: "og:description", content: "Reach the Aether platform team." },
    ],
  }),
  component: () => (
    <InfoPage
      eyebrow="Contact"
      title="Get in touch"
      description="Add your real contact details here — this page currently has no address or form wired up."
    >
      <div className="panel p-6 text-sm text-muted-foreground">
        No contact channel has been configured yet. Send me the email address or form destination you
        want to use and it will be published here.
      </div>
    </InfoPage>
  ),
});
