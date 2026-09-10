import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { signInWithConfiguredAdminCredentials } from "@/lib/auth/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [
      { title: "Administrator sign-in — Aether" },
      { name: "description", content: "Private administrator access to the Aether platform console." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Administrator sign-in — Aether" },
      { property: "og:description", content: "Private administrator access to the Aether platform console." },
    ],
  }),
  component: AdminLogin,
});

function AdminLogin() {
  const navigate = useNavigate();
  const signIn = useServerFn(signInWithConfiguredAdminCredentials);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await supabase.auth.signOut();
      const result = await signIn({ data: { email: email.trim().toLowerCase(), password } });
      if (!result.ok) {
        const messages: Record<string, string> = {
          admin_credentials_not_configured: "Aether administrator credentials are not configured on the server.",
          invalid_credentials: "Invalid administrator email or password.",
          supabase_not_configured: "Aether Supabase authentication is not configured on the server.",
          supabase_signin_failed: "Administrator credentials were accepted, but the Supabase session could not be created. Try again.",
        };
        toast.error(messages[result.reason] ?? "Administrator sign-in failed.");
        return;
      }
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
      });
      if (sessionError) {
        toast.error("Administrator authentication succeeded, but the local session could not be established. Try again.");
        return;
      }
      navigate({ to: "/admin" });
    } catch (err) {
      await supabase.auth.signOut().catch(() => {});
      toast.error(err instanceof Error ? err.message : "Administrator access denied.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5 py-16">
      <div className="w-full max-w-sm">
        <Link to="/" className="mx-auto flex w-fit"><Logo /></Link>
        <div className="panel mt-8 p-6">
          <h1 className="text-lg font-semibold">Administrator sign-in</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in with the Aether administrator credentials configured securely on the server.
          </p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
          </form>
          <p className="mt-6 text-xs text-muted-foreground">
            Administrator access is controlled by the server-configured Aether credentials. No administrator signup is required.
          </p>
        </div>
      </div>
    </div>
  );
}
