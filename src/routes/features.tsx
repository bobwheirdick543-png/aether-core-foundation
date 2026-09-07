import { createFileRoute } from "@tanstack/react-router";
import { MessagesSquare, Boxes, Bot, Brain, Library, Globe2, FolderKanban, KeyRound } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/layout/SiteChrome";
import { Section, FeatureCard, FlowList } from "@/components/marketing/Sections";
import { ORCHESTRATOR_PIPELINE } from "@/lib/aether/orchestrator";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "Features — Aether AI Platform" },
      {
        name: "description",
        content:
          "Chat, models, agents, memory, knowledge, research, projects and a developer API — the capability map of the Aether platform.",
      },
      { property: "og:title", content: "Features — Aether AI Platform" },
      {
        property: "og:description",
        content: "The capability map of the Aether AI platform, from model roles to scoped API access.",
      },
    ],
  }),
  component: FeaturesPage,
});

const FEATURES = [
  { title: "AI Chat", description: "Model, project, memory and research controls in one composer.", icon: MessagesSquare },
  { title: "AI Models", description: "Six product-level roles behind a provider-agnostic router.", icon: Boxes },
  { title: "AI Agents", description: "Permission-bounded agents managed by the platform owner.", icon: Bot },
  { title: "Memory", description: "Separate user memory and project memory scopes.", icon: Brain },
  { title: "Knowledge", description: "Sandbox, verified, approved and production stages.", icon: Library },
  { title: "Web Research", description: "Long-running research runs with source tracking.", icon: Globe2 },
  { title: "Projects", description: "Projects and modules with their own context and settings.", icon: FolderKanban },
  { title: "Developer API", description: "Scoped keys, rate limits and usage metering.", icon: KeyRound },
];

function FeaturesPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <Section
        eyebrow="Capabilities"
        title="What Aether is being built to do"
        description="This build ships the architecture and interface. Platform intelligence arrives in later phases."
        className="border-t-0"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <FeatureCard key={f.title} {...f} />
          ))}
        </div>
      </Section>

      <Section
        eyebrow="Request path"
        title="The cognitive orchestrator"
        description="Every request will pass through a fixed, inspectable pipeline."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {ORCHESTRATOR_PIPELINE.map((stage, i) => (
            <div key={stage.key} className="panel p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] text-primary">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  {stage.implemented ? "Ready" : "Planned"}
                </span>
              </div>
              <p className="mt-2 text-sm font-medium">{stage.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{stage.description}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section eyebrow="Roadmap" title="Delivery phases">
        <FlowList
          items={[
            "Phase 1 — Foundation: architecture, auth, dashboards, UI",
            "Phase 2-4 — Real chat, persistent memory, model router",
            "Phase 5-6 — Web search, RAG, cognitive orchestrator",
            "Phase 7-9 — Research verification, background tasks, knowledge approval",
            "Phase 10-11 — Aether API and the first module",
            "Phase 12-13 — External integrations and further modules",
          ]}
        />
      </Section>
      <SiteFooter />
    </div>
  );
}
