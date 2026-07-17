# Archive Atlas — Self-Site Syndication Spec

**Status:** Concept approved by Jay 2026-07-16 · not yet implemented
**Decisions locked:** audience = both, phased (builders first, embed widget
second) · mechanism = public feed + signed change ping · scope = public
catalog only · pricing = free during beta, pro-gating kept possible.

## 1. What this is

Any Atlas artist can power **their own website** from their Atlas record:
Atlas becomes a headless catalogue raisonné. Their site *pulls* a public,
versioned JSON feed; an optional signed webhook *pings* their site when
something changes so static sites can rebuild. No artist-side receiver is
required for the core path — that's the difference from the private JGA
Studio push, which stays a bespoke, allowlisted integration.

```
Artist edits in Atlas ──> feed reflects it immediately (pull)
                     └──> ping fires: {"type":"artwork.updated", ids…}
                          artist's site rebuilds / revalidates (thin ping, fat pull)
```

## 2. Phase A — public feed + change ping (builders)

### 2.1 Feed endpoints (new `atlas-feed` Edge Function, GET, CORS-open)

| Route | Returns |
|---|---|
| `/v1/profiles/:id` | Public profile (name, bio, avatar, trust badge) + artwork index (id, title, primary image, updated_at) |
| `/v1/artworks/:id` | Full public record: identity fields, tags, edition info, all image URLs (+ content hashes for diffing), public provenance timeline (event type, date, proof status, anchor network/hash), certificate status once COA ships |
| `/v1/collections/:id` | Collection with ordered artwork index |

Rules:
- **Public-RLS data only.** Never private notes, consignments, valuations,
  or collector identities beyond what the public timeline already shows.
  The feed runs the same anon-visible queries the public site runs — it can
  never leak more than archiveatlas.art itself does.
- **Versioned in the path** (`/v1/`); breaking changes mean `/v2/`, never a
  mutation of `/v1/`.
- **Cacheable:** `ETag` from a content hash + `Cache-Control: public,
  max-age=60`. Consumers are told to cache/copy images at build time
  (storage egress is on us; revisit CDN if beta usage grows).
- **Rate limit:** coarse per-IP limit (start: 120 req/min) inside the
  function; entitlement hook left for a future pro tier.

### 2.2 Change ping (webhooks)

New table `syndication_destinations`:
`profile_id · url (https only) · secret · active · consecutive_failures ·
created_by · created_at`. Managed by profile controllers via an Edge
Function (all-writes-through-functions, per Atlas convention); secret is
generated server-side, shown once, stored for signing outbound pings only.

- **Trigger:** artwork/collection create-update, image changes, new public
  provenance events → enqueue a ping.
- **Payload is thin on purpose:** `{"type":"artwork.updated",
  "artwork_id":…, "profile_id":…, "occurred_at":…}` — the site re-pulls the
  feed for truth ("thin ping, fat pull"), so a spoofed or replayed ping can
  at worst cause an extra fetch of public data.
- **Signing:** same convention as the JGA push — HMAC-SHA256 over
  `${timestamp}.${body}`, headers `x-atlas-timestamp` / `x-atlas-signature`,
  5-minute replay window. One signing scheme platform-wide.
- **Delivery hygiene:** retries with backoff (1m/5m/25m), auto-disable a
  destination after 8 consecutive failures (artist re-enables in UI),
  per-destination delivery log (last status, last success).
- **SSRF guard:** https only, public hostnames only (reject IP literals,
  localhost, private ranges), no redirects followed.

### 2.3 Developer experience

- `SYNDICATION.md` (this doc) doubles as the public API contract.
- Ship two copy-paste examples in `examples/`: a Next.js
  `revalidate`-on-ping route, and an Astro/static rebuild hook (Vercel
  deploy-hook forwarding), each ~30 lines.

## 3. Phase B — embed widget (everyone else)

A single script tag (`<script src="https://archiveatlas.art/embed.js"
data-profile="…">`) that renders a gallery / single-work card / provenance
timeline from the same `/v1/` feed, theme-aware and unbranded-enough for
artist sites. No build tools, works on Squarespace/Wix/Cargo. Scoped
after Phase A ships and the feed schema has survived contact with real
builders.

## 4. Relationship to the JGA Studio integration

JGA's `push-to-jga` → `atlas-import` pipeline stays as-is: it is a
*private, allowlisted, true-push* integration with image copying and
commerce-field protections that general syndication deliberately doesn't
have. Long-term, JGA Studio could additionally consume the public feed,
but nothing requires that. The canonical artwork JSON shape should stay
aligned between the push payload and `/v1/artworks/:id` so consumers and
integrations speak one dialect.

## 5. Out of scope (explicitly)

- Private-field syndication / API keys (would need a permissions UI; only
  if real demand appears)
- Write-back from artist sites into Atlas (Atlas stays the sole author)
- Per-destination custom payload shapes
- Sales/commerce data of any kind

## 6. Open questions

- Image bandwidth: at what beta usage do we front storage with a CDN or
  require build-time copying?
- Destination verification handshake (prove-you-own-this-URL challenge)
  before first ping — nice hardening, adds registration friction; decide
  during implementation.
- Does the embed widget carry an "Archive Atlas" attribution mark by
  default (adoption loop) with a pro option to remove it?

## Changelog

- v0.1 (2026-07-16) — Initial concept from Jay's decisions (audience,
  mechanism, scope, pricing) in working session.
