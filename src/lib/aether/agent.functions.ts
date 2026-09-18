/** Phase M — authenticated Agent SDK control-plane functions. All mutations are server/admin guarded. */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { AGENTS, type AgentKey } from "./agents";
import { mergeStaticContract, makeVersionHash, validateAgentDefinition } from "./agent-registry";
import { authorizeAgentAction, appendAgentMessage, requestAgentHandoff, openAgentSandbox } from "./agent-runtime";

const db = supabaseAdmin as any;

async function assertAdmin(userId: string) {
  const { data, error } = await db.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) throw new Response("Administrator authorization required", { status: 403 });
}

function nextPatchVersion(version: string | null | undefined): string {
  const match = String(version || "").match(/^(\\d+)\\.(\\d+)\\.(\\d+)$/);
  if (!match) return "1.0.0";
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
}

function keyOf(value: unknown): AgentKey {
  const key = String(value || "") as AgentKey;
  if (!AGENTS.some((agent) => agent.key === key)) throw new Response("Unknown agent", { status: 400 });
  return key;
}

export const getAgentControlPlane = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);

    const [
      { data: agents, error: agentsError },
      { data: versions, error: versionsError },
      { data: permissions, error: permissionsError },
      { data: history, error: historyError },
      { data: workers, error: workersError },
      { data: runs, error: runsError },
      { data: handoffs, error: handoffsError },
      { data: messages, error: messagesError },
    ] = await Promise.all([
      db.from("agents")
        .select("id,agent_key,name,description,purpose,status,tools,config,last_activity_at,created_at,updated_at")
        .order("name"),
      db.from("agent_versions")
        .select("id,agent_id,version,lifecycle_state,definition,config_hash,parent_version_id,created_by,validated_by,tested_by,activated_by,created_at,validated_at,tested_at,activated_at,retired_at,rollback_reason")
        .order("created_at", { ascending: false }),
      db.from("agent_permissions")
        .select("id,agent_id,permission,allowed,requires_approval,created_at"),
      db.from("agent_config_history")
        .select("id,agent_id,version_id,action,reason,actor_id,created_at")
        .order("created_at", { ascending: false })
        .limit(500),
      db.from("runtime_workers")
        .select("worker_id,status,current_run_id,last_heartbeat_at,started_at,updated_at,metadata")
        .order("updated_at", { ascending: false }),
      db.from("task_runs")
        .select("id,task_id,agent_id,agent_key,status,worker_id,attempt,started_at,ended_at,created_at,updated_at,error,failure_code")
        .not("agent_key", "is", null)
        .order("created_at", { ascending: false })
        .limit(250),
      db.from("agent_handoffs")
        .select("id,task_id,run_id,from_agent,to_agent,status,message_id,payload,rejection_reason,created_at,accepted_at,completed_at")
        .order("created_at", { ascending: false })
        .limit(100),
      db.from("agent_messages")
        .select("id,task_id,run_id,from_agent,to_agent,message_type,payload,sequence,correlation_id,created_at")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    if (
      agentsError ||
      versionsError ||
      permissionsError ||
      historyError ||
      workersError ||
      runsError ||
      handoffsError ||
      messagesError
    ) {
      throw new Response("Could not load agent control plane", { status: 500 });
    }

    return {
      agents: agents ?? [],
      versions: versions ?? [],
      permissions: permissions ?? [],
      history: history ?? [],
      runtime: {
        workers: workers ?? [],
        runs: runs ?? [],
        handoffs: handoffs ?? [],
        messages: messages ?? [],
      },
    };
  });

export const createAgentVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) => ({
    agentKey: keyOf(input?.agentKey),
    version: String(input?.version || ""),
    definition: input?.definition && typeof input.definition === "object" ? input.definition : {},
    reason: input?.reason ? String(input.reason) : null,
  }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    if (!/^\d+\.\d+\.\d+$/.test(data.version.trim())) {
      throw new Response("Version must use semver", { status: 400 });
    }

    const definition = mergeStaticContract(data.agentKey, data.definition as any);
    definition.version = data.version.trim();
    definition.agent_id = `agent_${data.agentKey}`;

    const validation = validateAgentDefinition(definition);
    if (!validation.ok) throw new Response(validation.message, { status: 400 });

    const { data: agent, error: agentError } = await db
      .from("agents")
      .select("id")
      .eq("agent_key", data.agentKey)
      .single();

    if (agentError || !agent) throw new Response("Agent not found", { status: 404 });

    const { data: parent } = await db
      .from("agent_versions")
      .select("id")
      .eq("agent_id", agent.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: row, error } = await db
      .from("agent_versions")
      .insert({
        agent_id: agent.id,
        version: data.version.trim(),
        lifecycle_state: "draft",
        definition,
        config_hash: makeVersionHash(definition),
        parent_version_id: parent?.id ?? null,
        created_by: context.userId,
      })
      .select("*")
      .single();

    if (error || !row) throw new Response(error?.message ?? "Could not create version", { status: 500 });

    await db.from("agent_config_history").insert({
      agent_id: agent.id,
      version_id: row.id,
      action: "created",
      after_config: definition,
      actor_id: context.userId,
      reason: data.reason,
    });

    return row;
  });

async function transition(
  contextUserId: string,
  versionId: string,
  target: string,
  reason?: string | null,
) {
  await assertAdmin(contextUserId);
  const { data, error } = await db.rpc("agent_lifecycle_transition", {
    p_version_id: versionId,
    p_target_state: target,
    p_actor_id: contextUserId,
    p_reason: reason ?? null,
  });
  if (error || !data) throw new Response(error?.message ?? "Lifecycle transition failed", { status: 409 });
  return data;
}

export const validateAgentVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { versionId: string }) => input)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { data: version, error } = await db
      .from("agent_versions")
      .select("id,definition,lifecycle_state")
      .eq("id", data.versionId)
      .single();

    if (error || !version) throw new Response("Agent version not found", { status: 404 });
    if (version.lifecycle_state !== "draft") {
      throw new Response("Only draft versions can be validated", { status: 409 });
    }

    const result = validateAgentDefinition(version.definition);
    if (!result.ok) throw new Response(result.message, { status: 400 });
    return transition(context.userId, data.versionId, "validated", "Contract validation passed");
  });

export const testAgentVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { versionId: string }) => input)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { data: version, error } = await db
      .from("agent_versions")
      .select("id,definition,lifecycle_state")
      .eq("id", data.versionId)
      .single();

    if (error || !version) throw new Response("Agent version not found", { status: 404 });
    if (version.lifecycle_state !== "validated") {
      throw new Response("Only validated versions can be tested", { status: 409 });
    }

    const result = validateAgentDefinition(version.definition);
    if (!result.ok) throw new Response(result.message, { status: 400 });

    const permissions = (version.definition as any).permissions ?? [];
    const names = permissions.map((permission: any) => String(permission.permission || ""));
    if (new Set(names).size !== names.length) {
      throw new Response("Agent contract contains duplicate permissions", { status: 400 });
    }

    return transition(context.userId, data.versionId, "tested", "Contract structural test passed");
  });

/**
 * Primary operational action.
 * The admin supplies only the agent key. The server resolves the current
 * contract, runs the contract safety preflight, and performs the complete
 * activation transaction. No version/code/JSON entry is required.
 */
export const activateAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { agentKey: unknown }) => ({ agentKey: keyOf(input.agentKey) }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);

    const { data: agent, error: agentError } = await db
      .from("agents")
      .select("id,agent_key,name,config,status")
      .eq("agent_key", data.agentKey)
      .single();

    if (agentError || !agent) throw new Response("Agent not found", { status: 404 });

    const { data: versions, error: versionsError } = await db
      .from("agent_versions")
      .select("id,version,lifecycle_state,definition,created_at")
      .eq("agent_id", agent.id)
      .not("lifecycle_state", "eq", "rolled_back")
      .order("created_at", { ascending: false })
      .limit(20);

    if (versionsError) throw new Response(versionsError.message, { status: 500 });

    let version = versions?.find((item: any) => item.lifecycle_state === "active") ?? versions?.[0];

    if (!version) {
      const definition = mergeStaticContract(data.agentKey);
      const validation = validateAgentDefinition(definition);
      if (!validation.ok) throw new Response(validation.message, { status: 400 });

      const { data: created, error } = await db
        .from("agent_versions")
        .insert({
          agent_id: agent.id,
          version: definition.version,
          lifecycle_state: "draft",
          definition,
          config_hash: makeVersionHash(definition),
          created_by: context.userId,
        })
        .select("id,version,lifecycle_state,definition,created_at")
        .single();

      if (error || !created) {
        throw new Response(error?.message ?? "Could not initialize agent contract", { status: 500 });
      }
      version = created;
    }

    let validation = validateAgentDefinition(version.definition);

    // Some legacy seed rows contain only display metadata. Do not make the
    // administrator repair those rows manually: rebuild a canonical contract
    // from the checked-in agent definition and let the same server-side
    // activation preflight govern it.
    if (!validation.ok) {
      const canonical = mergeStaticContract(data.agentKey, {
        version: nextPatchVersion(version.version),
      });
      validation = validateAgentDefinition(canonical);
      if (!validation.ok) throw new Response(validation.message, { status: 409 });

      const { data: replacement, error: replacementError } = await db
        .from("agent_versions")
        .insert({
          agent_id: agent.id,
          version: canonical.version,
          lifecycle_state: "draft",
          definition: canonical,
          config_hash: makeVersionHash(canonical),
          parent_version_id: version.id,
          created_by: context.userId,
        })
        .select("id,version,lifecycle_state,definition,created_at")
        .single();

      if (replacementError || !replacement) {
        throw new Response(
          replacementError?.message ?? "Could not initialize the canonical agent contract",
          { status: 500 },
        );
      }

      await db.from("agent_config_history").insert({
        agent_id: agent.id,
        version_id: replacement.id,
        action: "created",
        before_config: version.definition,
        after_config: canonical,
        actor_id: context.userId,
        reason: "Automatic canonical contract repair during one-click activation",
      });
    }

    const { data: activated, error } = await db.rpc("agent_activate_operational", {
      p_agent_id: agent.id,
      p_actor_id: context.userId,
      p_reason: "One-click administrator activation",
    });

    if (error || !activated) {
      throw new Response(error?.message ?? "Agent activation failed during safety preflight", { status: 409 });
    }

    return activated;
  });

/** Backward-compatible advanced activation. Ordinary UI does not use this path. */
export const activateAgentVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { versionId: string }) => input)
  .handler(async ({ context, data }) => transition(context.userId, data.versionId, "active", "Explicit version activation"));

export const setAgentOperationalState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { agentKey?: unknown; versionId?: string; state: "maintenance" | "disabled" }) => input)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);

    let versionId = data.versionId;

    if (!versionId && data.agentKey !== undefined) {
      const key = keyOf(data.agentKey);
      const { data: agent, error } = await db.from("agents").select("id").eq("agent_key", key).single();
      if (error || !agent) throw new Response("Agent not found", { status: 404 });

      const { data: active } = await db
        .from("agent_versions")
        .select("id")
        .eq("agent_id", agent.id)
        .in("lifecycle_state", ["active", "maintenance"])
        .order("activated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      versionId = active?.id;
      if (!versionId) {
        const { data: latest } = await db
          .from("agent_versions")
          .select("id")
          .eq("agent_id", agent.id)
          .not("lifecycle_state", "eq", "rolled_back")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        versionId = latest?.id;
      }
    }

    if (!versionId) throw new Response("No agent version is available for this operation", { status: 409 });
    return transition(context.userId, versionId, data.state, `Agent moved to ${data.state} by administrator`);
  });

export const rollbackAgentVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { agentKey: AgentKey; versionId: string; reason?: string }) => ({
    agentKey: keyOf(input.agentKey),
    versionId: input.versionId,
    reason: input.reason ? String(input.reason) : null,
  }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { data: agent, error } = await db.from("agents").select("id").eq("agent_key", data.agentKey).single();
    if (error || !agent) throw new Response("Agent not found", { status: 404 });

    const { data: row, error: rpcError } = await db.rpc("agent_rollback_to_version", {
      p_agent_id: agent.id,
      p_target_version_id: data.versionId,
      p_actor_id: context.userId,
      p_reason: data.reason,
    });

    if (rpcError || !row) throw new Response(rpcError?.message ?? "Rollback failed", { status: 409 });
    return row;
  });

export const authorizeAgentToolAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) => ({
    agentKey: keyOf(input?.agentKey),
    permission: String(input?.permission || ""),
    action: String(input?.action || ""),
    taskId: input?.taskId ? String(input.taskId) : null,
    runId: input?.runId ? String(input.runId) : null,
    metadata: input?.metadata && typeof input.metadata === "object" ? input.metadata : {},
  }))
  .handler(async ({ context, data }) => authorizeAgentAction({ ...data, actorId: context.userId }));

export const sendAgentHandoff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) => ({
    taskId: String(input?.taskId || ""),
    runId: input?.runId ? String(input.runId) : null,
    fromAgent: keyOf(input?.fromAgent),
    toAgent: keyOf(input?.toAgent),
    payload: input?.payload && typeof input.payload === "object" ? input.payload : {},
  }))
  .handler(async ({ context, data }) => requestAgentHandoff({ ...data, actorId: context.userId }));

export const openAgentSandboxSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) => ({
    taskId: String(input?.taskId || ""),
    runId: input?.runId ? String(input.runId) : null,
    agentKey: keyOf(input?.agentKey),
    ttlSeconds: input?.ttlSeconds === undefined ? 900 : Number(input.ttlSeconds),
  }))
  .handler(async ({ context, data }) => openAgentSandbox({ ...data, actorId: context.userId }));

export const appendAgentMessageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) => ({
    taskId: String(input?.taskId || ""),
    runId: input?.runId ? String(input.runId) : null,
    fromAgent: keyOf(input?.fromAgent),
    toAgent: keyOf(input?.toAgent),
    type: String(input?.type || ""),
    payload: input?.payload && typeof input.payload === "object" ? input.payload : {},
  }))
  .handler(async ({ context, data }) => appendAgentMessage({ ...data, actorId: context.userId }));
