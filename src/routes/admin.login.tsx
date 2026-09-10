import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { verifyAdminAccessToken } from "@/lib/auth/admin.functions";
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
  const verifyWithToken = useServerFn(verifyAdminAccessToken);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await supabase.auth.signOut();

      const { data: signInData, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        toast.error(error.message || "Sign-in failed. Check the email and password.");
        return;
      }

      const accessToken = signInData.session?.access_token;
      if (!accessToken) {
        toast.error("Sign-in succeeded but no session token was returned. Try again.");
        return;
      }

      if (signInData.session) {
        await supabase.auth.setSession({
          access_token: signInData.session.access_token,
          refresh_token: signInData.session.refresh_token,
        });
      }

      const result = await verifyWithToken({ data: { accessToken } });

      if (result.ok) {
        navigate({ to: "/admin" });
        return;
      }

      await supabase.auth.signOut().catch(() => {});

      if (result.reason === "email_not_confirmed") {
        toast.error("Confirm the administrator email from your inbox before signing in.");
      } else if (result.reason === "not_designated_admin") {
        toast.error("This account is not the designated Aether administrator.");
      } else if (result.reason === "role_assignment_failed") {
        toast.error("The administrator account was verified, but its admin role could not be assigned. Try again.");
      } else {
        toast.error("Could not verify administrator access. Try again.");
      }
    } catch (err) {
      await supabase.auth.signOut().catch(() => {});
      toast.error(err instanceof Error ? err.message : "Access denied.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5 py-16">
      <div className="w-full max-w-sm">
        <Link to="/" className="mx-auto flex w-fit">
          <Logo />
        </Link>
        <div className="panel mt-8 p-6">
          <h1 className="text-lg font-semibold">Administrator sign-in</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This area is restricted. Your identity and administrator privileges are verified on the server.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Verifying…" : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 text-xs text-muted-foreground">
            Need to create the designated administrator account?{" "}
            <Link to="/admin/signup" className="text-primary hover:underline">
              Administrator signup
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
