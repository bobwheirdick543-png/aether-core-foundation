import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { getMyRoles } from "@/lib/auth/admin.functions";

function AdminError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4 py-10">
      <div className="max-w-md rounded-xl border border-border/70 bg-card p-6 text-center">
        <h1 className="text-sm font-semibold">Admin view interrupted</h1>
        <p className="mt-2 text-xs text-muted-foreground">
          Stay in the control plane. Retry or open another admin section — you are not forced home.
        </p>
        {error?.message ? (
          <p className="mt-3 rounded border bg-muted/30 px-2 py-1.5 font-mono text-[10px] text-muted-foreground">
            {error.message.slice(0, 240)}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
          >
            Retry
          </button>
          <Link to="/admin" className="rounded-md border px-3 py-2 text-xs">
            Admin home
          </Link>
          <Link to="/admin/agents" className="rounded-md border px-3 py-2 text-xs">
            Agents
          </Link>
          <Link to="/admin/team" className="rounded-md border px-3 py-2 text-xs">
            Team
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Server-verified gate for the whole admin control plane. Hidden navigation is
 * never treated as security: the role is resolved on the server here, and every
 * admin server function re-checks it independently.
 */
export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    try {
      const result = await getMyRoles({});
      if (!result.isAdmin) throw redirect({ to: "/dashboard" });
    } catch (err) {
      if (err && typeof err === "object" && "to" in (err as Record<string, unknown>)) throw err;
      throw redirect({ to: "/admin/login" });
    }
  },
  component: () => <Outlet />,
  errorComponent: AdminError,
});
