import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getMyRoles } from "@/lib/auth/admin.functions";

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
});
