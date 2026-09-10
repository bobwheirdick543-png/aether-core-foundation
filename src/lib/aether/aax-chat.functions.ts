import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { executeAaxChat } from "./aax-gateway";

const MAX_HISTORY_MESSAGES = 40;
const MAX_MESSAGE_CHARS = 32_000;

export const listAaxConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("aax_conversations")
      .select("id, model_id, title, archived, last_message_at, created_at, updated_at, aax_models(model_key, display_name, generation, revision)")
      .eq("archived", false)
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) throw new Response(`Could not load conversations: ${error.message}`, { status: 500 });
    return data ?? [];
  });

export const getAaxConversation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const conversationId = String((data as { conversationId?: string })?.conversationId ?? "");
    if (!conversationId) throw new Response("conversationId is required", { status: 400 });

    const { data: conversation, error: conversationError } = await context.supabase
      .from("aax_conversations")
      .select("id, model_id, title, archived, aax_models(model_key, display_name, generation, revision)")
      .eq("id", conversationId)
      .maybeSingle();
    if (conversationError || !conversation) throw new Response("Conversation not found", { status: 404 });

    const { data: messages, error: messageError } = await context.supabase
      .from("aax_conversation_messages")
      .select("id, role, content, metadata, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    if (messageError) throw new Response(`Could not load messages: ${messageError.message}`, { status: 500 });
    return { conversation, messages: messages ?? [] };
  });

export const sendAaxMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const input = data as {
      conversationId?: string;
      modelKey?: string;
      message?: string;
      temperature?: number;
      maxOutputTokens?: number;
    };
    const message = input.message?.trim() ?? "";
    if (!message) throw new Response("Message is required", { status: 400 });
    if (message.length > MAX_MESSAGE_CHARS) throw new Response("Message is too large", { status: 413 });

    let conversationId = input.conversationId?.trim() || null;
    let modelKey = input.modelKey?.trim() || null;

    if (conversationId) {
      const { data: conversation, error } = await context.supabase
        .from("aax_conversations")
        .select("id, model_id, aax_models(model_key)")
        .eq("id", conversationId)
        .maybeSingle();
      if (error || !conversation) throw new Response("Conversation not found", { status: 404 });
      const joined = conversation.aax_models as { model_key?: string } | { model_key?: string }[] | null;
      const resolvedKey = Array.isArray(joined) ? joined[0]?.model_key : joined?.model_key;
      if (!resolvedKey) throw new Response("Conversation model is invalid", { status: 409 });
      modelKey = resolvedKey;
    }
    if (!modelKey) throw new Response("AAX model is required", { status: 400 });

    if (!conversationId) {
      const { data: model, error: modelError } = await supabaseAdmin
        .from("aax_models")
        .select("id, model_key")
        .eq("model_key", modelKey)
        .maybeSingle();
      if (modelError || !model) throw new Response("AAX model not found", { status: 404 });
      const { data: created, error } = await supabaseAdmin
        .from("aax_conversations")
        .insert({ owner_id: context.userId, model_id: model.id, title: message.slice(0, 80) || "New conversation" })
        .select("id")
        .single();
      if (error || !created) throw new Response(`Could not create conversation: ${error?.message ?? "unknown error"}`, { status: 500 });
      conversationId = created.id;
    }

    const { data: ownedConversation, error: ownershipError } = await context.supabase
      .from("aax_conversations")
      .select("id, model_id, aax_models(model_key)")
      .eq("id", conversationId)
      .maybeSingle();
    if (ownershipError || !ownedConversation) throw new Response("Conversation not found", { status: 404 });

    const { data: history, error: historyError } = await supabaseAdmin
      .from("aax_conversation_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(MAX_HISTORY_MESSAGES);
    if (historyError) throw new Response(`Could not load conversation history: ${historyError.message}`, { status: 500 });

    const userMessage = await supabaseAdmin
      .from("aax_conversation_messages")
      .insert({ conversation_id: conversationId, owner_id: context.userId, model_id: ownedConversation.model_id, role: "user", content: message })
      .select("id")
      .single();
    if (userMessage.error || !userMessage.data) throw new Response(`Could not persist message: ${userMessage.error?.message ?? "unknown error"}`, { status: 500 });

    const messages = [...(history ?? []).reverse(), { role: "user" as const, content: message }];
    const response = await executeAaxChat(supabaseAdmin, {
      modelKey: modelKey!,
      messages: messages.map((item) => ({ role: item.role as "user" | "assistant", content: item.content })),
      temperature: input.temperature,
      maxOutputTokens: input.maxOutputTokens,
      telemetry: { userId: context.userId, kind: "aax.chat" },
    });

    const assistantMessage = await supabaseAdmin
      .from("aax_conversation_messages")
      .insert({ conversation_id: conversationId, owner_id: context.userId, model_id: response.modelId, role: "assistant", content: response.content, metadata: { provider: response.provider, providerModel: response.providerModel, tokensIn: response.tokensIn, tokensOut: response.tokensOut, latencyMs: response.latencyMs } })
      .select("id")
      .single();
    if (assistantMessage.error) throw new Response(`Could not persist assistant response: ${assistantMessage.error.message}`, { status: 500 });

    await supabaseAdmin.from("aax_conversations").update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", conversationId);

    // User input becomes a learning candidate, never trusted knowledge. Verification/curation decides later.
    await supabaseAdmin.from("agent_learning_records").insert({
      agent_key: "knowledge-acquisition",
      source_agent_key: "aax",
      owner_id: context.userId,
      source_type: "conversation",
      source_id: userMessage.data.id,
      candidate: { modelKey, conversationId, message, assistantResponseId: assistantMessage.data?.id ?? null },
      status: "candidate",
    });

    return { conversationId, modelKey: response.modelKey, message: { id: assistantMessage.data?.id ?? null, role: "assistant", content: response.content, metadata: { provider: response.provider, providerModel: response.providerModel, tokensIn: response.tokensIn, tokensOut: response.tokensOut, latencyMs: response.latencyMs } } };
  });
