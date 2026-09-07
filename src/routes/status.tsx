import { createFileRoute } from "@tanstack/react-router";
import { InfoPage } from "@/components/marketing/InfoPage";
import { Tag } from "@/components/common/Primitives";

const SERVICES = [
  { name: "Interface", state: "operational" as const },
  { name: "Authentication", state: "operational" as const },
  { name: "Database", state: "operational" as const },
  { name: "Model router", state: "planned" as const },
  { name: "Research workers", state: "planned" as const },
  { name: "Aether API", state: "planned" as const },
];

export const Route = createFileRoute("/status")({
  head: () => ({
    meta: [
      { title: "Status — Aether AI Platform" },
      { name: "description", content: "Current operational state of Aether platform services." },
      { property: "og:title", content: "Status — Aether AI Platform" },
      { property: "og:description", content: "Current operational state of Aether platform services." },
    ],
  }),
  component: () => (
    <InfoPage
      eyebrow="Status"
      title="Service status"
      description="Live services versus components still being built."
    >
      <div className="panel divide-y divide-border">
        {SERVICES.map((s) => (
          <div key={s.name} className="flex items-center justify-between px-5 py-4 text-sm">
            <span>{s.name}</span>
            <Tag tone={s.state === "operational" ? "success" : "neutral"}>{s.state}</Tag>
          </div>
        ))}
      </div>
    </InfoPage>
  ),
});
