import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Paperclip, Globe, Brain, Send, ChevronDown, MessagesSquare } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Tag, PhaseNote, EmptyState } from "@/components/common/Primitives";
import { Button } from "@/components/ui/button";
import { AAX_MODEL_CATALOG } from "@/lib/aether/models";
import { getAaxConversation, listAaxConversations, sendAaxMessage } from "@/lib/aether/aax-chat.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({ meta: [{ title: "Chat — Aether Ascension" }, { name: "description", content: "Persistent conversations organized by Aether Ascension model generation." }] }),
  component: Page,
});

type AaxModel = (typeof AAX_MODEL_CATALOG)[number];

function Page() {
  const queryClient = useQueryClient();
  const fetchConversations = useServerFn(listAaxConversations);
  const fetchConversation = useServerFn(getAaxConversation);
  const sendMessage = useServerFn(sendAaxMessage);
  const { data: conversations = [] } = useQuery({ queryKey: ["aax-conversations"], queryFn: () => fetchConversations() });
  const [model, setModel] = useState<AaxModel>(AAX_MODEL_CATALOG[0]!);
  const [modelOpen, setModelOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [webResearch, setWebResearch] = useState(false);
  const [memory, setMemory] = useState(true);

  const { data: conversationData } = useQuery({
    queryKey: ["aax-conversation", conversationId],
    queryFn: () => fetchConversation({ data: { conversationId: conversationId! } }),
    enabled: Boolean(conversationId),
  });

  useEffect(() => {
    if (!conversationId && conversations.length > 0) {
      const first = conversations[0];
      setConversationId(first.id);
      const joined = first.aax_models as { model_key?: string } | { model_key?: string }[] | null;
      const key = Array.isArray(joined) ? joined[0]?.model_key : joined?.model_key;
      const next = AAX_MODEL_CATALOG.find((item) => item.key === key);
      if (next) setModel(next);
    }
  }, [conversationId, conversations]);

  const mutation = useMutation({
    mutationFn: (message: string) => sendMessage({ data: { conversationId: conversationId ?? undefined, modelKey: model.key, message } }),
    onSuccess: (result) => {
      setConversationId(result.conversationId);
      setInput("");
      void queryClient.invalidateQueries({ queryKey: ["aax-conversations"] });
      void queryClient.invalidateQueries({ queryKey: ["aax-conversation", result.conversationId] });
    },
  });

  const activeMessages = conversationData?.messages ?? [];
  const activeConversationTitle = useMemo(() => conversationData?.conversation.title ?? "New conversation", [conversationData]);

  function selectConversation(id: string) {
    setConversationId(id);
    const selected = conversations.find((item) => item.id === id);
    const joined = selected?.aax_models as { model_key?: string } | { model_key?: string }[] | null | undefined;
    const key = Array.isArray(joined) ? joined[0]?.model_key : joined?.model_key;
    const next = AAX_MODEL_CATALOG.find((item) => item.key === key);
    if (next) setModel(next);
  }

  function newConversation() {
    setConversationId(null);
    setInput("");
  }

  function submit() {
    const value = input.trim();
    if (!value || mutation.isPending) return;
    mutation.mutate(value);
  }

  return (
    <AppShell>
      <div className="animate-in-up -mx-5 -my-8 flex h-[calc(100vh-4rem)] flex-col lg:-mx-10 lg:-my-10 lg:h-[calc(100vh)]">
        <div className="flex min-h-0 flex-1">
          <aside className="hidden w-64 shrink-0 flex-col border-r border-border/70 bg-sidebar/40 md:flex">
            <div className="flex items-center justify-between border-b border-border/70 px-4 py-3"><span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">AAX conversations</span><Button size="icon" variant="ghost" className="h-7 w-7" onClick={newConversation} aria-label="New conversation"><Plus className="h-3.5 w-3.5" /></Button></div>
            <div className="flex-1 space-y-0.5 overflow-y-auto p-2">{conversations.length === 0 ? <p className="px-3 py-4 text-xs text-muted-foreground">No conversations yet.</p> : conversations.map((c) => <button key={c.id} type="button" onClick={() => selectConversation(c.id)} className={cn("flex w-full flex-col gap-0.5 rounded-md px-3 py-2.5 text-left transition-colors", c.id === conversationId ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground")}><span className="truncate text-sm font-medium">{c.title}</span><span className="text-[11px]">{Array.isArray(c.aax_models) ? c.aax_models[0]?.display_name : c.aax_models?.display_name} · {new Date(c.updated_at).toLocaleDateString()}</span></button>)}</div>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-3 border-b border-border/70 px-4 py-3 sm:px-6">
              <div className="relative"><button type="button" onClick={() => setModelOpen((v) => !v)} className="inline-flex items-center gap-2 rounded-lg border border-border bg-elevated/60 px-3 py-1.5 text-sm transition-colors hover:border-primary/40"><span className="font-medium">{model.name}</span><Tag tone="primary">{model.speed}</Tag><ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /></button>{modelOpen ? <div className="absolute left-0 top-full z-20 mt-1.5 w-80 rounded-lg border border-border bg-popover p-1.5 shadow-elevated">{AAX_MODEL_CATALOG.map((m) => <button key={m.key} type="button" disabled={m.status !== "available"} onClick={() => { setModel(m); setModelOpen(false); newConversation(); }} className={cn("flex w-full flex-col gap-0.5 rounded-md px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50", m.key === model.key ? "bg-primary/10 text-foreground" : "hover:bg-muted/60")}><span className="text-sm font-medium">{m.name}</span><span className="text-[11px] text-muted-foreground">{m.description}</span></button>)}</div> : null}</div>
              <span className="hidden truncate text-xs text-muted-foreground sm:block">{activeConversationTitle}</span>
              <div className="ml-auto flex items-center gap-1.5"><button type="button" onClick={() => setWebResearch((v) => !v)} className={cn("inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors", webResearch ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}><Globe className="h-3.5 w-3.5" />Web</button><button type="button" onClick={() => setMemory((v) => !v)} className={cn("inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors", memory ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}><Brain className="h-3.5 w-3.5" />Memory</button></div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
              <div className="mx-auto flex max-w-3xl flex-col gap-4">{activeMessages.length === 0 ? <div className="flex min-h-[45vh] items-center justify-center"><EmptyState title={`Start a conversation with ${model.name}`} description="Every conversation is permanently tied to its selected AAX generation. Shared Aether knowledge can evolve across the family while model-specific context stays isolated." icon={<MessagesSquare className="h-5 w-5" />} /></div> : activeMessages.map((message) => <div key={message.id} className={cn("rounded-xl border p-4 text-sm leading-relaxed", message.role === "user" ? "ml-8 border-primary/20 bg-primary/5" : "mr-8 border-border/70 bg-elevated/30")}><div className="mb-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{message.role === "user" ? "You" : model.name}</div><div className="whitespace-pre-wrap">{message.content}</div></div>)}</div>
            </div>

            <div className="border-t border-border/70 px-4 py-4 sm:px-6"><div className="mx-auto max-w-3xl"><div className="panel-elevated flex items-end gap-2 p-2 sm:p-2.5"><button type="button" className="shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Attach file"><Paperclip className="h-4 w-4" /></button><textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }} placeholder={`Message ${model.name}…`} rows={1} className="max-h-32 min-h-[40px] flex-1 resize-none bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground" /><Button size="icon" className="h-9 w-9 shrink-0" disabled={!input.trim() || mutation.isPending} onClick={submit} aria-label="Send"><Send className="h-4 w-4" /></Button></div>{mutation.isError ? <p className="mt-2 text-center text-xs text-destructive">{mutation.error instanceof Error ? mutation.error.message : "AAX could not complete this request."}</p> : <PhaseNote>Responses use only AAX models that the server has released and configured. User inputs may become learning candidates, but are never trusted as permanent knowledge automatically.</PhaseNote>}</div></div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
