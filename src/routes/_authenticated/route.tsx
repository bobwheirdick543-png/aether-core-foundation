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
    return { user: data.user };
  },
  component: () => <Outlet />,
});
