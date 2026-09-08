import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Logo, AetherMark } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { z } from "zod";

const loginSearchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/login")({
  validateSearch: loginSearchSchema,
  head: () => ({
    meta: [
      { title: "Sign in — Aether AI Platform" },
      { name: "description", content: "Sign in to your Aether workspace." },
      { property: "og:title", content: "Sign in — Aether AI Platform" },
      { property: "og:description", content: "Sign in to your Aether workspace." },
    ],
  }),
  component: LoginPage,
});

function safeInternalPath(path: string | undefined): string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return "/dashboard";
  // Never bounce ordinary users into admin after login via open redirect.
  if (path.startsWith("/admin")) return "/dashboard";
  return path;
}

function LoginPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/login" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    navigate({ to: safeInternalPath(search.redirect) });
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
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
            Your AI operating environment.
          </h2>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            Models, memory, knowledge, research, agents and projects — connected under one roof.
          </p>
        </div>
        <p className="relative text-xs text-muted-foreground">
          © {new Date().getFullYear()} Aether AI Platform
        </p>
      </div>

      <div className="flex flex-col items-center justify-center px-5 py-16">
        <div className="w-full max-w-[380px] animate-in-up">
          <div className="mb-8 flex justify-center lg:hidden">
            <Link to="/">
              <Logo />
            </Link>
          </div>

          <div className="space-y-1.5 text-center lg:text-left">
            <h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
            <p className="text-sm text-muted-foreground">
              Sign in to continue to your Aether workspace.
            </p>
          </div>

          <form onSubmit={onSubmit} className="mt-8 space-y-5">
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
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-muted-foreground transition-colors hover:text-primary"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
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
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            No account?{" "}
            <Link to="/signup" className="font-medium text-primary transition-colors hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
