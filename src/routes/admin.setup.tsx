import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Legacy route kept only so generated route metadata stays build-safe.
 * Aether has no administrator signup/setup flow; all administrator access
 * starts at /admin/login using the server-configured credentials.
 */
export const Route = createFileRoute("/admin/setup")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/login" });
  },
  component: () => null,
});
