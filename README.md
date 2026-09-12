# Aether AI Core

AETHER AI PLATFORM — personal AI operating system foundation.

This repository implements the frontend and architecture for Aether as a full platform (chat, AAX models, agents, memory, knowledge, research, tasks, APIs, projects, modules) aligned with the master architecture (Phases A–Z3 + Part 9B).

==================================================
1. PRODUCT STRUCTURE
==================================================

USER / EXTERNAL APP → AETHER INTERFACE → AUTH → API / BACKEND → PERMISSIONS → COGNITIVE ORCHESTRATOR → MODEL ROUTER → AAX MODELS + MEMORY + KNOWLEDGE + TOOLS + AGENTS → RESPONSE / ACTION

==================================================
2. INTELLIGENCE LAYER (AAX)
==================================================

Aether Ascension (AAX) generations are the platform intelligence family.

Legacy product roles (Fast / Think / Code / Vision / Long / Translate) are retired in favor of the unified AAX / EX intelligence layer.

UI is built around AAX generations (e.g. AAX 1.0, 2.0, 3.1, 4.0, 5.1) with release status, provider mapping, and capabilities.

Model selector and /models show released AAX generations with:
- Display name + generation.revision
- Release status (draft / scheduled / available)
- Capabilities
- Open in Chat

==================================================
3. KEY SURFACES
==================================================

User: Dashboard, Chat, Models (AAX), Projects, Knowledge, Memory, Research, Operations, Reports, Tasks, Battleversia (module), Notifications, API Keys (Z2), Settings, Safety Bin.

Admin: Overview, Users, Team (independent agent workstations), AI Models (AAX control plane), Model Routing, AI Agents (easy run + progressive workflow), Knowledge, Research, Operations, Tasks, Projects, API Keys, Usage, Logs, System, Settings.

Part 9B: LiveTaskActivity in AppShell and AdminShell; operations timelines; agent progressive workflow strips.

==================================================
4. NON-NEGOTIABLE RULES
==================================================

- Real persistence; no fabricated outputs
- Server-side permissions
- Provider credentials never rendered to the browser
- Knowledge requires explicit approval before production
- Durable task identity and run events

==================================================
5. SECURITY
==================================================

Admin password via server env (e.g. AETHER_ADMIN_PASSWORD) — never in frontend code, client env, or git secrets.

Never expose provider API keys, full API secrets after recovery policy, or database credentials to the browser.

==================================================
6. DEVELOPMENT
==================================================

See package.json scripts. TypeScript / TanStack / Supabase architecture.

For backend gaps (release AAX models, workers, tables/RLS), use the admin AAX control plane and your backend tooling.
