import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, Panel, Tag } from "@/components/common/Primitives";
import { Button } from "@/components/ui/button";
import { getBattleversiaHome } from "@/lib/aether/battleversia.functions";

export const Route = createFileRoute("/_authenticated/battleversia")({
  head: () => ({
    meta: [
      { title: "Battleversia — Aether" },
      { name: "description", content: "Battleversia module — persistent world inside the Aether platform." },
    ],
  }),
  component: Page,
});

function Page() {
  const load = useServerFn(getBattleversiaHome);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["battleversia", "home"],
    queryFn: async () => {
      try {
        return await load({});
      } catch (e) {
        console.error("[battleversia]", e);
        return null;
      }
    },
    retry: 1,
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Battleversia"
          description="Aether module — not the core platform. Characters, economy, auctions and tournaments persist independently from the main workspace."
          backFallback="/dashboard"
        />
        <Panel>
          <p className="text-xs text-muted-foreground">
            PDF Phase N: Battleversia is a governed application module exposed through Aether APIs. Core Aether (chat,
            AAX, agents, knowledge) does not depend on this module.
          </p>
        </Panel>
        <Panel className="overflow-hidden border-2">
          <div className="rounded-xl p-8 text-center">
            <div className="text-xs uppercase tracking-[.35em] text-muted-foreground">BATTLE VERSIA · MODULE</div>
            <h1 className="mt-2 text-4xl font-bold tracking-tight">Enter the World</h1>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">
              Bid. Build. Conquer. Your Battleversia identity, economy, characters and competitive history persist
              independently from the surrounding Aether workspace.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link to="/battleversia/characters">Characters</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/battleversia/market">Market</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/battleversia/auctions">Auctions</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/battleversia/economy">Wallet</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/battleversia/tournaments">Tournaments</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/battleversia/rankings">Rankings</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/battleversia/control">Control Center</Link>
              </Button>
            </div>
          </div>
        </Panel>
        {isError && (
          <Panel>
            <p className="text-sm text-destructive">Battleversia module data could not be loaded.</p>
            <p className="mt-1 text-xs text-muted-foreground">Navigation remains available when the module backend is ready.</p>
          </Panel>
        )}
        {isLoading ? (
          <Panel>Entering Versia…</Panel>
        ) : data ? (
          <div className="grid gap-4 md:grid-cols-4">
            <Panel>
              <div className="text-xs text-muted-foreground">Yons</div>
              <div className="mt-2 text-2xl font-bold">◈ {data.wallet.balance.toLocaleString()}</div>
              <Link className="mt-3 inline-block text-xs underline" to="/battleversia/economy">
                Open economy
              </Link>
            </Panel>
            <Panel>
              <div className="text-xs text-muted-foreground">Characters</div>
              <div className="mt-2 text-2xl font-bold">{data.characters.length}</div>
              <Link className="mt-3 inline-block text-xs underline" to="/battleversia/characters">
                Explore
              </Link>
            </Panel>
            <Panel>
              <div className="text-xs text-muted-foreground">Live auctions</div>
              <div className="mt-2 text-2xl font-bold">{data.auctions.length}</div>
              <Link className="mt-3 inline-block text-xs underline" to="/battleversia/auctions">
                Enter arena
              </Link>
            </Panel>
            <Panel>
              <div className="text-xs text-muted-foreground">Tournaments</div>
              <div className="mt-2 text-2xl font-bold">{data.tournaments.length}</div>
              <Link className="mt-3 inline-block text-xs underline" to="/battleversia/tournaments">
                View events
              </Link>
            </Panel>
          </div>
        ) : null}
        {data && (
          <Panel>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold">Versia Core</h2>
                <p className="text-xs text-muted-foreground">Persistent module server status</p>
              </div>
              <Tag tone="primary">{data.servers[0]?.status ?? "online"}</Tag>
            </div>
          </Panel>
        )}
      </div>
    </AppShell>
  );
}
