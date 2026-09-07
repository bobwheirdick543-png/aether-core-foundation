import { createFileRoute, Link } from "@tanstack/react-router";
import {
  MessagesSquare,
  Boxes,
  Bot,
  Brain,
  Library,
  Globe2,
  FolderKanban,
  KeyRound,
  ArrowRight,
} from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/layout/SiteChrome";
import { Section, FeatureCard, FlowList } from "@/components/marketing/Sections";
import { AetherMark } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/common/Primitives";
import { MODEL_ROLES, formatContext } from "@/lib/aether/models";
import { AGENTS } from "@/lib/aether/agents";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Aether — Your AI Platform" },
      {
        name: "description",
        content:
          "One platform for intelligent conversations, research, memory, knowledge, agents, models and applications.",
      },
      { property: "og:title", content: "Aether — Your AI Platform" },
      {
        property: "og:description",
        content:
          "One platform for intelligent conversations, research, memory, knowledge, agents, models and applications.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { title: "AI Chat", description: "A focused conversation surface with model, project and tool controls.", icon: MessagesSquare },
  { title: "AI Models", description: "Product-level model roles routed to providers by a model router.", icon: Boxes },
  { title: "AI Agents", description: "Scoped agents with explicit permissions and human approval gates.", icon: Bot },
  { title: "Memory", description: "User memory and project memory that persist across sessions.", icon: Brain },
  { title: "Knowledge", description: "Collections, sources, confidence, versions and approval status.", icon: Library },
  { title: "Web Research", description: "Multi-source gathering, verification and contradiction detection.", icon: Globe2 },
  { title: "Projects", description: "General-purpose projects and modules, each with their own context.", icon: FolderKanban },
  { title: "Developer API", description: "Scoped API keys so external applications can connect to Aether.", icon: KeyRound },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <section className="relative overflow-hidden">
        <div className="grid-backdrop pointer-events-none absolute inset-0 opacity-60" />
        <div className="aether-glow pointer-events-none absolute inset-0" />
        <div className="relative mx-auto w-full max-w-7xl px-5 py-24 lg:px-8 lg:py-32">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              <AetherMark className="h-3.5 w-3.5 text-primary" />
              Foundation build
            </span>
            <h1 className="mt-6 text-4xl font-semibold text-balance-tight sm:text-6xl">
              Aether — Your AI Platform.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              One platform for intelligent conversations, research, memory, knowledge, agents,
              models, and applications.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/signup">
                  Get Started <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/features">Explore Aether</Link>
              </Button>
            </div>

            <dl className="mt-14 grid max-w-2xl grid-cols-2 gap-6 sm:grid-cols-4">
              {[
                ["6", "Model roles"],
                ["5", "Platform agents"],
                ["4", "Knowledge stages"],
                ["8", "API scopes"],
              ].map(([value, label]) => (
                <div key={label}>
                  <dt className="font-mono text-2xl font-semibold text-primary">{value}</dt>
                  <dd className="mt-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    {label}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <Section
        id="features"
        eyebrow="Platform"
        title="Everything Aether brings together"
        description="Aether is built as a platform with layered services, not a chatbot with features bolted on."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <FeatureCard key={f.title} {...f} />
          ))}
        </div>
      </Section>

      <Section
        id="models"
        eyebrow="Models"
        title="Model roles, not vendor lock-in"
        description="You choose what a request is for. A future model router decides which provider and model actually handles it."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODEL_ROLES.map((m) => (
            <div key={m.key} className="panel p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">{m.name}</h3>
                <Tag tone="primary">{m.speed}</Tag>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{m.description}</p>
              <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                {formatContext(m.contextWindow)}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        eyebrow="Research"
        title="Research that has to earn its place"
        description="Nothing found on the web becomes platform knowledge automatically."
      >
        <FlowList
          items={[
            "Search multiple sources in parallel",
            "Gather candidate information into a sandbox",
            "Verify claims, dates and evidence",
            "Detect contradictions between sources",
            "Generate structured research reports",
            "Require human approval before knowledge goes to production",
          ]}
        />
      </Section>

      <Section
        eyebrow="Memory & knowledge"
        title="Context that survives the conversation"
        description="Memory is scoped, knowledge is staged, and every entry keeps its version history."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {["User memory", "Project memory", "Knowledge bases", "Retrieval", "Versioned knowledge"].map(
            (item) => (
              <div key={item} className="panel p-5 text-sm">
                {item}
              </div>
            ),
          )}
        </div>
      </Section>

      <Section
        id="agents"
        eyebrow="Agents"
        title="Agents with hard limits"
        description="Each agent has an explicit permission set. Publishing to production knowledge always requires approval."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {AGENTS.map((a) => (
            <div key={a.key} className="panel p-5">
              <h3 className="text-sm font-semibold">{a.name}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{a.description}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        eyebrow="Developers"
        title="The Aether API"
        description="External applications will connect to Aether with scoped, revocable API keys — chat, models, knowledge, research, projects and modules."
      >
        <div className="panel overflow-x-auto p-5 font-mono text-xs text-muted-foreground">
          <pre>{`POST /v1/chat
Authorization: Bearer aeth_live_••••••••
Content-Type: application/json

{
  "model_role": "aether-think",
  "project": "battle-versia",
  "messages": [{ "role": "user", "content": "..." }]
}`}</pre>
        </div>
        <div className="mt-6">
          <Button asChild variant="outline">
            <Link to="/developers">Developer overview</Link>
          </Button>
        </div>
      </Section>

      <SiteFooter />
    </div>
  );
}
