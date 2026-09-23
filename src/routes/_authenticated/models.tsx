import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, Tag, PhaseNote } from "@/components/common/Primitives";
import { Button } from "@/components/ui/button";
import { listPublicAaxModels } from "@/lib/aether/aax-catalog.functions";

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

function formatTokens(value: number | null | undefined) {
  const n = Number(value ?? 0);
  return n > 0 ? `${n.toLocaleString()} tokens` : "Not configured";
}

function Page() {
  const getModels = useServerFn(listPublicAaxModels);
  const { data: modelsData, isLoading, isError } = useQuery({
    queryKey: ["public-aax-models"],
    queryFn: () => getModels(),
  });
  const models = Array.isArray(modelsData) ? modelsData : [];

  return (
    <AppShell>
      <div className="animate-in-up space-y-6">
        <PageHeader
          eyebrow="Aether Ascension · AAX"
          title="Models"
          description="The live AAX catalogue available to your Aether account. Availability, capacity and release state come from persistent server configuration."
        />
        <PhaseNote>
          Only released, enabled AAX generations appear here. Draft, scheduled and disabled generations stay out of the user catalogue until an administrator makes them available.
        </PhaseNote>
        {isError ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            The live AAX catalogue could not be loaded. No unavailable model is substituted.
          </div>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {isLoading ? (
            <div className="col-span-full py-10 text-center text-sm text-muted-foreground">Loading live AAX catalogue…</div>
          ) : models.length === 0 ? (
            <div className="col-span-full py-10 text-center text-sm text-muted-foreground">
              No AAX generations are currently released. An administrator must release and configure a model before it can be used.
            </div>
          ) : (
            (Array.isArray(models) ? models : []).map((m) => (
              <div key={m.model_key} className="panel group flex flex-col p-5 transition-all duration-200 hover:border-primary/35">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">{m.display_name}</h3>
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                      AAX {m.generation}.{m.revision}
                    </p>
                  </div>
                  <Tag tone="success">available</Tag>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{m.description}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {(Array.isArray(m.capabilities) ? m.capabilities : []).map((cap) => (
                    <span key={cap} className="rounded-md border border-border/60 bg-elevated/50 px-2 py-0.5 text-[10px] text-muted-foreground">
                      {cap}
                    </span>
                  ))}
                </div>
                <div className="mt-auto grid grid-cols-2 gap-3 pt-5 text-[11px] text-muted-foreground">
                  <div>
                    <p className="uppercase tracking-[0.12em]">Context</p>
                    <p className="mt-1 font-medium text-foreground">{formatTokens(m.context_window)}</p>
                  </div>
                  <div>
                    <p className="uppercase tracking-[0.12em]">Max output</p>
                    <p className="mt-1 font-medium text-foreground">{formatTokens(m.output_limit)}</p>
                  </div>
                </div>
                <Button className="mt-4 w-full" size="sm" variant="outline" asChild>
                  <Link to="/chat">Open in Chat</Link>
                </Button>
              </div>
            ))
          )}
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Prefer the full workspace? Go to{" "}
          <Link to="/chat" className="text-primary underline-offset-2 hover:underline">Chat</Link>{" "}
          — the message box uses the same live AAX catalogue.
        </p>
      </div>
    </AppShell>
  );
}
