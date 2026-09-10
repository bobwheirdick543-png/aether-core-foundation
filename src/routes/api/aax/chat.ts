import { createFileRoute } from "@tanstack/react-router";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { executeAaxChatStream } from "@/lib/aether/aax-gateway";
import { executeAaxConversationTurn, prepareAaxStreamingTurn, completeAaxStreamingTurn } from "@/lib/aether/aax-chat.functions";

const sse = (type: string, data: unknown) => `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;

export const Route = createFileRoute("/api/aax/chat")({
  server: {
    middleware: [requireSupabaseAuth],
    handlers: {
      POST: async ({ request, context }) => {
        const body = await request.json() as { conversationId?: string; modelKey?: string; message?: string; projectId?: string | null; attachmentIds?: string[]; regenerateMessageId?: string; webResearch?: boolean; memoryEnabled?: boolean; temperature?: number; maxOutputTokens?: number };
        if (body.webResearch) {
          const result = await executeAaxConversationTurn(supabaseAdmin, { ...body, userId: context.userId, signal: request.signal });
          const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(sse("research", { status: "completed", sourceCount: result.sources.length }))); controller.enqueue(new TextEncoder().encode(sse("done", result))); controller.close(); } });
          return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
        }
        const prepared = await prepareAaxStreamingTurn(supabaseAdmin, { ...body, userId: context.userId });
        const abortController = new AbortController();
        const abortFromRequest = () => abortController.abort();
        request.signal.addEventListener("abort", abortFromRequest, { once: true });
        let poll: ReturnType<typeof setInterval> | undefined;
        const stream = new ReadableStream({
          async start(controller) {
            const encoder = new TextEncoder();
            const send = (type: string, data: unknown) => controller.enqueue(encoder.encode(sse(type, data)));
            send("start", { conversationId: prepared.conversationId, runId: prepared.runId, userMessageId: prepared.userMessageId });
            poll = setInterval(async () => { const { data } = await supabaseAdmin.from("aax_chat_generation_runs").select("status").eq("id", prepared.runId).eq("owner_id", context.userId).maybeSingle(); if (data?.status === "cancelled") abortController.abort(); }, 500);
            try {
              const response = await executeAaxChatStream(supabaseAdmin, { modelKey: prepared.modelKey, messages: prepared.messages, signal: abortController.signal, telemetry: { userId: context.userId, runId: prepared.runId, kind: "aax.chat.stream" } }, (token) => send("token", { token }));
              const assistantMessageId = await completeAaxStreamingTurn(supabaseAdmin, prepared, response);
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
