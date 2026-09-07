import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Logo, AetherMark } from "@/components/brand/Logo";
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
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left brand panel */}
      <div className="relative hidden overflow-hidden bg-surface lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="grid-backdrop pointer-events-none absolute inset-0 opacity-30" />
        <div className="aether-glow pointer-events-none absolute inset-0" />
        <div className="relative">
          <Link to="/">
            <Logo />
          </Link>
        </div>
        <div className="relative space-y-6">
          <AetherMark className="h-16 w-16 text-primary/40" />
          <h2 className="max-w-sm text-3xl font-semibold tracking-tight text-balance-tight">
            Begin with Aether.
          </h2>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            Create your account and step into a unified environment for intelligence,
            research, knowledge and agents.
          </p>
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            {["Multiple AI model roles", "Persistent memory & knowledge", "Research with verification", "Scoped agent permissions"].map(
              (item) => (
                <li key={item} className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                  {item}
                </li>
              ),
            )}
          </ul>
        </div>
        <p className="relative text-xs text-muted-foreground">
          © {new Date().getFullYear()} Aether AI Platform
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex flex-col items-center justify-center px-5 py-16">
        <div className="w-full max-w-[380px] animate-in-up">
          <div className="mb-8 flex justify-center lg:hidden">
            <Link to="/">
              <Logo />
            </Link>
          </div>

          {sent ? (
            <div className="text-center lg:text-left">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-success/30 bg-success/10 lg:mx-0">
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
              <h1 className="text-xl font-semibold tracking-tight">Check your email</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Confirm your address to activate your Aether account, then sign in.
              </p>
              <Button asChild className="mt-8 h-11 w-full" variant="outline">
                <Link to="/login">Back to sign in</Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-1.5 text-center lg:text-left">
                <h1 className="text-xl font-semibold tracking-tight">Create your account</h1>
                <p className="text-sm text-muted-foreground">
                  Start building with the Aether platform.
                </p>
              </div>

              <form onSubmit={onSubmit} className="mt-8 space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="name">Display name</Label>
                  <Input
                    id="name"
                    required
                    placeholder="How should Aether address you?"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      minLength={8}
                      placeholder="At least 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-11 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="h-11 w-full" disabled={busy}>
                  {busy ? "Creating…" : "Create account"}
                </Button>
              </form>

              <p className="mt-8 text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link to="/login" className="font-medium text-primary transition-colors hover:underline">
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
