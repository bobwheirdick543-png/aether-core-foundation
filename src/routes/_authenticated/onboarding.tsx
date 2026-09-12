import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AetherMark } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateMyProfile } from "@/lib/auth/profile.functions";
import { createAetherProject } from "@/lib/aether/aether-project.functions";
import { AAX_MODEL_CATALOG } from "@/lib/aether/models";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Welcome to Aether" }, { name: "description", content: "Set up your Aether workspace." }] }),
  component: Page,
});

const MODEL_CHOICES = AAX_MODEL_CATALOG.filter((model) => model.status === "available");
const STYLES = ["balanced", "concise", "detailed"] as const;

function Page() {
  const navigate = useNavigate();
  const save = useServerFn(updateMyProfile);
  const createProject = useServerFn(createAetherProject);
  const [displayName, setDisplayName] = useState("");
  const [language, setLanguage] = useState("en");
  const [model, setModel] = useState(MODEL_CHOICES[0]?.key ?? "aax-3.1");
  const [style, setStyle] = useState<(typeof STYLES)[number]>("balanced");
  const [memory, setMemory] = useState(true);
  const [projectName, setProjectName] = useState("");
  const [busy, setBusy] = useState(false);

  async function finish(e: React.FormEvent) {
    e.preventDefault();
    const name = displayName.trim();
    if (!name) { toast.error("Add a display name to continue."); return; }
    setBusy(true);
    try {
      const profile = await save({ data: { displayName: name, preferredLanguage: language.trim() || "en", defaultModel: model, responseStyle: style, memoryEnabled: memory, onboardingCompleted: true } });
      if (!profile.ok) { toast.error(profile.message); return; }
      if (projectName.trim()) {
        try { await createProject({ data: { name: projectName.trim().slice(0, 120), description: "Created during Aether onboarding." } }); }
        catch (error) { toast.error(error instanceof Error ? error.message : "Profile saved, but the project could not be created."); }
      }
      toast.success("Your Aether workspace is ready.");
      navigate({ to: "/dashboard", replace: true });
    } finally { setBusy(false); }
  }

  return <div className="min-h-screen bg-background px-5 py-12 sm:py-20"><div className="mx-auto w-full max-w-2xl animate-in-up"><div className="flex items-center gap-3"><AetherMark className="h-8 w-8 text-primary" /><div><p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">Aether</p><p className="text-xs text-muted-foreground">Workspace setup</p></div></div><div className="mt-10"><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Make Aether yours.</h1><p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">Set your identity and response preferences once. These choices are saved to your Aether profile and can be changed later in Settings.</p></div>
    <form onSubmit={finish} className="mt-8 space-y-5">
      <section className="panel space-y-4 p-5"><h2 className="text-sm font-semibold">1. Identity</h2><div className="space-y-1.5"><Label htmlFor="displayName">Display name</Label><Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={80} placeholder="How should Aether address you?" required /></div><div className="space-y-1.5"><Label htmlFor="language">Preferred language</Label><Input id="language" value={language} onChange={(e) => setLanguage(e.target.value)} maxLength={16} placeholder="en" /></div></section>
      <section className="panel space-y-4 p-5"><h2 className="text-sm font-semibold">2. Aether Ascension</h2><p className="text-xs text-muted-foreground">Choose your preferred AAX generation. Only released generations can be selected for execution.</p><div className="grid gap-2 sm:grid-cols-2">{(MODEL_CHOICES.length ? MODEL_CHOICES : AAX_MODEL_CATALOG).map((m) => <button key={m.key} type="button" disabled={m.status !== "available"} onClick={() => setModel(m.key)} className={`rounded-lg border p-3 text-left transition-colors ${model === m.key ? "border-primary bg-primary/10" : "border-border hover:bg-muted/30"} ${m.status !== "available" ? "cursor-not-allowed opacity-50" : ""}`}><span className="block text-sm font-medium">{m.name}</span><span className="mt-1 block text-xs text-muted-foreground">{m.status === "available" ? m.description : "Not released yet."}</span></button>)}</div></section>
      <section className="panel space-y-4 p-5"><h2 className="text-sm font-semibold">3. Response style</h2><div className="grid grid-cols-3 gap-2">{STYLES.map((value) => <button key={value} type="button" onClick={() => setStyle(value)} className={`rounded-lg border px-3 py-2 text-sm capitalize ${style === value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/30"}`}>{value}</button>)}</div><label className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm"><input type="checkbox" checked={memory} onChange={(e) => setMemory(e.target.checked)} className="h-4 w-4" /><span><span className="block font-medium">Enable memory</span><span className="block text-xs text-muted-foreground">Allow authorized Aether memory features to use your saved context.</span></span></label></section>
      <section className="panel space-y-4 p-5"><h2 className="text-sm font-semibold">4. Your first project</h2><p className="text-xs text-muted-foreground">Optional. Create a project now or leave this blank and create one later.</p><div className="space-y-1.5"><Label htmlFor="projectName">Project name</Label><Input id="projectName" value={projectName} onChange={(e) => setProjectName(e.target.value)} maxLength={120} placeholder="e.g. My workspace" /></div></section>
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">You can change these choices later in Settings.</p><Button type="submit" disabled={busy}>{busy ? "Setting up…" : "Enter Aether"}</Button></div>
    </form></div></div>;
}
