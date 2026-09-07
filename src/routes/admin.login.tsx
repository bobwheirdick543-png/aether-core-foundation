import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { elevateToAdmin } from "@/lib/auth/admin.functions";
import { AetherLogo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [
      { title: "Admin access — Aether" },
      { name: "description", content: "Private administrator access to the Aether platform console." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Admin access — Aether" },
      { property: "og:description", content: "Private administrator access to the Aether platform console." },
    ],
  }),
  component: AdminLogin,
});

function AdminLogin() {
  const navigate = useNavigate();
  const elevate = useServerFn(elevateToAdmin);
  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await elevate({ data: { passphrase } });
      if (result.ok) {
        navigate({ to: "/admin" });
      } else {
        toast.error("Access denied.");
      }
    } catch {
      toast.error("You must be signed in to your Aether account first.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5 py-16">
      <div className="w-full max-w-sm">
        <Link to="/" className="mx-auto flex w-fit">
          <AetherLogo />
        </Link>
        <div className="panel mt-8 p-6">
          <h1 className="text-lg font-semibold">Administrator access</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to your account first, then confirm the administrator passphrase. It is verified
            server-side only.
          </p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="passphrase">Passphrase</Label>
              <Input
                id="passphrase"
                type="password"
                autoComplete="off"
                required
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Verifying…" : "Unlock console"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
