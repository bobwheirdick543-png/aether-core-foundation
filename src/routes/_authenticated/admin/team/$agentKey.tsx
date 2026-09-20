import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Activity, Bot, CheckCircle2, Clock3, Plus, Send, XCircle, Play, Pencil, Trash2, FileUp } from "lucide-react";
import { AdminShell } from "@/components/layout/AdminShell";
import { PageHeader, Panel, StatCard, Tag } from "@/components/common/Primitives";
import { getAgentWorkspace } from "@/lib/admin/console.functions";
import { appendAgentConversationMessage, createAgentConversation, createOrchestration, getAgentConversation, runAgentConversationTurn, updateAgentConversationMessage, deleteAgentConversationMessage } from "@/lib/aether/orchestrator.functions";
import { adminEnqueueKnowledgeAcquisitionFromPrompt } from "@/lib/aether/knowledge-acquisition-admin.functions";

export const Route = createFileRoute("/_authenticated/admin/team/$agentKey")({
  head: () => ({
    meta: [
      { title: "Agent workstation — Aether admin" },
      { name: "description", content: "Individual internal Aether agent workstation, independent chat history and telemetry." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

const WORKFLOW_STAGES = [
  "Intake",
  "Planning",
  "Research",
  "Acquisition",
  "Verification",
  "Curation",
  "Reporting",
  "Delivery",
  "Complete",
] as const;

function ProgressiveWorkflow({ status, hasRuns }: { status: string; hasRuns: boolean }) {
  const activeIndex =
    status === "enabled" && hasRuns ? 5 : status === "enabled" ? 3 : status === "maintenance" ? 2 : 0;
  return (
    <Panel className="space-y-3">
      <div className="flex items-center gap-2">
        <Play className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Progressive workflow</h2>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Live stage strip for this agent. Real run events appear in Run history below — nothing is fabricated.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {WORKFLOW_STAGES.map((stage, i) => (
          <span
            key={stage}
            className={`rounded-md px-2 py-1 text-[10px] font-medium ${
              i < activeIndex
                ? "bg-primary/20 text-primary"
                : i === activeIndex
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {stage}
          </span>
        ))}
      </div>
    </Panel>
  );
}

function Productivity({ value }: { value: number | null }) {
  const hasData = value != null;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[11px]">
        <span className="text-muted-foreground">Productivity</span>
        <span>{hasData ? `${value.toFixed(1)}%` : "No measured data"}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${hasData ? Math.max(0, Math.min(100, value)) : 0}%` }}
        />
      </div>
    </div>
  );
}

function Page() {
  const { agentKey } = Route.useParams();
  const queryClient = useQueryClient();
  const fetchWorkspace = useServerFn(getAgentWorkspace);
  const fetchConversation = useServerFn(getAgentConversation);
  const saveMessage = useServerFn(appendAgentConversationMessage);
  const newConversation = useServerFn(createAgentConversation);
  const orchestrate = useServerFn(createOrchestration);
  const runAgentTurn = useServerFn(runAgentConversationTurn);
  const updateMessage = useServerFn(updateAgentConversationMessage);
  const binMessage = useServerFn(deleteAgentConversationMessage);
  const enqueueKa = useServerFn(adminEnqueueKnowledgeAcquisitionFromPrompt);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-agent-workspace", agentKey],
    queryFn: async () => {
      try {
        return await fetchWorkspace({ data: { agentKey } });
      } catch (e) {
        console.error("[agent-workspace]", e);
        throw e;
      }
    },
  });
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [kaPrompt, setKaPrompt] = useState("");
  const [kaDeadline, setKaDeadline] = useState("");
  const [kaBusy, setKaBusy] = useState(false);
  const [kaMsg, setKaMsg] = useState("");
  const conversationId = selectedConversation ?? data?.conversations?.[0]?.id ?? null;
  const { data: conversationData } = useQuery({
    queryKey: ["agent-conversation", conversationId],
    queryFn: () => fetchConversation({ data: { conversationId: conversationId! } }),
    enabled: Boolean(conversationId),
  });

  if (isLoading)
    return (
      <AdminShell>
        <Panel>
          <p className="text-sm text-muted-foreground">Loading agent workstation…</p>
        </Panel>
      </AdminShell>
    );
  if (error || !data)
    return (
      <AdminShell>
        <Panel className="space-y-3">
          <p className="text-sm text-destructive">This agent workstation could not be loaded.</p>
          <p className="text-xs text-muted-foreground">
            Backend registry or permissions may not be ready. You can still return to Team and try another agent.
          </p>
          <Link to="/admin/team" className="text-xs text-primary hover:underline">
            ← Back to Team
          </Link>
        </Panel>
      </AdminShell>
    );

  const { agent, permissions, tasks, runs, telemetry } = data;

  async function sendMessage() {
    const content = message.trim();
    if (!content || sending) return;
    setSending(true);
    setChatError("");
    try {
      let activeId = conversationId;
      if (!activeId) {
        const created = await newConversation({ data: { agentKey, title: content.slice(0, 80) } });
        activeId = created.id;
        setSelectedConversation(activeId);
      }
      await saveMessage({ data: { conversationId: activeId, content, role: "user" } });
      setMessage("");
      if (agentKey === "orchestrator") {
        const result = await orchestrate({ data: { message: content, conversationId: activeId } });
        const summary =
          result.status === "awaiting_approval"
            ? `I understood this as “${result.draft.intent}”. I created plan ${result.planId}, but this action requires approval before execution.`
            : `I understood this as “${result.draft.intent}”. I created plan ${result.planId} with ${result.draft.agents.length} orchestration participant(s) and routed it through the universal runtime.`;
        await saveMessage({
          data: {
            conversationId: activeId,
            content: summary,
            role: "assistant",
            metadata: { planId: result.planId, taskId: result.taskId, intent: result.draft.intent },
          },
        });
      } else {
        await runAgentTurn({ data: { conversationId: activeId, content } });
      }
      await queryClient.invalidateQueries({ queryKey: ["agent-conversation", activeId] });
      await queryClient.invalidateQueries({ queryKey: ["admin-agent-workspace", agentKey] });
    } catch (e) {
      setChatError(e instanceof Error ? e.message : "Could not send message to this agent.");
    } finally {
      setSending(false);
    }
  }

  async function startNewChat() {
    try {
      const created = await newConversation({ data: { agentKey } });
      setSelectedConversation(created.id);
      setChatError("");
      await queryClient.invalidateQueries({ queryKey: ["admin-agent-workspace", agentKey] });
    } catch (e) {
      setChatError(e instanceof Error ? e.message : "Could not start a new chat.");
    }
  }

  async function saveEdit() {
    if (!editingId || !editDraft.trim()) return;
    setSending(true);
    setChatError("");
    try {
      await updateMessage({ data: { messageId: editingId, content: editDraft.trim() } });
      setEditingId(null);
      setEditDraft("");
      await queryClient.invalidateQueries({ queryKey: ["agent-conversation", conversationId] });
    } catch (e) {
      setChatError(e instanceof Error ? e.message : "Could not edit message.");
    } finally {
      setSending(false);
    }
  }

  async function sendToBin(messageId: string) {
    if (!window.confirm("Send this message to the bin?")) return;
    setChatError("");
    try {
      await binMessage({ data: { messageId } });
      await queryClient.invalidateQueries({ queryKey: ["agent-conversation", conversationId] });
    } catch (e) {
      setChatError(e instanceof Error ? e.message : "Could not bin message.");
    }
  }

  async function submitKnowledgePrompt() {
    if (!kaPrompt.trim() || kaBusy) return;
    setKaBusy(true);
    setKaMsg("");
    try {
      const result = await enqueueKa({
        data: {
          prompt: kaPrompt.trim(),
          subject: kaPrompt.trim().slice(0, 80),
          deadlineISO: kaDeadline ? new Date(kaDeadline).toISOString() : null,
        },
      });
      setKaMsg(`Mission queued (task ${result.taskId}). Approve results from Knowledge Acquisition when ready.`);
      setKaPrompt("");
      setKaDeadline("");
      await queryClient.invalidateQueries({ queryKey: ["admin-agent-workspace", agentKey] });
    } catch (e) {
      setKaMsg(e instanceof Error ? e.message : "Could not enqueue acquisition mission.");
    } finally {
      setKaBusy(false);
    }
  }

  return (
    <AdminShell>
      <div className="animate-in-up space-y-6">
        <PageHeader
          eyebrow="Agent workstation"
          title={agent.name}
          description={agent.description}
          backFallback="/admin/team"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Tag tone={agent.status === "enabled" ? "success" : "neutral"}>{agent.status}</Tag>
          <span className="font-mono text-xs text-muted-foreground">{agent.agent_key}</span>
          <Link to="/admin/agents" className="ml-auto text-xs text-primary hover:underline">
            ← Agents control plane
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Runs" value={String(telemetry.totalRuns)} />
          <StatCard label="Succeeded" value={String(telemetry.succeeded)} />
          <StatCard label="Failed" value={String(telemetry.failed)} />
          <StatCard label="Waiting approval" value={String(telemetry.waiting)} />
          <StatCard
            label="Avg duration"
            value={telemetry.avgDurationMs == null ? "No data" : `${Math.round(telemetry.avgDurationMs / 1000)}s`}
          />
        </div>

        <ProgressiveWorkflow status={agent.status} hasRuns={runs.length > 0} />

        {agentKey === "knowledge-acquisition" ? (
          <Panel className="space-y-3">
            <div className="flex items-center gap-2">
              <FileUp className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Knowledge intake</h2>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Submit a research prompt (and optional stop time). The mission is durable server-side. When the
              window ends or the job finishes, approve on the Knowledge Acquisition page before knowledge becomes
              global for AAX API keys.
            </p>
            <textarea
              value={kaPrompt}
              onChange={(e) => setKaPrompt(e.target.value)}
              rows={4}
              placeholder="What should this agent research and learn?"
              className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-[11px] text-muted-foreground">
                Optional deadline
                <input
                  type="datetime-local"
                  value={kaDeadline}
                  onChange={(e) => setKaDeadline(e.target.value)}
                  className="mt-1 block h-9 rounded-md border border-border bg-background px-2 text-xs"
                />
              </label>
              <button
                type="button"
                disabled={kaBusy || !kaPrompt.trim()}
                onClick={() => void submitKnowledgePrompt()}
                className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                {kaBusy ? "Queuing…" : "Enqueue mission"}
              </button>
              <Link
                to="/admin/knowledge-acquisition"
                className="rounded-md border px-3 py-2 text-xs hover:bg-muted"
              >
                Open approval queue
              </Link>
            </div>
            {kaMsg ? <p className="text-xs text-muted-foreground">{kaMsg}</p> : null}
          </Panel>
        ) : null}

        <Panel>
          <Productivity
            value={
              data.productivity?.productivity_percent == null
                ? null
                : Number(data.productivity.productivity_percent)
            }
          />
        </Panel>

        <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
          <Panel className="h-fit space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Chat history</h2>
              <button
                type="button"
                onClick={() => void startNewChat()}
                className="rounded-md border border-border p-1.5 hover:bg-muted"
                title="New chat"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Each chat is isolated. Edit or bin messages from the thread.
            </p>
            <div className="space-y-1">
              {(data.conversations ?? []).map((chat: any) => (
                <button
                  key={chat.id}
                  type="button"
                  onClick={() => setSelectedConversation(chat.id)}
                  className={`w-full rounded-md px-2.5 py-2 text-left text-xs ${
                    conversationId === chat.id ? "bg-muted font-medium" : "hover:bg-muted/60"
                  }`}
                >
                  <span className="block truncate">{chat.title}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {chat.last_message_at ? new Date(chat.last_message_at).toLocaleString() : "Empty chat"}
                  </span>
                </button>
              ))}
              {(data.conversations ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground">No chats yet. Type below to start one.</p>
              )}
            </div>
          </Panel>

          <Panel className="flex min-h-[520px] flex-col">
            <div className="border-b border-border/60 pb-3">
              <h2 className="text-sm font-semibold">{conversationData?.conversation.title ?? "New chat"}</h2>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Independent {agent.name} conversation · Open chat / workstation
              </p>
            </div>
            <div className="flex-1 space-y-3 overflow-auto py-4">
              {(conversationData?.messages ?? []).map((m: any) => (
                <div
                  key={m.id}
                  className={`group max-w-[90%] rounded-lg border border-border/60 p-3 text-xs ${
                    m.role === "user" ? "ml-auto bg-muted" : "mr-auto"
                  }`}
                >
                  <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    <span>{m.role}</span>
                    {m.metadata?.edited ? <span className="normal-case opacity-70">(edited)</span> : null}
                    <span className="ml-auto flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      {m.role === "user" && (
                        <button
                          type="button"
                          title="Edit"
                          className="rounded p-0.5 hover:bg-background"
                          onClick={() => {
                            setEditingId(m.id);
                            setEditDraft(m.content);
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      )}
                      <button
                        type="button"
                        title="Send to bin"
                        className="rounded p-0.5 hover:bg-background"
                        onClick={() => void sendToBin(m.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </span>
                  </div>
                  {editingId === m.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        rows={3}
                        className="w-full resize-none rounded border border-border bg-background px-2 py-1.5 text-xs outline-none"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={sending || !editDraft.trim()}
                          onClick={() => void saveEdit()}
                          className="rounded bg-primary px-2 py-1 text-[10px] font-medium text-primary-foreground disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(null);
                            setEditDraft("");
                          }}
                          className="rounded border px-2 py-1 text-[10px]"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  )}
                </div>
              ))}
              {!conversationId && (
                <div className="flex h-full items-center justify-center text-center text-xs text-muted-foreground">
                  Type a message below — the composer is always available.
                </div>
              )}
            </div>
            <div className="space-y-2 border-t border-border/60 pt-3">
              {chatError && <p className="text-xs text-destructive">{chatError}</p>}
              <div className="flex gap-2">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendMessage();
                    }
                  }}
                  placeholder={`Talk to ${agent.name}…`}
                  rows={2}
                  disabled={sending}
                  className="min-h-12 flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => void sendMessage()}
                  disabled={sending || !message.trim()}
                  className="self-end rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
                >
                  <Send className="mr-1 inline h-3.5 w-3.5" />
                  {sending ? "Working…" : "Send"}
                </button>
              </div>
            </div>
          </Panel>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold">Mission</h2>
              <p className="mt-1 text-xs text-muted-foreground">{agent.purpose}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Tools</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(agent.tools ?? []).map((tool: string) => (
                  <Tag key={tool} tone="primary">
                    {tool}
                  </Tag>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Permissions</p>
              <div className="mt-2 space-y-1.5">
                {permissions.map((permission: any) => (
                  <div
                    key={permission.permission}
                    className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-xs"
                  >
                    <span>{permission.permission}</span>
                    <Tag
                      tone={
                        permission.allowed
                          ? permission.requires_approval
                            ? "warning"
                            : "success"
                          : "neutral"
                      }
                    >
                      {permission.allowed
                        ? permission.requires_approval
                          ? "approval"
                          : "allowed"
                        : "denied"}
                    </Tag>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
          <Panel>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              <h2 className="text-sm font-semibold">Execution analysis</h2>
            </div>
            <div className="mt-4 space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last activity</span>
                <span>{agent.last_activity_at ? new Date(agent.last_activity_at).toLocaleString() : "No activity"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Recorded tasks</span>
                <span>{tasks.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Recorded runs shown</span>
                <span>{runs.length}</span>
              </div>
            </div>
          </Panel>
        </div>

        <Panel>
          <div className="flex items-center gap-2">
            <Clock3 className="h-4 w-4" />
            <h2 className="text-sm font-semibold">Tasks</h2>
          </div>
          <div className="mt-4 space-y-2">
            {tasks.length === 0 ? (
              <p className="text-xs text-muted-foreground">No tasks have been recorded for this agent.</p>
            ) : (
              tasks.map((task: any) => (
                <div key={task.id} className="rounded-md border border-border/60 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium">{task.title}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{task.kind}</p>
                    </div>
                    <Tag tone="neutral">{task.status}</Tag>
                  </div>
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    Progress: {task.progress}% · Created {new Date(task.created_at).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel>
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            <h2 className="text-sm font-semibold">Run history & outputs</h2>
          </div>
          <div className="mt-4 space-y-3">
            {runs.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No execution data recorded yet. This workstation will populate from real runs.
              </p>
            ) : (
              runs.map((run: any) => (
                <div key={run.id} className="rounded-md border border-border/60 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs font-medium">
                      {run.status === "completed" ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : run.status === "failed" ? (
                        <XCircle className="h-3.5 w-3.5" />
                      ) : (
                        <Activity className="h-3.5 w-3.5" />
                      )}
                      {run.status}
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(run.created_at).toLocaleString()}
                    </span>
                  </div>
                  {run.error ? <p className="mt-2 text-xs text-destructive">{run.error}</p> : null}
                  {run.outputs ? (
                    <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted/30 p-2 text-[10px] text-muted-foreground">
                      {JSON.stringify(run.outputs, null, 2)}
                    </pre>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </Panel>

        <Link to="/admin/team" className="inline-flex text-xs text-primary hover:underline">
          ← Back to Team
        </Link>
      </div>
    </AdminShell>
  );
}
