# Archive Atlas

An artist-first archival and provenance platform in founder-led private beta. Archive Atlas is
the canonical system of record for artworks, collections, provenance, condition, consignments,
valuation, and Certificates of Authenticity, with independently verifiable event proofs on
Stellar.

See [PRD.md](./PRD.md) for the current product requirements and private-beta exit criteria,
[SCOPE.md](./SCOPE.md) for the technical design and data model, and
[SYNDICATION.md](./SYNDICATION.md) for the proposed self-site publishing protocol.

## Stack

Vite + React + TypeScript, Supabase (Postgres + Auth + Row-Level Security). No local database —
development connects to a hosted Supabase project.

## Setup

1. `npm install`
2. Create a Supabase project (or use an existing one), then run the SQL in
   `supabase/migrations/` against it (via the Supabase SQL editor or the Supabase CLI), in order.
3. Copy `.env.example` to `.env.local` and fill in your Supabase project URL and anon key.
4. Deploy `supabase/functions/anchor-event/` as a Supabase Edge Function and set the
   `STELLAR_ANCHOR_SECRET` secret to a funded Stellar key for the selected network (optional —
   the app works without it; events just won't be anchored on Stellar).
5. Deploy `supabase/functions/link-wallet/` as a Supabase Edge Function for verified wallet
   linking (no extra secrets to set — it only uses the auto-provided Supabase ones).
6. `npm run dev`

## Test on a phone

For private testing on a phone connected to the same Wi-Fi network as the Mac:

1. Run `npm run dev:phone`.
2. Open the `Network` address Vite prints, using port `5182`, on the phone.
3. Add that exact origin plus `/**` to Supabase Authentication > URL
   Configuration > Redirect URLs so email sign-in links can return to the phone.

This only exposes the development server to devices on the local network. Local development
should use a test Supabase project, Stellar testnet, and test wallets unless a production
verification is being performed deliberately. Remote and invited testing should use the HTTPS
beta deployment rather than exposing a development server beyond the local network.

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
images, and a read-only provenance snapshot) via its `atlas-import` Edge Function — full contract
in that repo's `docs/09-archive-atlas-integration.md`. Pricing/availability
are set in JGA Studio and never touched by pushes.

## Certificates of Authenticity

After running `supabase/migrations/0024_authenticity_certificates.sql`, a
controller of the root artist can issue a Certificate of Authenticity from an
artwork page. Each COA is a numbered, immutable snapshot of the canonical
artwork record with a SHA-256 fingerprint and public QR verification link.
Issuing an updated version marks the previous certificate as superseded rather
than overwriting it; revocations also remain publicly visible for audit.

COAs intentionally omit current ownership and artwork value. A certificate
verifies authorship and object identity, but it is not proof of title, appraisal,
or market value. The browser print dialog produces a print or PDF copy.

Artists can organize ordered bodies of work under **Collections** after running
`supabase/migrations/0021_collections.sql`. Collection records, covers, and
artwork order belong to Archive Atlas. For Jay's allowlisted profile only, a
saved collection can be pushed with all of its works to JGA Studio as a draft;
JGA decides separately whether the collection appears on Discover.

JGA Studio is a private integration for Jay Golding's root artist profile,
enabled by `supabase/migrations/0020_profile_integrations.sql`. Its controller
sees a **JGA Studio** panel on each of Jay's artwork pages; other artists never
receive artwork or collection push controls, and the Edge Function independently
enforces the same allowlist. Re-pushing is safe: JGA upserts by artwork or
collection id, diffs images by content hash, and preserves JGA-owned publication
and commerce settings.

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

## Stellar network configuration

The hosted private beta is configured for the Stellar **public network**. Local development
defaults to **testnet** so ordinary development cannot accidentally spend XLM or create public
records. A new environment is moved to mainnet in four coordinated steps:

1. **Create and fund the platform anchor account (you, manually).** Generate a
   fresh keypair in any Stellar wallet and send it ~10 XLM from an exchange.
   Archive Atlas writes and removes each event data entry in the same transaction,
   so event proofs remain in transaction history without accumulating account
   subentries or minimum-balance reserves. Never reuse the testnet key.
2. **Function secrets** on `anchor-event`:
   `STELLAR_NETWORK=mainnet` and `STELLAR_ANCHOR_SECRET=<the new mainnet secret key>`.
3. **Site env** on Vercel: `VITE_STELLAR_NETWORK=mainnet`, then redeploy.
4. **Run `supabase/migrations/0023_anchor_network.sql`** (labels all existing
   anchors as testnet).

What changes at cutover: new anchors land on the public network and explorer
links point at `stellar.expert/explorer/public`; historical testnet anchors
keep their testnet labels and links (history is never relabeled). Friendbot
funding is disabled on mainnet — a collector or artist linking an unfunded
wallet is told to fund it themselves (~2 XLM) rather than the platform ever
touching real funds. Artists' wallets (Freighter etc.) must be switched to
the Public network to sign.

Both sides must flip together: a mainnet site against a testnet function (or
vice versa) will fail signature verification on wallet-signed anchors —
that's intentional.

Each anchor transaction contains a `manage_data` write followed by deletion of
the same entry. The immutable transaction still proves the event hash, while the
anchor account does not retain one reserve-consuming subentry per event. A later
anchor also removes up to 98 stale `event:` entries left by older deployments.

## Where things stand

The original MVP phases are complete. The hosted app is now in founder-led private-beta
stabilization with:

- passwordless authentication, profile claiming, trust tiers, and collector privacy;
- single and batch artwork creation, persistent drafts, editable multi-image records, valuation,
  collaborators, and private notes;
- provenance timelines, ownership and custody workflows, exhibition corroboration, condition
  reports, and private consignment management;
- ordered Collections, printable artwork/catalog records, and versioned Certificates of
  Authenticity with public verification;
- network-aware Stellar anchoring on mainnet for new hosted-beta events, including verified
  artist-wallet signatures for wallet-linked genesis and ownership-transfer events; and
- a server-allowlisted, one-way JGA Studio publishing integration for Jay Golding's profile only.

The present priority is reliability rather than feature expansion: visible anchor status and
retries, mobile and cross-browser smoke tests, condition-report clarity, monitoring, recovery,
privacy review, and invited-tester readiness. See [PRD.md](./PRD.md) for the acceptance criteria
and [SCOPE.md](./SCOPE.md) for the implementation breakdown.
