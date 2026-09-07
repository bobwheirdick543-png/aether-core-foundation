/**
 * MOCK DATA — clearly isolated placeholder content for UI-only surfaces.
 * Everything exported here is replaced by real reads in later phases.
 */

export const MOCK_CONVERSATIONS = [
  { id: "c1", title: "Platform architecture review", model: "Aether Think", updated: "2 hours ago" },
  { id: "c2", title: "Module API sketch", model: "Aether Code", updated: "Yesterday" },
  { id: "c3", title: "Multilingual onboarding copy", model: "Aether Translate", updated: "3 days ago" },
];

export const MOCK_TASKS = [
  {
    id: "t1",
    title: "Research: Battle Versia history",
    status: "running" as const,
    elapsed: "42 minutes",
    eta: "~18 minutes",
    sources: 37,
    verification: "In progress",
    progress: 68,
  },
  {
    id: "t2",
    title: "Report: Model routing benchmarks",
    status: "waiting_approval" as const,
    elapsed: "1 hour 20 minutes",
    eta: "Awaiting review",
    sources: 22,
    verification: "Complete",
    progress: 100,
  },
  {
    id: "t3",
    title: "Knowledge import: Platform glossary",
    status: "completed" as const,
    elapsed: "12 minutes",
    eta: "—",
    sources: 8,
    verification: "Complete",
    progress: 100,
  },
  {
    id: "t4",
    title: "Research: Vector store comparison",
    status: "failed" as const,
    elapsed: "4 minutes",
    eta: "—",
    sources: 2,
    verification: "Not started",
    progress: 15,
  },
  {
    id: "t5",
    title: "Crawl: Documentation sync",
    status: "cancelled" as const,
    elapsed: "—",
    eta: "—",
    sources: 0,
    verification: "Not started",
    progress: 0,
  },
];

export const MOCK_PROJECTS = [
  {
    id: "p1",
    slug: "aether-ai-platform",
    name: "Aether AI Platform",
    type: "Platform",
    description: "The core platform itself: services, models, memory and APIs.",
    conversations: 14,
    knowledge: 62,
    agents: 0,
  },
  {
    id: "p2",
    slug: "battle-versia",
    name: "Battle Versia",
    type: "Game module",
    description: "Example module: rules, characters, stats, abilities and battle state.",
    conversations: 6,
    knowledge: 28,
    agents: 0,
  },
  {
    id: "p3",
    slug: "future-game-002",
    name: "Future Game #002",
    type: "Game module",
    description: "Reserved slot demonstrating multi-module support.",
    conversations: 0,
    knowledge: 0,
    agents: 0,
  },
  {
    id: "p4",
    slug: "research-project",
    name: "Research Project",
    type: "Research",
    description: "Long-running research with verification and reports.",
    conversations: 3,
    knowledge: 41,
    agents: 0,
  },
  {
    id: "p5",
    slug: "custom-project",
    name: "Custom Project",
    type: "General",
    description: "A blank project shape for anything else.",
    conversations: 1,
    knowledge: 4,
    agents: 0,
  },
];

export const MOCK_KNOWLEDGE = [
  {
    id: "k1",
    title: "Model routing principles",
    collection: "Platform core",
    stage: "production" as const,
    confidence: 0.94,
    version: 4,
    tags: ["models", "routing"],
    sources: 6,
    created: "12 Mar 2026",
    updated: "2 Sep 2026",
  },
  {
    id: "k2",
    title: "Verification heuristics draft",
    collection: "Research methods",
    stage: "verified" as const,
    confidence: 0.71,
    version: 2,
    tags: ["research", "verification"],
    sources: 11,
    created: "3 Aug 2026",
    updated: "1 Sep 2026",
  },
  {
    id: "k3",
    title: "Battle Versia rule fragments",
    collection: "Modules",
    stage: "sandbox" as const,
    confidence: 0.42,
    version: 1,
    tags: ["module", "rules"],
    sources: 3,
    created: "28 Aug 2026",
    updated: "5 Sep 2026",
  },
  {
    id: "k4",
    title: "Multilingual tone guidelines",
    collection: "Language",
    stage: "approved" as const,
    confidence: 0.88,
    version: 3,
    tags: ["language"],
    sources: 5,
    created: "19 Jul 2026",
    updated: "30 Aug 2026",
  },
];

export const MOCK_REPORTS = [
  {
    id: "r1",
    title: "Battle Versia — historical summary",
    topic: "Battle Versia",
    created: "4 Sep 2026",
    sources: 37,
    verification: "In progress",
    approval: "Pending",
  },
  {
    id: "r2",
    title: "Model routing benchmark review",
    topic: "Model routing",
    created: "1 Sep 2026",
    sources: 22,
    verification: "Complete",
    approval: "Approved",
  },
  {
    id: "r3",
    title: "Vector storage options",
    topic: "Retrieval",
    created: "24 Aug 2026",
    sources: 15,
    verification: "Complete",
    approval: "Rejected",
  },
];

export const MOCK_MEMORY = [
  { id: "m1", scope: "User", label: "Prefers concise, technical answers", updated: "2 Sep 2026" },
  { id: "m2", scope: "User", label: "Working language: English", updated: "2 Sep 2026" },
  { id: "m3", scope: "Project", label: "Aether AI Platform — modular architecture rules", updated: "5 Sep 2026" },
  { id: "m4", scope: "Project", label: "Battle Versia — module boundaries", updated: "30 Aug 2026" },
];

export const MOCK_API_KEYS = [
  {
    id: "ak1",
    name: "WhatsApp bot (staging)",
    prefix: "aeth_live_9f2c",
    scopes: ["chat", "modules.read", "modules.execute"],
    status: "active" as const,
    rateLimit: 60,
    expires: "No expiry",
    lastUsed: "Never",
  },
  {
    id: "ak2",
    name: "Internal dashboard",
    prefix: "aeth_live_41ab",
    scopes: ["models", "projects.read"],
    status: "revoked" as const,
    rateLimit: 120,
    expires: "1 Jan 2027",
    lastUsed: "18 Aug 2026",
  },
];

export const MOCK_ADMIN_STATS = [
  { label: "Total users", value: "1", hint: "Live from platform" },
  { label: "Active users (30d)", value: "1", hint: "Placeholder metric" },
  { label: "Conversations", value: "0", hint: "Placeholder metric" },
  { label: "AI requests", value: "0", hint: "Model router not connected" },
  { label: "Active research tasks", value: "0", hint: "Worker not implemented" },
  { label: "Knowledge entries", value: "0", hint: "Placeholder metric" },
  { label: "Reports generated", value: "0", hint: "Placeholder metric" },
  { label: "API requests", value: "0", hint: "Aether API not implemented" },
];

export const MOCK_AUDIT_LOG = [
  { id: "l1", time: "22:41", actor: "system", action: "platform.boot", target: "aether", level: "info" },
  { id: "l2", time: "22:44", actor: "admin", action: "admin.session.granted", target: "user_roles", level: "warn" },
  { id: "l3", time: "22:45", actor: "system", action: "schema.migrated", target: "public", level: "info" },
];
