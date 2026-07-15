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

## Test on a phone

For private testing on a phone connected to the same Wi-Fi network as the Mac:

1. Run `npm run dev:phone`.
2. Open the `Network` address Vite prints, using port `5182`, on the phone.
3. Add that exact origin plus `/**` to Supabase Authentication > URL
   Configuration > Redirect URLs so email sign-in links can return to the phone.

This only exposes the development server to devices on the local network. Keep
the app on Stellar testnet and use test data/test wallets until a separate HTTPS
staging deployment is configured.

## Project structure

```
src/components   Shared UI pieces
src/pages        Route-level views (artwork page, profile page, claim flow, dashboards)
src/lib          Supabase client, auth helpers
src/types        TypeScript types mirroring the database schema
supabase/migrations   SQL schema + RLS policies
```

## Push to JGA Studio

Archive Atlas is the system of record for artwork identity; the
[JGA Studio](https://github.com/kwame89/jga-studio) storefront receives a
one-way push of each record (title, medium, dimensions, description, tags,
images, provenance link) via its `atlas-import` Edge Function — full contract
in that repo's `docs/09-archive-atlas-integration.md`. Pricing/availability
are set in JGA Studio and never touched by pushes.

Root-artist controllers see a **JGA Studio** panel on each artwork page.
Re-pushing is safe: JGA upserts by artwork id and diffs images by content
hash.

To enable it, deploy `supabase/functions/push-to-jga` and set three function
secrets:

```
JGA_IMPORT_URL          https://<jga-project>.supabase.co/functions/v1/atlas-import
JGA_PUSH_SHARED_SECRET  same value as ATLAS_SHARED_SECRET on the JGA side (generate once: openssl rand -hex 32)
ATLAS_PUBLIC_URL        public origin used in provenance links, e.g. https://your-atlas-domain.com
```

On the JGA side, run its `supabase/migrations/20260715000000_atlas_import.sql`
migration, deploy `atlas-import` with `--no-verify-jwt`, and set
`ATLAS_SHARED_SECRET` plus `ATLAS_ROOT_ARTIST_ID` (your Atlas artist profile
uuid — only artworks rooted at that profile are accepted).

## Where things stand

Phase 0 (core product) is complete and verified: auth/claim flow, artwork records with images
and rich detail fields, provenance timelines, ownership/custody transfer logging, collaborators,
a collective dashboard for unclaimed profiles, and print/PDF export. Phase 1 (Stellar testnet
anchoring of event hashes via the anchor-event Edge Function) is deployed and verified live.
Phase 2 (Freighter wallet-linking, with wallet-signed anchoring for genesis/ownership_transfer
events) is built — see SCOPE.md's Phase 2 notes for exactly how it changes anchoring behavior.
See SCOPE.md's MVP Build Plan for the full status breakdown.
