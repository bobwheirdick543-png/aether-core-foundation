import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, Tag, PhaseNote } from "@/components/common/Primitives";
import { Button } from "@/components/ui/button";
import { MODEL_ROLES, formatContext } from "@/lib/aether/models";

export const Route = createFileRoute("/_authenticated/models")({
  head: () => ({
    meta: [
      { title: "Models — Aether" },
      { name: "description", content: "Available Aether model roles." },
      { property: "og:title", content: "Models — Aether" },
      { property: "og:description", content: "Available Aether model roles." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <AppShell>
      <div className="animate-in-up space-y-6">
        <PageHeader
          eyebrow="Intelligence"
          title="Models"
          description="Product-level model roles. A future model router maps each role to a concrete provider and model."
        />

        <PhaseNote>
          Catalog only — provider execution and routing land in Phase 4.
        </PhaseNote>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {MODEL_ROLES.map((m) => (
            <div
              key={m.key}
              className="panel group flex flex-col p-5 transition-all duration-200 hover:border-primary/35 hover:shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_12%,transparent)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">{m.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{m.description}</p>
                </div>
                <Tag tone={m.status === "available" ? "success" : "neutral"}>{m.status}</Tag>
              </div>

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
                  <p className="font-mono uppercase tracking-[0.12em]">
                    {formatContext(m.contextWindow)}
                  </p>
                  <p className="capitalize">{m.speed}</p>
                </div>
                <Button size="sm" variant="outline" className="opacity-80 group-hover:opacity-100">
                  Select
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
