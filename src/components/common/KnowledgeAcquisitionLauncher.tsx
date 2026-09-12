import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Clock3, Globe2, Play, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/common/Primitives";
import { startKnowledgeAcquisition } from "@/lib/aether/knowledge-acquisition.functions";

export function KnowledgeAcquisitionLauncher() {
  const start = useServerFn(startKnowledgeAcquisition);
  const qc = useQueryClient();
  const [subject, setSubject] = useState("");
  const [budget, setBudget] = useState("15");
  const [sourceType, setSourceType] = useState("background");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit() {
    if (!subject.trim()) return;
    setBusy(true); setMessage("");
    try {
      const result = await start({ data: { subject, sourceType, targetType: "global", timeBudgetMs: Number(budget) * 60_000 } });
      setMessage(result.deduplicated ? "An equivalent mission is already active or waiting." : "Mission queued. Research will run within the bounded worker pool.");
      if (!result.deduplicated) setSubject("");
      await qc.invalidateQueries({ queryKey: ["aether-live-task-activity"] });
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not start acquisition."); }
    finally { setBusy(false); }
  }
  return <Panel>
    <div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary"><Sparkles className="h-4 w-4" /></span><div><h2 className="text-sm font-semibold">Knowledge Acquisition</h2><p className="mt-1 text-xs text-muted-foreground">Start a bounded research mission. It stops when its defined scope is sufficiently covered or the time budget expires.</p></div></div>
    <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px_140px_auto]"><input value={subject} onChange={(e)=>setSubject(e.target.value)} onKeyDown={(e)=>{if(e.key==="Enter")void submit();}} placeholder="Subject, concept, URL or public GitHub repository" className="rounded-md border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"/><select value={budget} onChange={(e)=>setBudget(e.target.value)} className="rounded-md border border-border bg-background px-3 py-2 text-xs"><option value="5">5 min</option><option value="10">10 min</option><option value="15">15 min (default)</option><option value="20">20 min</option><option value="30">30 min</option><option value="45">45 min</option><option value="60">60 min</option></select><select value={sourceType} onChange={(e)=>setSourceType(e.target.value)} className="rounded-md border border-border bg-background px-3 py-2 text-xs"><option value="background">Background</option><option value="url">Website URL</option><option value="github">Public GitHub</option><option value="document">Document</option><option value="prompt">Prompt</option><option value="image">Image</option></select><Button size="sm" onClick={()=>void submit()} disabled={busy||!subject.trim()}><Play className="mr-1.5 h-4 w-4"/>Start</Button></div>
    <div className="mt-3 flex items-center gap-3 text-[10px] text-muted-foreground"><span className="inline-flex items-center gap-1"><Globe2 className="h-3 w-3"/>Web research capable</span><span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3"/>Hard bounded budget</span></div>
    {message ? <p className="mt-3 rounded-md border border-border bg-muted/20 px-3 py-2 text-xs">{message}</p> : null}
  </Panel>;
}
