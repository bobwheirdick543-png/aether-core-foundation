import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

function AuthError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4 py-10">
      <div className="max-w-md rounded-xl border border-border/70 bg-card p-6 text-center">
        <h1 className="text-sm font-semibold">This workspace view interrupted</h1>
        <p className="mt-2 text-xs text-muted-foreground">
          Retry without leaving the platform. Your session stays intact.
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
          <button
            type="button"
            onClick={() => window.history.back()}
            className="rounded-md border px-3 py-2 text-xs"
          >
            Go back
          </button>
          <Link to="/dashboard" className="rounded-md border px-3 py-2 text-xs">
            Dashboard
          </Link>
          <Link to="/chat" className="rounded-md border px-3 py-2 text-xs">
            Chat
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      const path = `${location.pathname}${location.searchStr || ""}`;
      throw redirect({
        to: "/login",
        search: { redirect: path.startsWith("/admin") ? "/dashboard" : path },
      });
    }

    if (location.pathname !== "/onboarding") {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", data.user.id)
        .maybeSingle();
      if (!profileError && profile?.onboarding_completed !== true) {
        throw redirect({ to: "/onboarding" });
      }
    }

    return { user: data.user };
  },
  component: () => <Outlet />,
  errorComponent: AuthError,
});
