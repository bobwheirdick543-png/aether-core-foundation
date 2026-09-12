import { createFileRoute, Link } from "@tanstack/react-router";
import { MessagesSquare, Boxes, Brain, Library, Globe2, FolderKanban, KeyRound, ArrowRight, Sparkles, BellRing } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/layout/SiteChrome";
import { Section, FeatureCard, FlowList } from "@/components/marketing/Sections";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/common/Primitives";
import { AAX_MODEL_CATALOG, formatContext } from "@/lib/aether/models";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Aether — Your AI Platform" },
    { name: "description", content: "Aether is an evolving AI platform for conversations, Aether Ascension models, research, memory, knowledge and applications." },
    { property: "og:title", content: "Aether — Your AI Platform" },
    { property: "og:description", content: "One platform. Evolving intelligence. Aether Ascension models, knowledge and research." },
  ] }),
  component: Landing,
});

const FEATURES = [
  { title: "AI Chat", description: "Persistent conversations with a selected Aether Ascension generation and model context.", icon: MessagesSquare },
  { title: "Aether Ascension", description: "A unified evolving AAX model family in which every released generation is a complete AI with broad platform capabilities.", icon: Boxes },
  { title: "Memory", description: "Persistent user and project context that can inform future work without losing scope.", icon: Brain },
  { title: "Universal Knowledge", description: "A shared Aether knowledge ecosystem with provenance, verification and version history.", icon: Library },
  { title: "Research", description: "Background research workflows that can continue while you are away from Aether.", icon: Globe2 },
  { title: "Projects", description: "Projects and modules with their own context, tasks and integrations.", icon: FolderKanban },
  { title: "Developer API", description: "Scoped, recoverable, revocable AAX API keys for external applications and integrations.", icon: KeyRound },
];

function loginTo(path: string) { return { to: "/login" as const, search: { redirect: path } }; }

function Landing() {
  return <div className="min-h-screen bg-background">
    <SiteHeader />
    <section className="relative overflow-hidden">
      <div className="grid-backdrop pointer-events-none absolute inset-0 opacity-40" /><div className="hero-glow pointer-events-none absolute inset-0" /><div className="aether-glow pointer-events-none absolute inset-0 opacity-80" />
      <div className="relative mx-auto w-full max-w-7xl px-5 py-28 lg:px-8 lg:py-40">
        <div className="animate-in-up max-w-4xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-surface/60 px-3.5 py-1.5 text-[11px] uppercase tracking-[0.18em] text-muted-foreground backdrop-blur-sm"><Sparkles className="h-3 w-3 text-primary" />Next-generation AI platform</span>
          <h1 className="mt-7 text-4xl font-semibold tracking-tight text-balance-tight sm:text-5xl lg:text-6xl">Aether — <span className="bg-gradient-to-r from-primary to-[oklch(0.72_0.15_300)] bg-clip-text text-transparent">Your AI Platform.</span></h1>
          <p className="mt-6 max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-lg">Aether brings conversations, evolving Aether Ascension intelligence, research, memory, knowledge and applications into one platform.</p>
          <div className="mt-9 flex flex-wrap gap-3"><Button asChild size="lg" className="h-11 px-6"><Link to="/signup">Get Started <ArrowRight className="ml-1.5 h-4 w-4" /></Link></Button><Button asChild size="lg" variant="outline" className="h-11 px-6"><Link {...loginTo("/chat")}>Try Chat</Link></Button><Button asChild size="lg" variant="ghost" className="h-11 px-6"><Link to="/models-overview">Explore AAX</Link></Button></div>
          <dl className="mt-16 grid max-w-2xl grid-cols-2 gap-8 sm:grid-cols-4">{[[String(AAX_MODEL_CATALOG.length), "AAX generations"],["∞", "Knowledge evolution"],["24/7", "Background runtime"],["1", "Unified platform"]].map(([value,label]) => <div key={label}><dt className="font-mono text-2xl font-semibold tabular-nums text-primary">{value}</dt><dd className="mt-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</dd></div>)}</dl>
        </div>
      </div>
    </section>

    <Section id="features" eyebrow="Platform" title="Everything Aether brings together" description="Aether is built as a platform with a durable runtime, an orchestrator, knowledge, research and evolving AAX intelligence — not a chatbot with features bolted on."><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{FEATURES.map((f) => <FeatureCard key={f.title} {...f} />)}</div><div className="mt-8 flex flex-wrap gap-3"><Button asChild variant="outline" size="sm"><Link {...loginTo("/models")}>Open AAX Models</Link></Button><Button asChild variant="outline" size="sm"><Link {...loginTo("/research")}>Open Research</Link></Button><Button asChild variant="outline" size="sm"><Link {...loginTo("/knowledge")}>Open Knowledge</Link></Button><Button asChild variant="outline" size="sm"><Link {...loginTo("/tasks")}>Open Tasks</Link></Button></div></Section>

    <Section id="models" eyebrow="Aether Ascension · AAX" title="One evolving intelligence family" description="Every AAX generation is a complete Aether AI. Generations may improve reasoning, context, tool use, knowledge handling and other capabilities, while the shared Aether knowledge ecosystem remains governed separately."><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{AAX_MODEL_CATALOG.map((m) => <div key={m.key} className="panel group p-5 transition-all duration-200 hover:border-primary/35"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">{m.name}</h3><p className="mt-1 font-mono text-[10px] text-muted-foreground">Generation {m.generation} · Revision {m.revision}</p></div><Tag tone={m.status === "available" ? "success" : "neutral"}>{m.status}</Tag></div><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{m.description}</p><div className="mt-4 flex flex-wrap gap-1.5">{m.capabilities.map((c) => <span key={c} className="rounded-md border border-border/60 bg-elevated/50 px-2 py-0.5 text-[10px] text-muted-foreground">{c}</span>)}</div><p className="mt-4 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{formatContext(m.contextWindow)} · {m.speed}</p></div>)}</div><div className="mt-6"><Button asChild variant="outline"><Link to="/models-overview">See the AAX catalogue</Link></Button></div></Section>

    <Section eyebrow="Knowledge evolution" title="Knowledge can keep evolving while you are away" description="Aether's durable runtime can execute authorized research and knowledge workflows in the background. Sources remain preserved, understandings accumulate, verification remains explicit, and accepted knowledge becomes available to authorized AAX models without pretending that research is automatically model retraining."><FlowList items={["Preserve the original PDF, prompt or source with provenance", "Knowledge Acquisition performs deep extraction and creates an identifiable understanding", "Research and Verification independently analyze the source plus accumulated understandings", "Knowledge Curator builds the append-only collective package", "The target AAX performs its own analysis before model-specific knowledge integration", "Real completion events produce reports and notifications"]} /></Section>

    <Section eyebrow="Background execution" title="Aether keeps working when you leave" description="Once a task is accepted by the Universal Runtime, the user's browser is not the execution engine. Durable task state, retries, timeouts and recovery let authorized work continue server-side."><div className="panel p-6"><div className="flex items-start gap-3"><BellRing className="mt-0.5 h-5 w-5 text-primary" /><div><h3 className="text-sm font-semibold">Real task completion notifications</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Completed, failed, timed-out and important knowledge/model events can appear in the in-app notification centre and feed configured external delivery. Aether does not claim an external delivery occurred until the provider confirms it.</p></div></div></div></Section>

    <Section eyebrow="Developers" title="The Aether Intelligence API" description="External applications connect to AAX through scoped, revocable API keys. The external API is an intelligence boundary: provider credentials remain inside Aether and are never handed to the integrating application."><div className="panel overflow-x-auto p-6 font-mono text-xs leading-relaxed text-muted-foreground"><pre>{`POST /api/v1/intelligence\nAuthorization: Bearer AAX-3.1-••••••••\nContent-Type: application/json\n\n{\n  "model": "aax-3.1",\n  "messages": [{ "role": "user", "content": "..." }]\n}`}</pre></div><div className="mt-6 flex flex-wrap gap-3"><Button asChild variant="outline"><Link to="/developers">Developer overview</Link></Button><Button asChild variant="outline"><Link {...loginTo("/api-keys")}>AAX API keys workspace</Link></Button></div></Section>

    <section className="border-t border-border/70 py-24"><div className="mx-auto max-w-3xl px-5 text-center lg:px-8"><h2 className="text-2xl font-semibold text-balance-tight sm:text-3xl">Ready to build with Aether?</h2><p className="mt-3 text-sm text-muted-foreground sm:text-base">Create your account and step into a unified, evolving AI operating environment.</p><div className="mt-8 flex flex-wrap justify-center gap-3"><Button asChild size="lg"><Link to="/signup">Get Started <ArrowRight className="ml-1.5 h-4 w-4" /></Link></Button><Button asChild size="lg" variant="outline"><Link {...loginTo("/dashboard")}>Sign in to workspace</Link></Button><Button asChild size="lg" variant="ghost"><Link to="/docs">Read the docs</Link></Button></div></div></section>
    <SiteFooter />
  </div>;
}
