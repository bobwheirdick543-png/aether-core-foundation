import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getAdminBootstrapStatus, bootstrapAdmin } from "@/lib/auth/admin.functions";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin/setup")({
  head: () => ({
    meta: [
      { title: "Administrator setup — Aether" },
      { name: "description", content: "One-time creation of the Aether platform administrator." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Administrator setup — Aether" },
      { property: "og:description", content: "One-time creation of the Aether platform administrator." },
    ],
  }),
  component: AdminSetup,
});

function AdminSetup() {
  const navigate = useNavigate();
  const status = useServerFn(getAdminBootstrapStatus);
  const run = useServerFn(bootstrapAdmin);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-bootstrap-status"],
    queryFn: () => status({}),
    retry: false,
  });

  const [form, setForm] = useState({ secret: "", email: "", password: "", displayName: "" });
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await run({ data: form });
      if (result.ok) {
        toast.success(result.message);
        navigate({ to: "/admin/login" });
      } else {
        toast.error(result.message);
        refetch();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Setup failed.");
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
          <h1 className="text-lg font-semibold">Administrator setup</h1>

          {isLoading ? (
            <p className="mt-3 text-sm text-muted-foreground">Checking setup state…</p>
          ) : !data?.configured ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Setup is not available: the server has no setup code configured. Add the administrator
              setup code to the server environment first.
            </p>
          ) : data?.completed ? (
            <div className="mt-3 space-y-4">
              <p className="text-sm text-muted-foreground">
                An administrator already exists. This page can only be used once.
              </p>
              <Button asChild className="w-full">
                <Link to="/admin/login">Go to administrator sign-in</Link>
              </Button>
            </div>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted-foreground">
                Create the permanent administrator account. The setup code is verified on the server
                and this page stops working afterwards.
              </p>
              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="secret">Setup code</Label>
                  <Input
                    id="secret"
                    type="password"
                    autoComplete="off"
                    required
                    value={form.secret}
                    onChange={(e) => setForm({ ...form, secret: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={form.displayName}
                    onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Administrator email</Label>
                  <Input
                    id="email"
                    type="email"
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
        </div>
      </div>
    </div>
  );
}
