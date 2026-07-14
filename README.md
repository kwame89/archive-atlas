# Archive Atlas

An artist-first archival & provenance platform. Early-stage build. See [SCOPE.md](./SCOPE.md)
for the full design doc — vision, roles, the identity/trust-tier model, the event data model,
and the phased build plan this repo follows.

## Stack

Vite + React + TypeScript, Supabase (Postgres + Auth + Row-Level Security). No local database —
development connects to a hosted Supabase project.

## Setup

1. `npm install`
2. Create a Supabase project (or use an existing one), then run the SQL in
   `supabase/migrations/` against it (via the Supabase SQL editor or the Supabase CLI), in order.
3. Copy `.env.example` to `.env.local` and fill in your Supabase project URL and anon key.
4. Deploy `supabase/functions/anchor-event/` as a Supabase Edge Function and set the
   `STELLAR_ANCHOR_SECRET` secret to a funded Stellar testnet secret key (optional — the app
   works without it; events just won't be anchored on Stellar).
5. Deploy `supabase/functions/link-wallet/` as a Supabase Edge Function (needed for Phase 2
   wallet-linking; no extra secrets to set — it only uses the auto-provided Supabase ones).
6. `npm run dev`

## Project structure

```
src/components   Shared UI pieces
src/pages        Route-level views (artwork page, profile page, claim flow, dashboards)
src/lib          Supabase client, auth helpers
src/types        TypeScript types mirroring the database schema
supabase/migrations   SQL schema + RLS policies
```

## Where things stand

Phase 0 (core product) is complete and verified: auth/claim flow, artwork records with images
and rich detail fields, provenance timelines, ownership/custody transfer logging, collaborators,
a collective dashboard for unclaimed profiles, and print/PDF export. Phase 1 (Stellar testnet
anchoring of event hashes via the anchor-event Edge Function) is deployed and verified live.
Phase 2 (Freighter wallet-linking, with wallet-signed anchoring for genesis/ownership_transfer
events) is built — see SCOPE.md's Phase 2 notes for exactly how it changes anchoring behavior.
See SCOPE.md's MVP Build Plan for the full status breakdown.
