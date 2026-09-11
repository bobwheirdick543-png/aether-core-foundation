# Phase R — Battleversia Full Operationalization

Status: **IMPLEMENTED ON MAIN**

## World model

Battleversia is a first-class persistent world inside Aether, not a dashboard-only feature. It has its own entry page, navigation, economy, characters, auctions, tournaments, server state and administrative control surface while remaining backed by Aether's shared platform architecture.

## Architecture integration

`web/chat/API → authentication → Phase O security decision → Phase A durable Task/Run runtime → Phase M bounded Module Agent → Phase Q module/runtime boundary → Battleversia domain services → Supabase persistence → notifications/reports/telemetry/evaluation`.

Battleversia does not create a second task queue or authorization system. Match work is handed to the existing durable Task/Run runtime. Sensitive actions pass through Phase O and the Phase M Module Agent boundary.

## Persistent domain

Production Supabase project contains durable tables for:

- Yons and Bank Versia wallets
- Character catalog and ownership
- Auctions, players and bids
- Matches and match players
- Tournaments and tournament players
- Game servers
- Battleversia event/audit records

Server-side RPCs provide atomic auction joining, 15-second bid windows, auction starts and Yons transfers. Client mutations are locked down by RLS/revocation; authenticated server functions are the application boundary.

## World access

`/battleversia` is the standalone Battleversia entrance. Dedicated pages currently cover Characters, Economy, Auctions, Tournaments and the administrative Control Center. Battleversia is also exposed in the main Aether navigation.

Every Phase R page uses the shared `PageHeader` BackButton, preserving the website-wide rule that pages provide an explicit way back. The shared header already defaults to a Back button with a safe `/dashboard` fallback.

## Domain defaults

- Currency: Yons (`◈`, `YN`)
- Auction fund default: 100,000 Yons
- Auction player range: 2–5
- Bid window: 15 seconds
- Modes: Overall, Anime, Marvel, DC, Marvel vs DC, Anime vs DC, DC vs Marvel
- Tournament bounds are validated server-side

## Security

Administrative Battleversia control is server-authorized. Hiding buttons is not treated as a security boundary. Module execution cannot self-escalate, modify roles, bypass authorization or execute unrestricted host code.

## Validation

Phase R has a dedicated TypeScript/Vitest/build workflow in `.github/workflows/phase-r-validation.yml`. Vercel is intentionally not used for Phase R validation.
