import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  verifyAdminAccessToken,
  getAdminBootstrapStatus,
  changeAdminCredentialsViaSetupCode,
} from "@/lib/auth/admin.functions";
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
  const status = useServerFn(getAdminBootstrapStatus);
  const changeCreds = useServerFn(changeAdminCredentialsViaSetupCode);

  const { data: bootstrap } = useQuery({
    queryKey: ["admin-bootstrap-status"],
    queryFn: () => status({}),
    retry: false,
  });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const [showRecovery, setShowRecovery] = useState(false);
  const [recovery, setRecovery] = useState({
    secret: "",
    currentEmail: "",
    newEmail: "",
    newPassword: "",
  });
  const [recoveryBusy, setRecoveryBusy] = useState(false);

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

      // Persist session explicitly (helps async preview storage)
      if (signInData.session) {
        await supabase.auth.setSession({
          access_token: signInData.session.access_token,
          refresh_token: signInData.session.refresh_token,
        });
      }

      // Verify admin role using the token directly — no middleware race
      const result = await verifyWithToken({ data: { accessToken } });

      if (result.ok) {
        navigate({ to: "/admin" });
        return;
      }

      await supabase.auth.signOut().catch(() => {});

      if (result.reason === "not_admin") {
        toast.error(
          "This account is signed in but is not an administrator. Open recovery and submit the setup code again to re-assert the admin role.",
        );
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

  async function onRecoverySubmit(e: React.FormEvent) {
    e.preventDefault();
    setRecoveryBusy(true);
    try {
      const result = await changeCreds({
        data: {
          secret: recovery.secret,
          currentEmail: recovery.currentEmail || undefined,
          newEmail: recovery.newEmail || undefined,
          newPassword: recovery.newPassword || undefined,
        },
      });
      if (result.ok) {
        toast.success(result.message);
        await supabase.auth.signOut().catch(() => {});
        setShowRecovery(false);
        if (recovery.newEmail) setEmail(recovery.newEmail.trim().toLowerCase());
        setPassword("");
        setRecovery({ secret: "", currentEmail: "", newEmail: "", newPassword: "" });
      } else {
        toast.error(result.message);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Credential change failed.");
    } finally {
      setRecoveryBusy(false);
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
            This area is restricted. Access is verified on the server for every page and action.
          </p>

          {!showRecovery ? (
            <>
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

              {bootstrap?.configured && !bootstrap?.completed ? (
                <p className="mt-6 text-xs text-muted-foreground">
                  No administrator exists yet.{" "}
                  <Link to="/admin/setup" className="text-primary hover:underline">
                    Run the one-time setup
                  </Link>
                  .
                </p>
              ) : null}

              {bootstrap?.configured && bootstrap?.completed ? (
                <div className="mt-6 border-t border-border pt-4">
                  <button
                    type="button"
                    onClick={() => setShowRecovery(true)}
                    className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                  >
                    Change email or password using setup code
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <p className="mt-4 text-sm text-muted-foreground">
                Use the server-side setup code to change the administrator email and/or password.
                This also re-asserts the admin role so you cannot lock yourself out.
              </p>
              <form onSubmit={onRecoverySubmit} className="mt-6 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="secret">Setup code</Label>
                  <Input
                    id="secret"
                    type="password"
                    autoComplete="off"
                    required
                    value={recovery.secret}
                    onChange={(e) => setRecovery({ ...recovery, secret: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="currentEmail">Current administrator email (optional)</Label>
                  <Input
                    id="currentEmail"
                    type="email"
                    autoComplete="off"
                    value={recovery.currentEmail}
                    onChange={(e) => setRecovery({ ...recovery, currentEmail: e.target.value })}
                    placeholder="Leave blank if only one admin exists"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="newEmail">New email (optional)</Label>
                  <Input
                    id="newEmail"
                    type="email"
                    autoComplete="off"
                    value={recovery.newEmail}
                    onChange={(e) => setRecovery({ ...recovery, newEmail: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="newPassword">New password (min 12 characters, optional)</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    value={recovery.newPassword}
                    onChange={(e) => setRecovery({ ...recovery, newPassword: e.target.value })}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setShowRecovery(false);
                      setRecovery({ secret: "", currentEmail: "", newEmail: "", newPassword: "" });
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1" disabled={recoveryBusy}>
                    {recoveryBusy ? "Updating…" : "Update credentials"}
                  </Button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
