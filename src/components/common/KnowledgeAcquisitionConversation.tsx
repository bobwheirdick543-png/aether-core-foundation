import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel, Tag } from "@/components/common/Primitives";
import { getKnowledgeAcquisitionConversation, sendKnowledgeAcquisitionMessage } from "@/lib/aether/knowledge-acquisition-control.functions";

type Props = { jobId: string };

export function KnowledgeAcquisitionConversation({ jobId }: Props) {
  const qc = useQueryClient();
  const load = useServerFn(getKnowledgeAcquisitionConversation);
  const send = useServerFn(sendKnowledgeAcquisitionMessage);
  const [message, setMessage] = useState("");
  const [aspectId, setAspectId] = useState("");
  const [busy, setBusy] = useState(false);
  const { data } = useQuery({
    queryKey: ["knowledge-acquisition-conversation", jobId],
    queryFn: () => load({ data: { jobId } }),
    refetchInterval: 4000,
  });

  const latestResearchEvent = useMemo(
    () => (data?.messages ?? []).filter((m: any) => m.action_type === "message" || m.action_type === "continue_aspect").at(-1),
    [data],
  );

  async function sendMessage(text: string, action = "message", minutes = 5) {
    const content = text.trim();
    if (!content) return;
    setBusy(true);
    try {
      await send({ data: { jobId, message: content, action, minutes, aspectId: aspectId || undefined } });
      setMessage("");
      await qc.invalidateQueries({ queryKey: ["knowledge-acquisition-conversation", jobId] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Research agent control</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            This conversation is persisted. Commands change the durable research task; they do not simulate progress.
          </p>
        </div>
        <Tag>{data?.job?.status ?? "loading"}</Tag>
      </div>

      <div className="mt-4 max-h-72 space-y-2 overflow-auto rounded-md border p-3">
        {(data?.messages ?? []).length ? (
          (Array.isArray(data?.messages) ? data.messages : []).map((m: any) => (
            <div key={m.id} className={m.sender_type === "user" ? "ml-8 rounded-md bg-muted p-2 text-xs" : "mr-8 rounded-md border p-2 text-xs"}>
              <div className="mb-1 flex items-center gap-2">
                <Tag>{m.sender_type}</Tag>
                <span className="text-[10px] text-muted-foreground">{new Date(m.created_at).toLocaleString()}</span>
              </div>
              <p className="whitespace-pre-wrap">{m.content}</p>
            </div>
          ))
        ) : (
          <p className="text-xs text-muted-foreground">No control messages yet.</p>
        )}
        {latestResearchEvent ? <p className="text-[10px] text-muted-foreground">Latest control instruction is persisted above.</p> : null}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_180px]">
        <Input value={aspectId} onChange={(e) => setAspectId(e.target.value)} placeholder="Optional aspect id (e.g. capabilities)" />
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1" disabled={busy} onClick={() => void sendMessage("Give it five more minutes.", "extend_time", 5)}>
            +5 min
          </Button>
          <Button type="button" variant="outline" className="flex-1" disabled={busy || !aspectId.trim()} onClick={() => void sendMessage(`Continue the research on aspect: ${aspectId.trim()}`, "extend_time", 5)}>
            Continue
          </Button>
        </div>
      </div>

      <div className="mt-2 flex gap-2">
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tell the research agent what to refine or continue…"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void sendMessage(message);
            }
          }}
          disabled={busy}
        />
        <Button type="button" disabled={busy || !message.trim()} onClick={() => void sendMessage(message)}>
          Send
        </Button>
      </div>
    </Panel>
  );
}