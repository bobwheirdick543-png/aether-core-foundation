import type { AgentKey } from "./agents";

/** Initial operational intelligence: capability guidance, not fake performance scores. */
export const AGENT_INTELLIGENCE: Record<AgentKey, {
  focus: string[];
  mustPreserve: string[];
  handoff: string[];
}> = {
  orchestrator: {
    focus: ["intent classification", "dependency planning", "permission preservation", "evaluation and escalation"],
    mustPreserve: ["task identity", "source provenance", "accumulated context", "auditability"],
    handoff: ["route only to registered agents", "never silently bypass approval"],
  },
  "knowledge-acquisition": {
    focus: ["source fidelity", "deep extraction", "terminology", "concepts", "entities", "relationships", "source hashing"],
    mustPreserve: ["original source", "raw extracted content", "page/section/chunk provenance"],
    handoff: ["pass original source plus acquisition understanding to every downstream knowledge agent"],
  },
  research: {
    focus: ["external evidence", "current information", "source diversity", "cross-domain connections"],
    mustPreserve: ["source URLs/references", "dates", "evidence context", "accumulated understandings"],
    handoff: ["append research understanding; never replace earlier understanding"],
  },
  verification: {
    focus: ["claim verification", "contradictions", "evidence quality", "uncertainty", "confidence"],
    mustPreserve: ["original source", "all previous understandings", "supporting evidence"],
    handoff: ["mark corrections and contradictions explicitly for curation"],
  },
  curator: {
    focus: ["knowledge synthesis", "deduplication", "versioning", "relationship integrity", "provenance"],
    mustPreserve: ["lineage", "evidence", "verification state", "source identity"],
    handoff: ["produce a collective package for target AAX self-analysis"],
  },
  report: {
    focus: ["structured reporting", "evidence presentation", "durable artifacts"],
    mustPreserve: ["task/run identity", "sources", "knowledge changes", "completion state"],
    handoff: ["deliver the final report to its configured destination"],
  },
  notification: {
    focus: ["real event delivery", "recipient correctness", "in-app persistence", "external delivery orchestration"],
    mustPreserve: ["event identity", "task/run identity", "delivery status"],
    handoff: ["never claim external delivery unless the provider confirms it"],
  },
  security: {
    focus: ["authorization", "provenance integrity", "policy violations", "sensitive operations"],
    mustPreserve: ["audit history", "permission boundaries", "source integrity"],
    handoff: ["flag issues without silently changing production policy"],
  },
  optimization: {
    focus: ["real telemetry", "latency", "failures", "resource efficiency", "performance evaluation"],
    mustPreserve: ["measurement provenance", "baseline", "before/after evidence"],
    handoff: ["recommend changes; do not fabricate performance improvements"],
  },
  module: {
    focus: ["module definitions", "safe drafts", "testing", "integration boundaries"],
    mustPreserve: ["module identity", "dependencies", "test evidence"],
    handoff: ["never obtain unrestricted production execution authority"],
  },
};
