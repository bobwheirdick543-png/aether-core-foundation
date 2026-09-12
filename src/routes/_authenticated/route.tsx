import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      // Preserve the intended destination through login (user shell only).
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
});
