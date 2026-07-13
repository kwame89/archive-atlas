# Archive Atlas — Scope & Design Doc

_Formerly "Artist Archive & Provenance Platform" (working title); branded Archive Atlas as of
July 2026. A living document — expect this to change as the idea develops._

## Vision

An artist-first alternative to Artwork Archive: an archival and provenance platform where the
**artist is the root of the record**, not a field in a gallery's database. The long-term goal is
to make the artist–gallery relationship fairer and give artists lasting visibility and leverage
over their own work — including, eventually, enforceable resale participation — using Stellar
where it genuinely earns its place (tamper-evident records, atomic settlement) rather than
because it's fashionable to be "on-chain."

Positioning idea: this is effectively a **living, artist-authored catalogue raisonné** —
borrowing a term art historians already use for the definitive scholarly record of an artist's
body of work, except authored and controlled by the artist (or their estate) instead of a
third-party scholar, gallery, or estate foundation after the fact.

## MVP Scope: Audit-Trail Provenance

No tokenized ownership, no on-chain settlement yet. The MVP is a permissioned audit trail of
**events** (transfers, custody changes, exhibitions, claims) tied to **artworks** and **profiles**,
with Stellar used to anchor those events so they're tamper-evident and independently timestamped
— not to represent title itself.

## Roles

- **Artist** — the root identity for their own work. May optionally attach a legal/business name
  (e.g. "Studio [Name] LLC") as an alias on their own profile — this does *not* require a
  separate entity or multisig setup by default, per your call to keep the common case simple.
- **Collective / Studio** — a distinct organizational identity that can represent *multiple*
  artists, and can create placeholder profiles on their behalf (see Claiming, below).
- **Gallery** — represents/sells on behalf of artists; logs sales and consignments.
- **Curator** — logs exhibition history; does not affect ownership.
- **Collector** — acquires and holds work; may choose to keep holdings private (see Open
  Questions).

## Identity & Trust Tiers

A progressive ladder rather than a binary verified/not-verified — this is the mechanism that
resolves the "enforced vs. simple" tension from earlier:

1. **Unclaimed** — profile created by a Collective, Gallery, or Curator on behalf of an artist
   who isn't on the platform yet. Clearly labeled as such (e.g. "created by [Collective] on
   [date], unclaimed"). Solves cold start for historical/existing work.
2. **Claimed** — the real artist proves it's them via email/social verification (low friction,
   per your call — this is the barrier-to-entry fix) and takes control of the profile. The legal
   entity name field becomes available here, so "signing alongside personal name" already works
   at this tier without needing crypto.
3. **Wallet-linked** — the artist later pairs a Stellar keypair to their claimed profile.
   Attestations going forward can be cryptographically signed by that key, not just labeled —
   this is where the stronger, Stellar-native trust claim actually kicks in.
4. **(Phase 2) Multisig entity** — an artist who wants their studio/LLC to be a formally
   separate, cryptographically-enforced co-signer can opt into that later. Not required, not
   default.

The **claim event itself is logged in the audit trail** — "profile created by X, claimed by
artist on [date]" — so anything attested before the claim stays honestly labeled instead of
silently becoming artist-verified retroactively.

## Core Data Model (as implemented)

_This section describes the actual database schema (migrations 0001–0011), not just the
conceptual design — implementation status is called out inline below wherever what's built
diverges from what was originally designed._

**profiles** — `id`, `type` (`artist | collective | gallery | curator | collector`),
`trust_tier` (`unclaimed | claimed | wallet_linked | entity`), `display_name`, `legal_name`,
`linked_wallet`, `is_public`, `auth_user_id` (nullable — set on claim), `created_by` (nullable,
for unclaimed profiles), `claimed_at`, `created_at`.

**profile_controllers** — `profile_id`, `controller_profile_id`, `added_at`. The actual
"controllers" mechanism, as a join table rather than an array column — see Profile control &
succession below for the full design. What's actually implemented of it is just the bootstrap
case (a profile becomes its own first controller on claim/creation); full succession and
multisig-threshold approval are not built.

**artworks** — `id`, `title`, `medium`, `dimensions` (free-text override), `height`/`width`/
`depth` (structured, numeric), `year`, `is_circa`, `date_display_override` (for imprecise dates
like "1970s"), `edition_number`/`edition_total`, `description` (public), `tags` (text array),
`subject_matter`, `art_type`, `is_signed`, `signature_notes`, `condition`, `root_artist_id`,
`current_owner_id`, `current_custodian_id`, `created_at`. The detail fields beyond the original
draft (description, structured dimensions, tags, subject matter, signature, condition, circa
dates) were added after a direct comparison against Artwork Archive's actual piece record —
see git history around migration 0008.

**artwork_images** — one-to-many (an artwork can have multiple images), `id`, `artwork_id`,
`url`, `is_primary`, `created_at`, with a partial unique index enforcing at most one primary per
artwork. Backed by a public Supabase Storage bucket (`artwork-images`).

**artwork_private_notes** — `artwork_id` (PK), `notes`, `updated_at`. Deliberately its own table
rather than a column on `artworks`, so "always private" is a real RLS guarantee rather than
something only the UI chooses not to show (artworks.* is fully public-readable via a plain
`select *`).

**artwork_collaborators** — `artwork_id`, `profile_id`, `role`, `added_at`. Additional co-creators
beyond `root_artist_id`, for collaborative pieces. Attribution-only: collaborators are publicly
credited but do not get management rights over the artwork record (images, description,
transfers) — that stays with the root artist's controllers.

**events** — the core audit-trail unit. `id`, `type`, `actor_id` (who executed/logged it — may be
an agent, e.g. a gallery), `artwork_id`, `target_profile_id` (used by `claim`), `from_party_id`/
`to_party_id` (whose ownership/custody actually changed — may differ from actor), 
`disputed_event_id`, `transaction_group_id` (links events fired together as one real-world
transaction), `occurred_at`, `on_chain_anchor_hash` (the Stellar testnet transaction hash of
this event's anchor — populated by the anchor-event Edge Function, see MVP Build Plan below),
`price`, `currency`, `notes`, `created_at`.

Event types defined in the `event_type` enum:
- `genesis` — **implemented.** Artist/collective creates the canonical record for a new work.
- `ownership_transfer` — **implemented.** Title changes hands (sale, gift, inheritance); `price`/
  `currency` populated for real sales.
- `custody_change` — **implemented.** Physical possession changes, ownership does not (loan,
  consignment).
- `claim` — **implemented.** Profile claimed by its rightful artist.
- `exhibition` — **defined, not implemented.** No logging UI or function exists yet; the Curator
  role currently has no actual functionality.
- `condition_report` — **defined, not implemented.**
- `dispute` — **defined, not implemented.** Lower priority, deferred deliberately.
- `succession` — **defined, not implemented.** Lower priority, deferred deliberately.

**Unclaimed profiles are restricted** to being the `party` in `genesis`, `custody_change`, and
`exhibition` events only — enforced at the RLS layer for `ownership_transfer` (requires at least
`claimed`). This exists specifically to prevent a collective (or anyone) from executing a real
sale under an artist's name before that artist has ever consented to being on the platform.

**A collective can also act on behalf of an unclaimed profile it created** — via
`auth_controls_or_created_unclaimed()`, a Postgres RLS helper checking either direct control or
"I created this still-unclaimed profile." This is what makes the collective dashboard's "log a
work on their behalf" flow possible, and is swapped into every policy that gates artwork
management (insert/update on artworks, images, private notes, collaborators).

The actor/party split and transaction grouping exist specifically to handle agent-executed sales
— see the worked example below.

### Profile control & succession

Every profile — individual or organizational — has one or more current **controllers**: the
profile(s) authorized to act as `actor` on its behalf. An individual artist starts with exactly
one controller: themselves. An org-type profile (collective, gallery, etc.) is multi-controller
from the start — the same underlying concept as a foundation's board or a studio's partners,
generalized to every profile instead of invented separately for "institutions."

A `succession` event updates a profile's controller set. This is not a one-time special
allowance for artists — **whoever currently controls a profile has standing to log another
`succession` event**, the same as any controller. That's what makes redesignation recursive
without extra logic: if a successor later wants to name their own successor, they simply are a
controller now, so they can. And if an artist's successor turns out to be a Foundation, the
Foundation doesn't need a separate "successor" mechanic of its own — foundations are already
multi-controller org profiles, and their board changes its own controller list over time exactly
as it would in the real world (a board vote, recorded here as a `succession` event), without the
platform ever needing to model bylaws or elections itself.

For any profile with more than one current controller, changing the controller set should
require approval from a threshold of the existing controllers, not any single one acting alone —
this prevents one rogue controller from unilaterally seizing sole control of an org profile. This
maps directly onto the Phase 2 multisig-entity tier already planned (an M-of-N Stellar multisig)
rather than needing new mechanics: an individual artist profile needs no threshold, being a sole
controller by definition, until the moment succession is triggered and a pre-designated successor
becomes the sole new controller.

### Worked example: a gallery sells a consigned painting

1. Artist logs `genesis` for "Painting A" — artist is both owner and custodian.
2. Artist consigns the work to Gallery G — `custody_change`, custodian artist→gallery. Ownership
   does not change; this record is what gives the gallery standing to sell it later.
3. Gallery G sells the work to Collector C. This is one real transaction with two effects,
   logged as two events sharing a `transaction_group_id`:
   - `ownership_transfer`: party owner artist→collector, `actor` = Gallery G (an agent, not a
     party to the title itself)
   - `custody_change`: custodian gallery→collector
4. Integrity check this enables for free: an `ownership_transfer` logged by an actor who isn't
   the current owner should reference an active `custody_change` establishing their standing to
   sell. A sale claimed by a gallery with no prior consignment record on file is a lower-trust,
   flaggable claim rather than a silently accepted one.
5. The royalty commitment on Painting A (if any) surfaces to the artist on step 3 regardless of
   Collector C's privacy setting, consistent with the artist always retaining visibility.

### Worked example: artist dies mid-consignment

Painting B: `genesis` (artist owns and holds) → consigned to Gallery G (`custody_change`,
ownership stays with the artist) → the artist dies.

- **Successor pre-designated:** succession has two effects, not one — a `succession` event makes
  the successor the profile's sole controller, *and* an `ownership_transfer` fires for every
  artwork the artist still owned at death, including work still out on consignment. Custody
  records are untouched (Gallery G still physically holds the piece); if the gallery later sells
  it, the existing actor/party chain resolves correctly on its own — `actor` Gallery G, `party`
  owner successor→collector — with no special-case logic needed. And because control (not just a
  one-off inheritance) passed to the successor, they now have the same standing to designate
  *their* own successor later — no special-casing required there either.
- **No successor designated:** the profile freeze must explicitly block new
  `ownership_transfer` executions against the artist's owned inventory, not just "attestations"
  in the abstract — otherwise a gallery holding consigned work could keep selling it with no
  legitimate authority behind the sale, before any estate has been verified.

### Worked example: an unclaimed profile gets claimed after events already exist

Collective X creates an unclaimed profile for Artist J and logs a `genesis` event on their
behalf for Painting C (`actor` Collective X, `party` = Artist J's profile). Later, Artist J
discovers the platform and claims that same profile.

Because a profile keeps the same ID across the unclaimed→claimed transition — only `trust_tier`
changes — nothing needs to be migrated or reattributed. The prior event already correctly shows
`actor` Collective X, `party` Artist J. If Artist J believes something logged before they
claimed was wrong or fabricated, they log a `dispute` against it (see Event types, above)
rather than the record being silently rewritten.

**Royalty commitment** (optional, attached to an artwork or transfer) — a suggested resale
royalty percentage, unenforced in the MVP. This is the seed for enforceable artist resale
royalties once a payment/settlement layer exists in Phase 2 — a real, largely unsolved gap in
the US art market (droit de suite barely exists here and is poorly enforced even in
jurisdictions that have it). **Status: designed, never implemented** — no field for this exists
anywhere in the actual schema. Worth picking back up; it's a small addition (one nullable numeric
column on `artworks` or `events`) with real relevance to the mission.

## Where Stellar Fits (MVP)

- Anchor a hash of each Event on Stellar (e.g. `manage_data` or a light Soroban contract) so
  records are tamper-evident and independently verifiable — without putting rich data
  (images, descriptions) on-chain.
- Once an artist reaches the wallet-linked tier, their attestations are actually signed by
  their key, not just labeled as theirs.
- Everything beyond this (tokenized title, atomic payment+transfer settlement, royalty
  enforcement) is explicitly Phase 2 — see below.

## Things borrowed from how the art world actually works

Flagging a few things worth designing for now, even if not built in the MVP, based on how
provenance and the art market actually function:

- **Custody ≠ ownership.** Loans and consignments are extremely common and must *not* be
  modeled as transfers — a gallery holding work on consignment doesn't own it. This is probably
  the single most important modeling distinction to get right early, since retrofitting it later
  means migrating a lot of historical events.
- **Editions and multiples.** Prints, photography, and sculpture are often released in numbered
  editions — an "Artwork" record may need to represent one numbered piece within an edition, not
  just a single unique object.
- **Privacy vs. transparency.** Many collectors deliberately avoid public ownership registries
  for security reasons (being publicly known to own valuable art is a real burglary/insurance
  risk). Recommend: on-chain anchors are just hashes, never human-readable ownership data; the
  actual record stays in a permissioned store with per-collector visibility controls — while the
  artist retains standing visibility regardless of the collector's privacy setting, consistent
  with the artist-power goal.
- **Estates & foundations.** Plan the identity model so a claimed artist profile can eventually
  hand stewardship to an estate or foundation after death — this is exactly how real catalogues
  raisonnés are maintained today (e.g. artist foundations), and it's much easier to design the
  successor relationship in now than to bolt it on later.

## MVP Build Plan

**Screens:** artwork page (public provenance timeline) ✅, profile page (trust-tier badge, claim
status) ❌ **not built — no `/profiles/:id` route exists; every name mention is plain text, not
a link**, claim flow (email/social verification) ✅, role-gated event-logging forms ✅ (for
genesis/ownership_transfer/custody_change — not for exhibition, see below), a collective/studio
dashboard for managing member profiles ✅, and collector privacy settings ❌ **not built — the
private-by-default behavior exists in `createProfile`, but there's no settings UI for a
collector to change it**.

**Phased order:**
- **Phase 0 — core product, no chain.** ✅ **Done.** Profile/Artwork/Event CRUD, email/social
  claim flow, role-gated event logging, public provenance timeline, plus a good deal beyond the
  original scope of this phase (multi-image support, editable dates, richer artwork fields,
  print export, collaborators, the collective dashboard).
- **Phase 1 — Stellar anchoring.** ✅ **Done and verified live** (July 2026). The `anchor-event`
  Supabase Edge Function hashes an event's canonical fields and anchors the hash on Stellar
  testnet via a `manage_data` operation, signed by a platform-controlled testnet keypair (held
  as an Edge Function secret, never client-side). The client fires it after every
  genesis/transfer/custody/claim event creation — fire-and-forget, so anchoring failures never
  block or undo the database record. Anchored events show a Stellar Expert link in the
  provenance timeline. Note: platform-signed anchoring proves an event's content existed
  unaltered at a point in time; it does not prove the artist personally signed it — that's
  what Phase 2 wallet-linking adds.
- **Phase 2 — wallet-linking tier.** Not started (expected — depends on Phase 1). Artist pairs a
  Stellar keypair; new attestations get actually signed.
- **Phase 3 — richer role workflows.** Partially done: royalty-commitment field is
  designed in this doc but was never actually added to the schema (a real gap, not just
  deferred). Exhibition logging and condition reports are defined as event types but have no
  logging UI — the Curator role currently has no functionality at all.
- **Phase 4+** — everything below, already out of scope for the MVP.

## Explicitly Out of Scope for MVP (Phase 2+)

- Tokenized title / on-chain ownership as the source of truth
- Atomic delivery-vs-payment settlement
- Enforced resale royalty collection
- Sales-data aggregation from Artsy, LiveArt, MutualArt, etc. (licensing/partnership problem,
  not an engineering one — revisit once the archival product has real users)
- Condition/appraisal tooling, insurance integrations

## Resolved Design Decisions

**Collector privacy.** Default private identity, but the *fact* of a transfer (that one
happened, and when) stays part of the public provenance chain — the chain of custody keeps
doing its authentication job without exposing who currently owns the work. This mirrors how the
market already operates (auction houses routinely report "sold to a private collector" with no
name attached). The artist always sees the real identity regardless of the collector's privacy
setting, consistent with the artist-power goal; collectors can opt into full public attribution
if they want the reputational upside.

**What an attestation legally means.** Not something to resolve unilaterally in this document —
flagged for real legal review before public launch, ideally counsel with both art-law and
fintech/blockchain experience (Phase 2's tokenized settlement in particular can brush up against
securities law depending on structure). In the meantime, product copy should stay conservative
and match how existing provenance databases limit liability: an attestation is "a claim made by
[profile] as of [date]," not "verified authentic."

**Exhibition events.** Reuse the same graduated trust-tier pattern as artist claiming rather than
inventing a new rule: any curator can self-log a show (low friction), starting at a "self-logged"
tier. It upgrades to "corroborated" if the artist or gallery co-confirms, and to
"institution-verified" later if a formal institution profile type is added. Exhibition history
genuinely inflates market value ("shown at MoMA in 1998"), so treating every claim as equally
trustworthy would be a real integrity gap — but requiring heavyweight verification up front would
kill adoption from independent curators and small shows.

**Succession & estates.** The platform should not try to adjudicate who the rightful heir is —
authentication-rights disputes after an artist's death are a notoriously contentious, sometimes
litigious corner of the art world, and a platform that tries to decide that itself is a platform
that gets sued. Instead: a claimed artist can pre-designate a successor while alive, recorded as a
`succession` event that makes the successor the profile's sole controller (a clean, artist-chosen
designation with no dispute). Because control — not a one-off inheritance — passes to the
successor, they automatically have the same standing to designate their own successor later, and
if the successor is a Foundation, its own board simply manages its multi-controller profile going
forward without needing a separate mechanic (see Profile control & succession, above). If no one
was designated, freeze new attestations on that profile but keep the full historical archive
readable — it's an archive, so read access should never be blocked — and require real
off-platform legal proof (executor/estate documents) before granting control to a new profile.
The freeze must explicitly cover new `ownership_transfer` executions against the artist's owned
inventory (including consigned work still held by a gallery), not just profile-level attestations
in the abstract — see the succession worked example below for why.
