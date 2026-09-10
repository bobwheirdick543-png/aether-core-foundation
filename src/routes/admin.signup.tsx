import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { validateAdminSignupEmail } from "@/lib/auth/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin/signup")({
  head: () => ({
    meta: [
      { title: "Administrator signup — Aether" },
      { name: "description", content: "Create the designated Aether platform administrator account." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Administrator signup — Aether" },
      { property: "og:description", content: "Create the designated Aether platform administrator account." },
    ],
  }),
  component: AdminSignup,
});

function AdminSignup() {
  const navigate = useNavigate();
  const validateEmail = useServerFn(validateAdminSignupEmail);
  const [form, setForm] = useState({ email: "", password: "", displayName: "" });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);

    try {
      const email = form.email.trim().toLowerCase();
      const validation = await validateEmail({ data: { email } });
      if (!validation.ok) {
        toast.error(validation.message);
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password: form.password,
        options: {
          data: { display_name: form.displayName.trim().slice(0, 80) },
          emailRedirectTo: `${window.location.origin}/admin/login`,
        },
      });

      if (error) {
        toast.error(error.message || "Could not create the administrator account.");
        return;
      }

      // Supabase normally returns no session when email confirmation is enabled.
      // If confirmation is disabled by project configuration, the server still
      // performs the designated-email/admin-role verification at login.
      if (data.session?.access_token) {
        await supabase.auth.signOut().catch(() => {});
      }

      setSent(true);
      toast.success("Administrator account created. Check your email to confirm it.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Administrator signup failed.");
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
          <h1 className="text-lg font-semibold">Administrator signup</h1>

          {sent ? (
            <div className="mt-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Check the administrator email inbox and click the Supabase confirmation link. You will be
                returned to Aether, then you can sign in with the same email and password.
              </p>
              <Button className="w-full" onClick={() => navigate({ to: "/admin/login" })}>
                Go to administrator sign-in
              </Button>
            </div>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted-foreground">
                This page creates only the server-designated administrator account. The submitted email
                must exactly match the administrator email configured on Vercel.
              </p>

              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="displayName">Name</Label>
                  <Input
                    id="displayName"
                    autoComplete="name"
                    value={form.displayName}
                    onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Administrator email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="username"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password (min 12 characters)</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={12}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Creating…" : "Create administrator"}
                </Button>
              </form>
            </>
          )}

          <p className="mt-6 text-xs text-muted-foreground">
            Already registered?{" "}
            <Link to="/admin/login" className="text-primary hover:underline">
              Administrator sign-in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
