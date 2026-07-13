# Artist Archive & Provenance Platform

Early-stage build. See [SCOPE.md](./SCOPE.md) for the full design doc — vision, roles, the
identity/trust-tier model, the event data model, and the phased build plan this repo follows.

## Stack

Vite + React + TypeScript, Supabase (Postgres + Auth + Row-Level Security). No local database —
development connects to a hosted Supabase project.

## Setup

1. `npm install`
2. Create a Supabase project (or use an existing one), then run the SQL in
   `supabase/migrations/` against it (via the Supabase SQL editor or the Supabase CLI).
3. Copy `.env.example` to `.env.local` and fill in your Supabase project URL and anon key.
4. `npm run dev`

## Project structure

```
src/components   Shared UI pieces
src/pages        Route-level views (artwork page, profile page, claim flow, dashboards)
src/lib          Supabase client, auth helpers
src/types        TypeScript types mirroring the database schema
supabase/migrations   SQL schema + RLS policies
```

## Where things stand

Phase 0, slice 1: core schema and RLS policies for profiles, artworks, and the event audit trail
(`supabase/migrations/0001_init_schema.sql`). No UI yet — see SCOPE.md's MVP Build Plan for what's
next.
