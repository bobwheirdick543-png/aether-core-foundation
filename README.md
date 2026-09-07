# Aether AI Core

Build the initial architecture foundation and UI for my project called:

AETHER AI PLATFORM

IMPORTANT:
This is NOT just a landing page or a generic AI chatbot. It is the frontend foundation of a larger AI platform that will later contain AI models, memory, RAG, web research, AI agents, knowledge management, background tasks, APIs, projects/modules, and external integrations.

For this first build, focus on:
1. High-quality frontend architecture
2. Authentication flows
3. User dashboard
4. Private admin dashboard
5. AI model interface visible to normal users
6. AI agent management interface visible ONLY to the platform owner/admin
7. Clean project/module architecture
8. Database-ready architecture
9. API-ready architecture
10. A design system that can be expanded later

DO NOT attempt to implement the entire AI backend yet.
Create the architecture and UI foundation so the repository can later be exported and developed further.

==================================================
1. AETHER PRODUCT STRUCTURE
==================================================

Aether should be structured as a platform rather than a single chatbot.

High-level architecture:

USER / EXTERNAL APP
        ↓
AETHER INTERFACE
        ↓
AUTHENTICATION
        ↓
AETHER API / BACKEND
        ↓
PERMISSIONS
        ↓
COGNITIVE ORCHESTRATOR
        ↓
MODEL ROUTER
        ↓
MODELS + MEMORY + KNOWLEDGE + TOOLS + AGENTS
        ↓
RESPONSE / ACTION

The frontend you build now should be designed around this architecture.

==================================================
2. PUBLIC LANDING PAGE
==================================================

Create a premium modern landing page for Aether AI Platform.

The landing page should communicate that Aether is an AI platform capable of eventually bringing together:

- AI chat
- Multiple AI models
- AI reasoning
- AI agents
- Persistent memory
- Knowledge retrieval / RAG
- Web research
- Multilingual capabilities
- Long-running research tasks
- Reports and PDF generation
- Projects
- Developer API
- External applications
- Future game/module systems

Do NOT make Battle Versia the main focus of the landing page.

Battle Versia is only one future project/module that will exist inside Aether.

Landing page sections:

HEADER
- Aether logo
- Home
- Features
- Models
- Agents
- Developers
- Documentation
- Login
- Get Started

HERO
Create a strong futuristic but professional hero section.

Suggested messaging:

"Aether — Your AI Platform."

Subheading:
"One platform for intelligent conversations, research, memory, knowledge, agents, models, and applications."

Buttons:
- Get Started
- Explore Aether

FEATURES SECTION
Show cards for:
- AI Chat
- AI Models
- AI Agents
- Memory
- Knowledge
- Web Research
- Projects
- Developer API

MODEL SECTION
Introduce the concept of multiple model modes.

Example:

Aether Fast
Aether Think
Aether Code
Aether Vision
Aether Long
Aether Translate

These are PRODUCT-LEVEL model roles.

Do not assume each one is a separate proprietary model yet.
Build the UI so a future model router can connect these roles to actual AI providers/models.

RESEARCH SECTION
Explain that Aether will eventually be able to:
- Search multiple sources
- Gather information
- Verify information
- Detect contradictions
- Generate research reports
- Ask for human approval before knowledge enters production

MEMORY / KNOWLEDGE SECTION
Show that Aether will have:
- User memory
- Project memory
- Knowledge bases
- Retrieval
- Versioned knowledge

AGENTS SECTION
Show examples:
- Research Agent
- Verification Agent
- Knowledge Curator
- Report Agent
- Game/Module Agent

Again, these should be presented as part of the future platform architecture.

DEVELOPER SECTION
Introduce the future Aether API.

Explain that external applications will eventually be able to connect to Aether using scoped API keys.

FOOTER
Include:
- Aether
- Features
- Developers
- Documentation
- Privacy
- Terms
- Contact
- Status

==================================================
3. USER AUTHENTICATION
==================================================

Create a complete authentication foundation.

Pages:

/login
/signup
/verify-email
/forgot-password
/reset-password
/onboarding

Normal users should authenticate through a proper authentication system.

Do not store passwords in frontend code.

Use a proper backend authentication mechanism.

The architecture must support:

- Email/password authentication
- Email verification
- Password reset
- Sessions
- Logout
- Protected routes
- User profiles
- Role-based access control

User roles should include at minimum:

USER
ADMIN

The normal user must NEVER be able to access admin-only pages.

==================================================
4. USER ONBOARDING
==================================================

After signup, create an onboarding flow.

Ask for:

- Display name
- Preferred language
- Default AI model
- Response preference
- Memory preference

Allow the user to skip optional settings.

After onboarding, send the user to:

/dashboard

==================================================
5. USER DASHBOARD
==================================================

Create the main Aether user dashboard.

This is the primary command center for normal users.

Sidebar:

AETHER
- Dashboard
- Chat
- Models
- Projects
- Knowledge
- Memory
- Research
- Reports
- Tasks
- API / Developers
- Settings

The sidebar should be responsive.

Dashboard homepage should show:

WELCOME
"Welcome to Aether"

Cards:

- Recent Conversations
- Active Tasks
- Saved Knowledge
- Recent Research
- Available Models
- Projects

Also show:

"Start something new"

Options:
- New Chat
- Research
- Create Project
- Upload Knowledge
- Generate Report

The dashboard should feel like a serious AI operating environment, not a simple chatbot website.

==================================================
6. AI CHAT INTERFACE
==================================================

Create the main chat UI.

Route:

/chat

Design it similar to a modern premium AI interface but DO NOT copy another company's UI exactly.

Components:

- Conversation sidebar
- New conversation button
- Model selector
- Project selector
- Message area
- Composer
- File attachment button
- Web research toggle
- Memory toggle
- Tool usage indicator
- Send button

Model selector should show:

Aether Fast
Aether Think
Aether Code
Aether Vision
Aether Long
Aether Translate

For now, these can be UI selections backed by placeholder configuration.

Structure the code so an actual model router can be connected later.

==================================================
7. USER MODEL PAGE
==================================================

Create:

/models

This page is visible to normal authenticated users.

Show the available Aether model roles.

Each model card should contain:

- Name
- Description
- Capabilities
- Context capability
- Speed indicator
- Status
- Select button

Example:

Aether Fast
"Optimized for fast everyday conversations."

Aether Think
"Designed for deeper reasoning and complex analysis."

Aether Code
"Designed for programming and technical tasks."

Aether Vision
"Designed for images, screenshots and visual documents."

Aether Long
"Designed for long documents and large-context tasks."

Aether Translate
"Optimized for multilingual communication and translation."

Build this so actual models can later be connected through a backend model router.

==================================================
8. PRIVATE ADMIN LOGIN
==================================================

Create a completely separate private administrator authentication flow.

IMPORTANT SECURITY REQUIREMENT:

DO NOT put the admin password in:
- frontend code
- JavaScript
- HTML
- React components
- database seed files
- GitHub
- client-side environment variables
- visible UI

The administrator password must be handled server-side as a secret/environment variable.

Create a private route such as:

/admin/login

This page should NOT be prominently linked from the public website.

The admin login should be password-based as requested.

The initial administrator password I intend to use is:

king123@#$

IMPORTANT:
Do NOT hard-code this value into the application.

Instead create an environment variable such as:

AETHER_ADMIN_PASSWORD

and document that I must set:

AETHER_ADMIN_PASSWORD=king123@#$

in the secure server environment.

If the architecture requires an admin username/email identifier, make it configurable through an environment variable as well.

Do NOT expose the secret to the browser.

==================================================
9. ADMIN ROLE
==================================================

Create a protected ADMIN role.

Only ADMIN can access:

/admin

and all admin subroutes.

Normal USER accounts must receive an unauthorized/forbidden response when attempting to access admin routes.

Implement route guards and backend authorization checks.

Do NOT rely only on frontend hiding.

The backend must enforce permissions.

==================================================
10. ADMIN DASHBOARD
==================================================

The administrator dashboard should give the platform owner an overall view of Aether.

Create:

/admin

Sidebar:

AETHER ADMIN

- Overview
- Users
- AI Models
- AI Agents
- Knowledge
- Research
- Tasks
- Projects
- API Keys
- Usage
- Logs
- System
- Settings

ADMIN OVERVIEW

Show platform-level statistics such as:

- Total users
- Active users
- Conversations
- AI requests
- Active research tasks
- Knowledge entries
- Reports generated
- API requests
- System status

Use placeholder/mock data for now.

==================================================
11. ADMIN AI AGENTS DASHBOARD
==================================================

Create:

/admin/agents

THIS PAGE MUST ONLY BE AVAILABLE TO THE ADMIN.

This is where I, as the platform owner, can see and eventually manage Aether's AI agents.

Create cards for:

RESEARCH AGENT
Purpose:
Searches the web and gathers candidate information.

VERIFICATION AGENT
Purpose:
Checks claims, sources, dates, contradictions and evidence.

KNOWLEDGE CURATOR
Purpose:
Converts approved research into structured production knowledge.

REPORT AGENT
Purpose:
Organizes verified research into readable reports/PDFs.

GAME / MODULE AGENT
Purpose:
Helps create and manage structured application/game modules.

Each agent card should contain:

- Agent name
- Description
- Status
- Permissions
- Tools
- Last activity
- Tasks
- Configuration
- Enable/disable control

Do not actually give these agents dangerous autonomous capabilities yet.

Build the management interface and architecture foundation only.

==================================================
12. AGENT PERMISSION MODEL
==================================================

Create a permissions architecture.

Example:

Research Agent:
- Can search web
- Can read sources
- Can write to research sandbox
- CANNOT publish to production knowledge

Verification Agent:
- Can read research
- Can evaluate evidence
- Can flag contradictions
- CANNOT publish production knowledge

Report Agent:
- Can read verified research
- Can generate reports
- CANNOT approve knowledge

Knowledge Curator:
- Can transform approved information
- Can publish to production knowledge
- Only after explicit approval

This permission model should exist in the architecture even if the actual agents are not implemented yet.

==================================================
13. KNOWLEDGE ARCHITECTURE UI
==================================================

Create:

/knowledge

for users.

And:

/admin/knowledge

for administrators.

The future knowledge system should distinguish between:

RESEARCH SANDBOX
        ↓
VERIFIED RESEARCH
        ↓
HUMAN APPROVAL
        ↓
PRODUCTION KNOWLEDGE

The frontend should reflect this distinction.

Never design the system so research automatically becomes production knowledge.

Create UI concepts for:

- Knowledge collections
- Sources
- Tags
- Confidence
- Version
- Approval status
- Created date
- Updated date

==================================================
14. RESEARCH SYSTEM UI
==================================================

Create:

/research

Allow a user to eventually start a research task.

Example form:

Research topic:
[________________________]

Research duration:
- Quick
- 30 minutes
- 1 hour
- 2 hours
- Custom

Research depth:
- Basic
- Deep
- Comprehensive

Sources:
- Web
- Uploaded files
- Knowledge base

Button:

"Start Research"

The actual background research engine can be implemented later.

==================================================
15. REPORTS
==================================================

Create:

/reports

Users should eventually see generated research reports/PDFs.

Each report card should show:

- Title
- Topic
- Created date
- Number of sources
- Verification status
- Approval status
- Download
- View

For admin, create:

/admin/reports

where the administrator can see platform-level reports.

==================================================
16. LONG-RUNNING TASKS
==================================================

Create:

/tasks

This represents background tasks that continue running even when the user leaves the website.

Example:

Research Battle Versia history
Status: Running
Elapsed: 42 minutes
Estimated completion: ...
Sources gathered: 37
Verification: In progress

The UI should support:

- Running
- Completed
- Failed
- Cancelled
- Waiting for approval

The actual job queue/background worker can be implemented later.

==================================================
17. PROJECTS
==================================================

Create:

/projects

Projects must be general-purpose.

Do NOT make Aether's main dashboard centered around Battle Versia.

Example projects:

- Aether AI Platform
- Battle Versia
- Future Game #002
- Research Project
- Custom Project

Each project can eventually contain:

- Conversations
- Files
- Knowledge
- Memory
- Tools
- Agents
- Settings
- API integrations

Create a project page architecture that can support many different project types.

==================================================
18. BATTLE VERSIA AS A FUTURE MODULE
==================================================

Create Battle Versia only as an example project/module.

Do NOT hard-code Battle Versia into the entire Aether architecture.

The future module architecture should support:

- Rules
- Characters
- Stats
- Abilities
- Commands
- Game state
- Battle engine
- Versioning
- API access

Aether should eventually be capable of exposing a Battle Versia module through its API to a WhatsApp bot.

The actual game engine will be implemented later.

==================================================
19. API / DEVELOPER AREA
==================================================

Create:

/developers

and:

/api-keys

Users should eventually be able to create API keys.

Create UI for:

- Create API key
- Key name
- Permissions/scopes
- Expiration
- Rate limit
- Status
- Last used
- Revoke key

IMPORTANT:

Never display the full API key again after initial creation.

Only show it once.

API keys should eventually support scoped permissions such as:

chat
models
knowledge.read
research
projects.read
projects.write
modules.read
modules.execute

The actual API implementation can come later, but design the frontend and database structure for it now.

==================================================
20. SETTINGS
==================================================

Create:

/settings

Sections:

Profile
Security
Preferences
Language
Memory
Models
Notifications
API
Privacy

Admin should have additional settings at:

/admin/settings

==================================================
21. DATABASE ARCHITECTURE
==================================================

Create a database-ready architecture.

Do NOT put everything into one table.

Plan separate entities/tables for:

users
profiles
sessions/auth
projects
conversations
messages
models
model_configs
agents
agent_permissions
tasks
research_runs
research_sources
research_findings
knowledge_collections
knowledge_entries
knowledge_versions
reports
api_keys
api_key_scopes
usage_logs
audit_logs

Use appropriate relationships.

The schema should be designed so it can grow later.

==================================================
22. SECURITY
==================================================

Security is extremely important.

Implement or prepare:

- Authentication
- Authorization
- Role-based access control
- Protected routes
- Server-side permission checks
- Input validation
- Secure session handling
- Rate limiting architecture
- Audit logging architecture
- API key hashing/storage strategy
- Secret management
- Admin protection

Never expose:
- admin password
- provider API keys
- database credentials
- private secrets
- full API keys

to the frontend.

==================================================
23. FRONTEND DESIGN
==================================================

Design language:

Premium
Futuristic
Minimal
Professional
Technical
Clean
Fast

Avoid:
- childish AI graphics
- excessive gradients
- clutter
- generic template appearance
- overly flashy animations

Use:
- clean typography
- strong spacing
- cards
- subtle borders
- polished dark/light modes
- responsive layouts
- excellent mobile experience
- smooth but restrained animations

Aether should feel like a serious AI operating platform.

==================================================
24. RESPONSIVENESS
==================================================

The application must work properly on:

- Desktop
- Laptop
- Tablet
- Mobile

The dashboard sidebar should collapse intelligently on smaller screens.

==================================================
25. CODE ARCHITECTURE
==================================================

Use a clean modular architecture.

Separate:

components
pages
layouts
authentication
API clients
services
types
database
models
agents
projects
knowledge
tasks
admin
utilities

Do not put everything into one giant component.

Use reusable components.

Create clear boundaries between:

UI
API
business logic
database
authentication
authorization

==================================================
26. FUTURE BACKEND COMPATIBILITY
==================================================

The frontend must be designed so that later I can connect:

- PostgreSQL/Supabase
- AI model providers
- Local models
- Web search
- RAG
- Vector database
- Object/file storage
- Background workers
- AI agents
- PDF generation
- External APIs
- WhatsApp integrations
- Aether API

Do not tightly couple the UI to one AI provider.

Create an abstraction layer for models.

For example:

ModelProvider
ModelRouter
AIRequest
AIResponse

so providers can be swapped later.

==================================================
27. MODEL ROUTER FOUNDATION
==================================================

Create a frontend/backend-ready abstraction for:

Aether Fast
Aether Think
Aether Code
Aether Vision
Aether Long
Aether Translate

The UI should communicate with a model selection abstraction rather than directly depending on a specific provider.

Later the model router will decide which actual model/provider handles the request.

==================================================
28. COGNITIVE ORCHESTRATOR FOUNDATION
==================================================

Create placeholder architecture for the future Aether Cognitive Orchestrator.

Concept:

USER REQUEST
↓
ORCHESTRATOR
↓
INTENT
↓
PERMISSIONS
↓
MEMORY
↓
KNOWLEDGE RETRIEVAL
↓
MODEL SELECTION
↓
TOOLS / AGENTS
↓
EVALUATION
↓
FINAL RESPONSE

Do NOT implement full autonomous intelligence yet.

Just make the architecture ready for it.

==================================================
29. ADMIN VS USER EXPERIENCE
==================================================

NORMAL USER:

Can access:
- Dashboard
- Chat
- Models
- Projects
- Knowledge
- Memory
- Research
- Reports
- Tasks
- API
- Settings

ADMIN:

Can access everything appropriate to the normal user PLUS:

- Platform overview
- All users
- All projects
- AI models configuration
- AI agents
- Agent permissions
- Research runs
- Knowledge management
- Reports
- API management
- Usage
- Logs
- System configuration
- Platform settings

The admin interface must be visually and structurally separate from the normal user dashboard.

==================================================
30. IMPORTANT ARCHITECTURAL PRINCIPLE
==================================================

Aether must be designed as:

PLATFORM
    ↓
CORE SERVICES
    ↓
MODELS
    ↓
MEMORY
    ↓
KNOWLEDGE
    ↓
TOOLS
    ↓
AGENTS
    ↓
PROJECTS / MODULES
    ↓
EXTERNAL APPLICATIONS

Not:

CHATBOT
    ↓
EVERYTHING HARD-CODED INSIDE IT

Everything should be modular.

==================================================
31. INITIAL IMPLEMENTATION SCOPE
==================================================

For this Lovable build, prioritize:

PHASE 1

✓ Landing page
✓ Signup
✓ Login
✓ Email verification architecture
✓ Password reset
✓ User onboarding
✓ User dashboard
✓ Chat UI
✓ Model selection UI
✓ Models page
✓ Projects UI
✓ Knowledge UI
✓ Research UI
✓ Reports UI
✓ Tasks UI
✓ Developer/API UI
✓ Settings
✓ Private admin login
✓ Admin dashboard
✓ Admin agents dashboard
✓ Admin model management UI
✓ Admin knowledge management UI
✓ Admin users UI
✓ Role-based access control
✓ Database schema foundation
✓ Modular code architecture
✓ Responsive design

Use mock/placeholder data where backend intelligence is not yet implemented.

DO NOT fake real AI functionality.

Clearly separate:
"UI implemented"
from
"backend functionality to be implemented later."

==================================================
32. FUTURE DEVELOPMENT
==================================================

The architecture must leave room for these later phases:

Phase 2:
Real AI chat

Phase 3:
Persistent memory

Phase 4:
Model router

Phase 5:
Web search + RAG

Phase 6:
Cognitive orchestrator

Phase 7:
Research + verification pipeline

Phase 8:
Background/long-running tasks

Phase 9:
Knowledge approval and production publishing

Phase 10:
Aether API

Phase 11:
Battle Versia module

Phase 12:
WhatsApp integration

Phase 13:
Additional games/modules

==================================================
33. FINAL REQUIREMENT
==================================================

Before finishing:

- Make sure the application runs.
- Make sure authentication routes work.
- Make sure protected routes work.
- Make sure ADMIN and USER roles are separated.
- Make sure /admin cannot be accessed by normal users.
- Make sure admin secrets are server-side only.
- Make sure the admin password is NOT hard-coded.
- Make sure API keys are treated as secrets.
- Make sure the code is modular.
- Make sure the UI is responsive.
- Make sure there are no broken navigation links.
- Make sure placeholder backend functions are clearly isolated.
- Make sure the project is ready to export to GitHub for further architecture and backend development.

Most importantly:

BUILD THE FOUNDATION, NOT THE ENTIRE AETHER AI SYSTEM.

The goal is to create a clean, scalable, professional architecture and user experience that we can take out of Lovable and continue developing into the full Aether AI Platform.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://aether-core-foundation.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/dbf64e7e-5693-4f3a-a1b4-0acf85e66a5e).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
