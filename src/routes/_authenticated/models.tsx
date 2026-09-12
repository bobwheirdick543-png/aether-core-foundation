import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, Tag, PhaseNote } from "@/components/common/Primitives";
import { Button } from "@/components/ui/button";
import { AAX_MODEL_CATALOG, formatContext } from "@/lib/aether/models";

export const Route = createFileRoute("/_authenticated/models")({
  head: () => ({
    meta: [
      { title: "Aether Ascension — Models" },
      { name: "description", content: "AAX generations available to your Aether workspace." },
      { property: "og:title", content: "Aether Ascension — Models" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <AppShell>
      <div className="animate-in-up space-y-6">
        <PageHeader
          eyebrow="Aether Ascension · AAX"
          title="Models"
          description="Choose a conversation model by AAX generation. Each generation belongs to the same evolving Aether intelligence family and can access shared Aether knowledge."
        />
        <PhaseNote>
          Release state is authoritative: draft and scheduled AAX generations remain unavailable until an admin releases them and configures a provider. When a model is available, open Chat to talk to it — the composer accepts text and images.
        </PhaseNote>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {AAX_MODEL_CATALOG.map((m) => (
            <div
              key={m.key}
              className="panel group flex flex-col p-5 transition-all duration-200 hover:border-primary/35"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">{m.name}</h3>
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                    AAX {m.generation}.{m.revision}
                  </p>
                </div>
                <Tag tone={m.status === "available" ? "success" : "neutral"}>{m.status}</Tag>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{m.description}</p>
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
              <div className="mt-auto flex items-center justify-between pt-5">
                <div className="space-y-0.5 text-[11px] text-muted-foreground">
                  <p className="font-mono uppercase tracking-[0.12em]">{formatContext(m.contextWindow)}</p>
                  <p className="capitalize">{m.speed}</p>
                </div>
                {m.status === "available" ? (
                  <Button size="sm" variant="outline" asChild>
                    <Link to="/chat">Open in Chat</Link>
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" disabled>
                    Not available
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Prefer the full workspace? Go to{" "}
          <Link to="/chat" className="text-primary underline-offset-2 hover:underline">
            Chat
          </Link>{" "}
          — the message box is always ready for typing and image attachments.
        </p>
      </div>
    </AppShell>
  );
}
