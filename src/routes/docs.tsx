import { createFileRoute } from "@tanstack/react-router";
import { InfoPage } from "@/components/marketing/InfoPage";
import { PLATFORM_LAYERS, ORCHESTRATOR_PIPELINE } from "@/lib/aether/orchestrator";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "Documentation — Aether AI Platform" },
      {
        name: "description",
        content: "Architecture reference for the Aether platform: layers, request pipeline and delivery phases.",
      },
      { property: "og:title", content: "Documentation — Aether AI Platform" },
      { property: "og:description", content: "Architecture reference for the Aether AI platform." },
    ],
  }),
  component: DocsPage,
});

function DocsPage() {
  return (
    <InfoPage
      eyebrow="Documentation"
      title="Architecture reference"
      description="A short map of how Aether is layered. Full API and SDK documentation follows the Aether API phase."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-5">
          <h3 className="text-sm font-semibold">Platform layers</h3>
          <ol className="mt-4 space-y-2">
            {PLATFORM_LAYERS.map((layer, i) => (
              <li key={layer} className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="font-mono text-[11px] text-primary">{String(i + 1).padStart(2, "0")}</span>
                {layer}
              </li>
            ))}
          </ol>
        </div>
        <div className="panel p-5">
          <h3 className="text-sm font-semibold">Request pipeline</h3>
          <ol className="mt-4 space-y-2">
            {ORCHESTRATOR_PIPELINE.map((s) => (
              <li key={s.key} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">{s.label}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  {s.implemented ? "ready" : "planned"}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </InfoPage>
  );
}
