# Archive Atlas — Product Requirements Document

_Companion to [SCOPE.md](./SCOPE.md), which covers the technical design (data model, RLS
policies, event schema) in depth. This document covers the product: the problem, the users, the
requirements, and what success looks like. Status: MVP (Phases 0–3) complete as of July 2026._

## Problem

Existing artist-archival tools (Artwork Archive being the category leader) are built as private
inventory-management software: an artist's records live in a database they're renting access to,
structured around what's convenient for the artist's own bookkeeping. They don't establish a
durable, independently verifiable record of a work's history, and they give the artist no lasting
leverage once a piece leaves their hands — the moment a gallery or collector takes over, the
artist typically loses visibility and any claim on what happens next (including resale).

Meanwhile, real provenance and resale-royalty enforcement (droit de suite) barely exists in the
US art market, and where it exists elsewhere it's weakly enforced. Artists have no infrastructure
that follows a piece through its whole life and gives them standing in that history, rather than
being a footnote in a gallery's or auction house's paperwork.

## Vision

Archive Atlas is an artist-first alternative: **the artist is the root of the provenance record**,
not a field in someone else's database. Positioned as a living, artist-authored catalogue
raisonné — the definitive record of an artist's body of work, traditionally compiled by a
scholar or estate after the fact, built here as something the artist owns and controls from day
one.

The long-term goal is to make the artist–gallery relationship fairer and give artists lasting
visibility and leverage over their own work — including, eventually, enforceable resale
participation — using Stellar specifically where it earns its place (tamper-evident records now,
atomic settlement later) rather than blockchain for its own sake.

## Goals (MVP)

- Give any artist — with or without gallery representation, with or without crypto experience —
  a place to create a durable, tamper-evident record of their work that they control.
- Make that record genuinely independently verifiable (anchored on Stellar), not just "trust our
  database."
- Support the real mechanics of how art actually changes hands — consignment, agent-executed
  sales, loans, exhibitions — without forcing them into a simple buyer/seller model that doesn't
  match reality.
- Lay the technical and trust groundwork for real resale-royalty enforcement later, without
  requiring it (or any blockchain literacy at all) to get value from the platform today.
- Solve the cold-start problem: a collective, gallery, or curator should be able to log historical
  work on behalf of an artist who isn't on the platform yet, without ever being able to
  impersonate that artist for anything that actually moves ownership.

## Non-Goals (explicitly out of scope for this phase)

- Tokenized title or on-chain ownership as the source of truth — this MVP is an audit trail, not
  a title registry.
- Atomic delivery-vs-payment settlement.
- Automatic or enforced collection of resale royalties (the field exists; the collection
  mechanism doesn't).
- Sales-data aggregation from Artsy, LiveArt, MutualArt, etc. — a licensing/partnership problem,
  not an engineering one, and not worth pursuing before the archival product has real users.
- Condition/appraisal tooling, insurance integrations.
- Adjudicating estate or succession disputes — the platform records an artist's own designated
  successor; it does not decide who a rightful heir is.

## Target Users

- **Artist** (primary) — the root identity for their own work. Wants a record they own outright,
  optionally under a personal name and a studio/business alias together, without needing a
  lawyer or a crypto wallet to get started.
- **Collective / Studio** — represents multiple artists; needs to bootstrap records for artists
  who aren't on the platform yet, without ever being able to fabricate a sale under their name.
- **Gallery** — sells and holds work on consignment; needs standing to log a sale as an agent
  without owning the artist's record.
- **Curator** — logs exhibition history; shouldn't need heavyweight verification to log a small
  show, but shouldn't be trusted equally to "shown at MoMA" without corroboration either.
- **Collector** — acquires and holds work; wants provenance to work in their favor (authenticity,
  resale value) without being forced into a public ownership registry that's a real security risk
  for high-value physical assets.

## Core User Stories

- As an **artist**, I can create a canonical record for a new piece — images, medium, dimensions,
  date, edition info, condition, a suggested resale royalty — that only I (or someone I've
  authorized) can edit.
- As an **artist**, I can prove it's really me by claiming a profile via email/social
  verification, without needing a wallet to start.
- As an **artist**, I can later link a real Stellar wallet so that my most important records
  (a piece's creation, a sale) are cryptographically signed by me personally, not just recorded by
  the platform on my behalf.
- As an **artist or owner**, I can log a sale, a loan to a gallery, or a consignment, and the
  record correctly distinguishes "who owns it" from "who's holding it right now."
- As a **collective**, I can create a placeholder record for an artist who isn't on the platform
  yet, and everything I log on their behalf stays honestly labeled as mine until they claim it.
- As a **curator or gallery**, I can log that a piece was in a show, and the artist can
  corroborate it later to raise its trust level.
- As a **collector**, I can keep my identity private while still having the fact and timing of my
  ownership be part of the piece's public provenance chain.
- As an **artist or collective**, I can select any set of my pieces and generate a printable
  checklist/catalog for a submission, show, or portfolio review.
- As any **visitor**, I can view a piece's full public provenance timeline without an account.

## Functional Requirements

### Identity & trust
A progressive trust ladder rather than a binary verified/unverified state: **unclaimed** (created
on an artist's behalf) → **claimed** (artist verified via email/social) → **wallet-linked** (a
real Stellar keypair backs the artist's own attestations going forward). Every profile has one or
more current controllers — the identities authorized to act on its behalf — generalizing
individual artists and multi-person organizations (collectives, galleries) under the same
mechanism. *Shipped.*

### Artwork records
Rich per-piece records (images with a primary-image picker, medium, structured and free-text
dimensions, date with circa/override support, edition info, description, tags, subject matter,
signature status, condition, a private-notes field only the artist ever sees, co-artist
attribution for collaborative pieces, and a suggested resale-royalty percentage). *Shipped.*

### Provenance events
An append-only audit trail distinguishing who *performed* an action (actor) from whose ownership
or custody actually *changed* (party) — the mechanism that makes agent-executed sales (a gallery
selling consigned work) and posthumous succession work correctly without special-casing. Event
types: creation, ownership transfer, custody change, claim, exhibition (open self-logging with
artist corroboration), condition report. Dispute and succession event types are defined for
future use; only artist-designated succession has UI today. *Shipped*, except dispute logging.

### Stellar anchoring & wallet-linking
Every event's canonical content is hashed and anchored on Stellar testnet, independently
verifiable outside the platform's own database. Anchoring is platform-signed by default (proves
content existed unaltered at a point in time); once an artist links their own wallet, their
highest-stakes events (creation, ownership transfer) are anchored under their own signature
instead, with the platform independently re-verifying that signature before trusting it.
*Shipped, testnet only.*

### Discovery & export
A public per-artist profile (bio, CV, avatar, trust badge, full work grid) and per-piece page
(full public provenance timeline). Single-piece and multi-piece (catalog) printable/PDF export
for submissions, shows, and portfolio use. A curator- or collector-facing view of every
exhibition a profile has logged, with corroboration status. *Shipped.*

## Trust & Integrity Model (summary)

The platform never silently upgrades trust. An event logged by a collective on an unclaimed
artist's behalf stays honestly labeled as such even after that artist claims their profile —
nothing is retroactively rewritten. A sale logged by an agent (gallery) who isn't the current
owner is a lower-trust, flaggable claim unless a prior custody record establishes their standing
to sell. Exhibition claims start "self-logged" and can be corroborated by the artist, mirroring
the same graduated-trust pattern as claiming a profile in the first place. Collector identity is
private by default, but the fact and timing of a transfer stay part of the public chain — the
artist always retains full visibility regardless of a collector's privacy setting.

## Success Metrics

Pre-launch / early-adopter framing, roughly in order of what should be true first:

- Artists can complete profile claim → first artwork record → first anchored event without
  assistance.
- A meaningful share of an artist's high-stakes events (creation, sale) are wallet-signed rather
  than platform-signed, once wallet-linking is adopted — a proxy for artists actually exercising
  the cryptographic control the product is built around, not just using it as a database.
- Collectives/galleries successfully onboard artists who weren't previously on the platform via
  unclaimed profiles, and a meaningful share of those profiles get claimed.
- Zero incidents of an unclaimed profile being used to execute a real ownership transfer before
  the artist consented (this is an RLS-enforced invariant, not just a goal).
- Artists report the catalog/print export is actually used for real submissions or shows.

## Risks & Open Questions

- **Legal meaning of an attestation.** Not resolved here — needs real art-law and
  fintech/blockchain counsel before any public launch, especially once Phase 2+ settlement work
  begins (tokenized settlement can brush up against securities law depending on structure).
  Product copy stays deliberately conservative until then ("a claim made by X as of date," never
  "verified authentic").
- **Estate/succession disputes.** The platform records an artist's own designated successor but
  does not adjudicate rightful-heir disputes — a notoriously contentious area the platform should
  stay out of by design, not by omission.
- **Key-management UX for non-crypto-native artists.** Wallet-linking (Freighter, Friendbot
  funding, live signature approvals) is the single biggest UX gap between "artist" and "web3
  user" today; this needs real usability attention before it's asked of a general artist
  audience, not just an early adopter comfortable with wallets.
- **Sales-data licensing.** Aggregating real market data from Artsy/LiveArt/MutualArt is a
  partnership problem, not a technical one — worth revisiting once there's a real user base to
  bring to that negotiation, not before.
- **Mainnet migration.** Everything today is Stellar testnet. Moving to mainnet is a real
  decision point (real fees, real key custody stakes) that should follow real usage, not precede
  it.

## Roadmap

- **Phase 0 — core product, no chain.** ✅ Done.
- **Phase 1 — Stellar anchoring (platform-signed).** ✅ Done, verified live.
- **Phase 2 — wallet-linking tier.** ✅ Done.
- **Phase 3 — richer role workflows** (royalty field, exhibition logging + corroboration,
  condition reports, catalog export, curator dashboard). ✅ Done — closes out the MVP.
- **Phase 4+ (future, not scoped yet)** — tokenized title, atomic delivery-vs-payment settlement,
  enforced resale-royalty collection, sales-data aggregation partnerships, mainnet migration,
  dispute adjudication tooling, condition/appraisal/insurance integrations.

See [SCOPE.md](./SCOPE.md) for the full technical design behind every item above, and
[README.md](./README.md) for setup instructions.
