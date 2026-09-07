import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AetherLogo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create account — Aether AI Platform" },
      { name: "description", content: "Create your Aether account and set up your workspace." },
      { property: "og:title", content: "Create account — Aether AI Platform" },
      { property: "og:description", content: "Create your Aether account and set up your workspace." },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin, data: { display_name: name } },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data.session) setSent(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5 py-16">
      <div className="w-full max-w-sm">
        <Link to="/" className="mx-auto flex w-fit">
          <AetherLogo />
        </Link>
        <div className="panel mt-8 p-6">
          {sent ? (
            <>
              <h1 className="text-lg font-semibold">Check your email</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Confirm your address to activate your Aether account, then sign in.
              </p>
              <Button asChild className="mt-6 w-full" variant="outline">
                <Link to="/login">Back to sign in</Link>
              </Button>
            </>
          ) : (
            <>
              <h1 className="text-lg font-semibold">Create your account</h1>
              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Display name</Label>
                  <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Creating…" : "Create account"}
                </Button>
              </form>
              <p className="mt-5 text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link to="/login" className="text-primary hover:underline">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
