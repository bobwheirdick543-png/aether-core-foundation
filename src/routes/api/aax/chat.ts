import { createFileRoute } from "@tanstack/react-router";
import { requireSupabaseAuthRequest } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { executeAaxChatStream } from "@/lib/aether/aax-gateway";
import { executeAaxConversationTurn, prepareAaxStreamingTurn, completeAaxStreamingTurn } from "@/lib/aether/aax-chat.functions";
import { getAetherMemoryContext } from "@/lib/aether/aether-memory.functions";
import { createKnowledgeAcquisitionTask } from "@/lib/aether/knowledge-acquisition-runtime";

const sse = (type: string, data: unknown) => `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;

export const Route = createFileRoute("/api/aax/chat")({
  server: {
    middleware: [requireSupabaseAuthRequest],
    handlers: {
      POST: async ({ request, context }) => {
        const body = await request.json() as { conversationId?: string; modelKey?: string; message?: string; projectId?: string | null; attachmentIds?: string[]; regenerateMessageId?: string; webResearch?: boolean; memoryEnabled?: boolean; temperature?: number; maxOutputTokens?: number };
        if (body.webResearch) {
          const result = await executeAaxConversationTurn(supabaseAdmin, { ...body, userId: context.userId, signal: request.signal });
          if (body.message?.trim() && !body.regenerateMessageId) void createKnowledgeAcquisitionTask(supabaseAdmin, { ownerId: context.userId, subject: body.message.trim(), projectId: body.projectId ?? null, sourceType: "background", targetType: "global", trigger: "chat_web_research" }).catch(() => undefined);
          const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(sse("research", { status: "completed", sourceCount: result.sources.length }))); controller.enqueue(new TextEncoder().encode(sse("done", result))); controller.close(); } });
          return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
        }
        const prepared = await prepareAaxStreamingTurn(supabaseAdmin, { ...body, userId: context.userId });
        const { data: conversation } = await supabaseAdmin.from("aax_conversations").select("project_id,memory_enabled").eq("id", prepared.conversationId).eq("owner_id", context.userId).maybeSingle();
        const memoryEnabled = body.memoryEnabled ?? conversation?.memory_enabled ?? true;
        let memoryBlock = "";
        if (memoryEnabled) {
          try {
            const mem = await getAetherMemoryContext(supabaseAdmin, { ownerId: context.userId, projectId: prepared.conversation.project_id ?? body.projectId ?? null, query: body.message ?? "" });
            memoryBlock = typeof mem === "string" ? mem : JSON.stringify(mem);
          } catch {
            memoryBlock = "";
          }
        }
        const messages = prepared.messages.map((m: { role: string; content: string }) => ({ role: m.role, content: m.content }));
        if (memoryBlock) {
          messages.unshift({ role: "system", content: `Relevant Aether memory context:\n${memoryBlock}` });
        }
        const abortController = new AbortController();
        const abortFromRequest = () => abortController.abort();
        request.signal.addEventListener("abort", abortFromRequest);
        let poll: ReturnType<typeof setInterval> | undefined;
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            const send = (type: string, data: unknown) => controller.enqueue(encoder.encode(sse(type, data)));
            send("start", { conversationId: prepared.conversationId, runId: prepared.runId, userMessageId: prepared.userMessageId });
            poll = setInterval(async () => { const { data } = await supabaseAdmin.from("aax_chat_generation_runs").select("status").eq("id", prepared.runId).eq("owner_id", context.userId).maybeSingle(); if (data?.status === "cancelled") abortController.abort(); }, 500);
            try {
              const response = await executeAaxChatStream(supabaseAdmin, { modelKey: prepared.modelKey, messages, signal: abortController.signal, telemetry: { userId: context.userId, runId: prepared.runId, kind: "aax.chat.stream" } }, (token) => send("token", { token }));
              const assistantMessageId = await completeAaxStreamingTurn(supabaseAdmin, prepared, response);
              if (body.message?.trim() && !body.regenerateMessageId && body.webResearch) void createKnowledgeAcquisitionTask(supabaseAdmin, { ownerId: context.userId, subject: body.message.trim(), projectId: prepared.conversation.project_id ?? null, sourceType: "background", targetType: "global", trigger: "chat_web_research" }).catch(() => undefined);
              send("done", { conversationId: prepared.conversationId, runId: prepared.runId, userMessageId: prepared.userMessageId, assistantMessageId, content: response.content, sources: [] });
            } catch (error) {
              const cancelled = abortController.signal.aborted;
              await supabaseAdmin.from("aax_chat_generation_runs").update({ status: cancelled ? "cancelled" : "failed", completed_at: new Date().toISOString(), error: cancelled ? "Cancelled by user" : error instanceof Error ? error.message : String(error) }).eq("id", prepared.runId).eq("owner_id", context.userId);
              send(cancelled ? "cancelled" : "error", { runId: prepared.runId, message: cancelled ? "Generation stopped." : error instanceof Error ? error.message : "Generation failed." });
            } finally { if (poll) clearInterval(poll); request.signal.removeEventListener("abort", abortFromRequest); controller.close(); }
          },
          cancel() { abortController.abort(); if (poll) clearInterval(poll); },
        });
        return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
      },
    },
  },
});
