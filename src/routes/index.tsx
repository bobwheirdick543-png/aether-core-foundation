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
  Sparkles,
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

/** Public → login → intended workspace destination */
function loginTo(path: string) {
  return { to: "/login" as const, search: { redirect: path } };
}

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <section className="relative overflow-hidden">
        <div className="grid-backdrop pointer-events-none absolute inset-0 opacity-40" />
        <div className="hero-glow pointer-events-none absolute inset-0" />
        <div className="aether-glow pointer-events-none absolute inset-0 opacity-80" />

        <div className="relative mx-auto w-full max-w-7xl px-5 py-28 lg:px-8 lg:py-40">
          <div className="animate-in-up max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-surface/60 px-3.5 py-1.5 text-[11px] uppercase tracking-[0.18em] text-muted-foreground backdrop-blur-sm">
              <Sparkles className="h-3 w-3 text-primary" />
              Next-generation AI platform
            </span>

            <h1 className="mt-7 text-4xl font-semibold tracking-tight text-balance-tight sm:text-5xl lg:text-6xl">
              Aether —{" "}
              <span className="bg-gradient-to-r from-primary to-[oklch(0.72_0.15_300)] bg-clip-text text-transparent">
                Your AI Platform.
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              One platform for intelligent conversations, research, memory, knowledge,
              agents, models, and applications.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-11 px-6">
                <Link to="/signup">
                  Get Started <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-11 px-6">
                <Link {...loginTo("/chat")}>
                  Try Chat
                </Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="h-11 px-6">
                <Link to="/features">Explore Aether</Link>
              </Button>
            </div>

            <dl className="mt-16 grid max-w-2xl grid-cols-2 gap-8 sm:grid-cols-4">
              {[
                ["6", "Model roles"],
                [String(AGENTS.length), "Platform agents"],
                ["4", "Knowledge stages"],
                ["8", "API scopes"],
              ].map(([value, label]) => (
                <div key={label}>
                  <dt className="font-mono text-2xl font-semibold tabular-nums text-primary">{value}</dt>
                  <dd className="mt-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
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
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild variant="outline" size="sm">
            <Link {...loginTo("/models")}>Open Models</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link {...loginTo("/research")}>Open Research</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link {...loginTo("/projects")}>Open Projects</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link {...loginTo("/knowledge")}>Open Knowledge</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link {...loginTo("/tasks")}>Open Tasks</Link>
          </Button>
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
            <div
              key={m.key}
              className="panel group p-5 transition-all duration-200 hover:border-primary/35 hover:shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_15%,transparent)]"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">{m.name}</h3>
                <Tag tone="primary">{m.speed}</Tag>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{m.description}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {m.capabilities.map((c) => (
                  <span
                    key={c}
                    className="rounded-md border border-border/60 bg-elevated/50 px-2 py-0.5 text-[10px] text-muted-foreground"
                  >
                    {c}
                  </span>
                ))}
              </div>
              <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                {formatContext(m.contextWindow)}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-6">
          <Button asChild variant="outline">
            <Link {...loginTo("/models")}>Use models in workspace</Link>
          </Button>
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
        <div className="mt-6">
          <Button asChild variant="outline">
            <Link {...loginTo("/research")}>Open research workspace</Link>
          </Button>
        </div>
      </Section>

      <Section
        eyebrow="Memory & knowledge"
        title="Context that survives the conversation"
        description="Memory is scoped, knowledge is staged, and every entry keeps its version history."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {["User memory", "Project memory", "Knowledge bases", "Retrieval", "Versioned knowledge"].map(
            (item) => (
              <div key={item} className="panel p-5 text-sm transition-colors hover:border-primary/30">
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
        description="Each agent has an explicit permission set. Publishing to production knowledge always requires approval. Agent control is administrator-only."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {AGENTS.map((a) => (
            <div key={a.key} className="panel group p-5 transition-all duration-200 hover:border-primary/35">
              <div className="flex items-center gap-2">
                <AetherMark className="h-4 w-4 text-primary opacity-70" />
                <h3 className="text-sm font-semibold">{a.name}</h3>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{a.description}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        eyebrow="Developers"
        title="The Aether API"
        description="External applications will connect to Aether with scoped, revocable API keys — chat, models, knowledge, research, projects and modules."
      >
        <div className="panel overflow-x-auto p-6 font-mono text-xs leading-relaxed text-muted-foreground">
          <pre>{`POST /v1/chat
Authorization: Bearer aeth_live_••••••••
Content-Type: application/json

{
  "model_role": "aether-think",
  "project": "battle-versia",
  "messages": [{ "role": "user", "content": "..." }]
}`}</pre>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link to="/developers">Developer overview</Link>
          </Button>
          <Button asChild variant="outline">
            <Link {...loginTo("/api-keys")}>API keys workspace</Link>
          </Button>
        </div>
      </Section>

      <section className="border-t border-border/70 py-24">
        <div className="mx-auto max-w-3xl px-5 text-center lg:px-8">
          <h2 className="text-2xl font-semibold text-balance-tight sm:text-3xl">
            Ready to build with Aether?
          </h2>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            Create your account and step into a unified AI operating environment.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/signup">
                Get Started <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link {...loginTo("/dashboard")}>Sign in to workspace</Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <Link to="/docs">Read the docs</Link>
            </Button>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
