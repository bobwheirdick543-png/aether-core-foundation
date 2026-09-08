import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, Panel, Tag } from "@/components/common/Primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getMyProfile, updateMyProfile } from "@/lib/auth/profile.functions";
import { AETHER_AVATARS, parseAvatarUrl } from "@/lib/aether/avatars";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Aether" },
      { name: "description", content: "Account, appearance and privacy settings." },
      { property: "og:title", content: "Settings — Aether" },
      { property: "og:description", content: "Account, appearance and privacy settings." },
    ],
  }),
  component: Page,
});

function Page() {
  const queryClient = useQueryClient();
  const load = useServerFn(getMyProfile);
  const save = useServerFn(updateMyProfile);
  const { data, isLoading } = useQuery({ queryKey: ["my-profile"], queryFn: () => load({}) });

  const [displayName, setDisplayName] = useState("");
  const [language, setLanguage] = useState("en");
  const [model, setModel] = useState("aether-fast");
  const [style, setStyle] = useState("balanced");
  const [memory, setMemory] = useState(true);
  const [avatarChoice, setAvatarChoice] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  useEffect(() => {
    if (!data?.profile) return;
    setDisplayName(data.profile.display_name ?? "");
    setLanguage(data.profile.preferred_language ?? "en");
    setModel(data.profile.default_model ?? "aether-fast");
    setStyle(data.profile.response_style ?? "balanced");
    setMemory(Boolean(data.profile.memory_enabled));
    const parsed = parseAvatarUrl(data.profile.avatar_url);
    setAvatarChoice(parsed.kind === "builtin" ? parsed.id : undefined);
  }, [data]);

  async function onSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await save({
        data: {
          displayName,
          preferredLanguage: language,
          defaultModel: model,
          responseStyle: style,
          memoryEnabled: memory,
          avatarChoice: avatarChoice ?? undefined,
          onboardingCompleted: true,
        },
      });
      if (result.ok) {
        toast.success(result.message);
        queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      } else toast.error(result.message);
    } finally {
      setBusy(false);
    }
  }

  async function onChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 12) {
      toast.error("Password must be at least 12 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    setPwBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) toast.error(error.message);
      else {
        toast.success("Password updated.");
        setNewPassword("");
        setConfirmPassword("");
      }
    } finally {
      setPwBusy(false);
    }
  }

  const currentAvatar = parseAvatarUrl(data?.profile?.avatar_url ?? null);

  return (
    <AppShell>
      <div className="animate-in-up space-y-6">
        <PageHeader
          title="Settings"
          description="Manage your Aether profile, preferences and security."
          backFallback="/dashboard"
        />

        {isLoading ? (
          <Panel>
            <p className="text-sm text-muted-foreground">Loading profile…</p>
          </Panel>
        ) : (
          <>
            <Panel className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold">Account</h2>
                {data?.isAdmin ? <Tag tone="admin">admin</Tag> : <Tag tone="neutral">user</Tag>}
              </div>
              <p className="text-sm text-muted-foreground">{data?.email || "—"}</p>
            </Panel>

            <form onSubmit={onSaveProfile} className="space-y-4">
              <Panel className="space-y-5">
                <h2 className="text-sm font-semibold">Profile</h2>
                <div className="space-y-1.5">
                  <Label htmlFor="displayName">Display name</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={80}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Avatar</Label>
                  <p className="text-xs text-muted-foreground">
                    Built-in Aether avatars are decorative only and never change permissions.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {AETHER_AVATARS.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setAvatarChoice(a.id)}
                        className={cn(
                          "flex h-11 w-11 items-center justify-center rounded-lg border text-lg transition-colors",
                          avatarChoice === a.id || currentAvatar.id === a.id
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:border-primary/40",
                        )}
                        title={a.label}
                      >
                        {a.emoji}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button type="button" variant="outline" size="sm" onClick={() => setAvatarChoice("random")}>
                      Random Aether avatar
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setAvatarChoice("clear")}>
                      Clear
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="language">Preferred language</Label>
                    <Input id="language" value={language} onChange={(e) => setLanguage(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="model">Default model role</Label>
                    <Input id="model" value={model} onChange={(e) => setModel(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="style">Response style</Label>
                    <Input id="style" value={style} onChange={(e) => setStyle(e.target.value)} />
                  </div>
                  <div className="flex items-end gap-2 pb-1">
                    <input
                      id="memory"
                      type="checkbox"
                      checked={memory}
                      onChange={(e) => setMemory(e.target.checked)}
                      className="h-4 w-4 rounded border-border"
                    />
                    <Label htmlFor="memory">Memory enabled</Label>
                  </div>
                </div>

                <Button type="submit" disabled={busy}>
                  {busy ? "Saving…" : "Save profile"}
                </Button>
              </Panel>
            </form>

            <form onSubmit={onChangePassword}>
              <Panel className="space-y-4">
                <h2 className="text-sm font-semibold">Security</h2>
                <p className="text-xs text-muted-foreground">
                  Change your password while signed in. Use a strong password (at least 12 characters).
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="newPassword">New password</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      minLength={12}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="confirmPassword">Confirm password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      minLength={12}
                    />
                  </div>
                </div>
                <Button type="submit" variant="outline" disabled={pwBusy}>
                  {pwBusy ? "Updating…" : "Update password"}
                </Button>
              </Panel>
            </form>
          </>
        )}
      </div>
    </AppShell>
  );
}
