import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  clearAdminSessionCookies,
  clearAuthSessionCookies,
  writeAuthSessionCookies,
} from "@/lib/auth/admin.session.server";

function supabaseServerClient(accessToken?: string) {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Authentication service is not configured.");

  return createClient<Database>(url, key, {
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined,
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export const Route = createFileRoute("/api/auth/session")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const authorization = request.headers.get("authorization");
          const headerToken = authorization?.startsWith("Bearer ")
            ? authorization.slice("Bearer ".length).trim()
            : "";
          const body = await request.json().catch(() => ({})) as {
            accessToken?: string;
            refreshToken?: string;
          };
          const accessToken = headerToken || body.accessToken || "";

          if (!accessToken) {
            return Response.json({ error: "Authentication required." }, { status: 401 });
          }

          const supabase = supabaseServerClient(accessToken);
          const { data, error } = await supabase.auth.getClaims(accessToken);
          if (error || !data?.claims?.sub) {
            return Response.json({ error: "Session could not be verified." }, { status: 401 });
          }

          const refreshToken = typeof body.refreshToken === "string" ? body.refreshToken.trim() : "";
          if (!refreshToken) {
            return Response.json(
              { error: "A refresh token is required to establish the persistent server session." },
              { status: 400 },
            );
          }

          writeAuthSessionCookies(accessToken, refreshToken);
          return Response.json({ ok: true, userId: data.claims.sub });
        } catch (error) {
          console.error("[Aether auth] session sync failed", error);
          return Response.json({ error: "Session synchronization failed." }, { status: 500 });
        }
      },
      DELETE: async () => {
        // Clear both the canonical session and legacy admin session so signing
        // out can never leave an older authenticated cookie behind.
        clearAuthSessionCookies();
        clearAdminSessionCookies();
        return Response.json({ ok: true });
      },
    },
  },
});
