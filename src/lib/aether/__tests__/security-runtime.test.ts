import { describe, expect, it } from "vitest";
import { AGENTS } from "../agents";
import { incidentKey, securityIdempotencyKey } from "../security-runtime";

describe("Phase O Security & Compliance",()=>{
  it("keeps the security agent registered and bounded",()=>{const security=AGENTS.find(a=>a.key==="security");expect(security).toBeDefined();expect(security?.status).toBe("enabled");expect(security?.prohibited).toContain("Bypass authorization");expect(security?.prohibited).toContain("Self-escalate permissions");expect(security?.permissions.find(p=>p.permission==="security.policy.evaluate")?.allowed).toBe(true);expect(security?.permissions.find(p=>p.permission==="roles.modify")?.allowed).toBe(false);});
  it("creates stable idempotency keys for equivalent authorization requests",()=>{const a=securityIdempotencyKey({actorId:"u",agentKey:"security",action:"security.inspect",resourceType:"agent",resourceId:"a",taskId:null,runId:null,context:{x:1}});const b=securityIdempotencyKey({actorId:"u",agentKey:"security",action:"security.inspect",resourceType:"agent",resourceId:"a",taskId:null,runId:null,context:{x:1}});expect(a).toBe(b);expect(a).toMatch(/^phase-o:[0-9a-f]{8}$/);});
  it("changes the incident key when the incident target changes",()=>{expect(incidentKey("policy.violation","a")).not.toBe(incidentKey("policy.violation","b"));});
  it("keeps the ten-agent registry intact",()=>{expect(AGENTS).toHaveLength(10);expect(new Set(AGENTS.map(a=>a.key)).size).toBe(10);});
});
