# Archive Atlas — Product Requirements Document

- **Product stage:** Founder-led private beta
- **Current tester group:** Founder only; invited external testing has not started
- **Production surface:** Responsive web application at `beta.archiveatlas.art`
- **Last updated:** July 17, 2026
**Companion documents:** [SCOPE.md](./SCOPE.md) for technical design and
[SYNDICATION.md](./SYNDICATION.md) for the proposed self-site publishing protocol

## Product Summary

Archive Atlas is an artist-first archival and provenance platform. It gives an artist a durable
system of record for artworks, collections, condition, exhibition history, custody, ownership,
consignment, valuation, and authenticity documentation. Important provenance events can be
independently timestamped on Stellar without making blockchain knowledge a prerequisite for
using the archive.

The product is not a marketplace and does not treat an on-chain record as legal title. Its core
promise is narrower and more useful: preserve an artist-authored record, make its history harder
to alter silently, and keep the artist connected to that record after the artwork leaves the
studio.

## Problem

Most artist inventory tools are private bookkeeping systems. They are useful while an artwork is
in the studio, but the artist often loses visibility once a gallery, collector, estate, or other
party takes custody or ownership. These systems also ask users to trust the platform's database
without giving them an independent way to verify when a provenance claim was recorded.

Traditional provenance records are fragmented across invoices, gallery files, exhibition lists,
collector records, certificates, and institutional archives. The artist, despite being the
origin of the work, is frequently reduced to one field in records maintained by other parties.

Archive Atlas addresses that gap by making the artist the root of the record and by modeling the
real distinctions between authorship, ownership, custody, agency, exhibition, condition, and
commercial terms.

## Vision

Archive Atlas should become a living, artist-authored catalogue raisonne: a definitive record of
an artist's body of work that begins during the artist's lifetime and can continue through
collectors, galleries, estates, and foundations without erasing who made each claim.

The long-term opportunity is to give artists lasting leverage over their work, including better
provenance, safer consignment practices, stronger authenticity documentation, broader publishing
control, and eventually meaningful resale participation. Stellar is used where it adds
verifiability and artist-controlled signatures, not as a reason to turn artworks into tokens.

## Product Principles

1. **The artist is the root.** The canonical record begins with the artist, not a marketplace,
   gallery, collector, or blockchain asset.
2. **Preserve who said what.** A claim may gain corroboration, but its original actor and context
   are never silently rewritten.
3. **Custody is not ownership.** Loans and consignments must not masquerade as title transfers.
4. **Useful without crypto.** Email sign-in and platform anchoring provide immediate value;
   wallet linking is a progressive trust step.
5. **Privacy is structural.** Private notes, consignment agreements, and collector identities are
   protected by database policy, not merely hidden by the interface.
6. **Proof is not title.** A timestamped hash or Certificate of Authenticity supports a record; it
   does not independently establish legal ownership, appraisal, or market value.
7. **The archive remains portable.** Archive Atlas is the system of record, while controlled
   publishing integrations let artists reuse that record elsewhere.

## Product Stage and Scope

The original MVP phases are complete. Archive Atlas is now in **private-beta stabilization**:
the founder is the sole active tester, the hosted beta is connected to production services, and
the next milestone is a small invited test group rather than a broad public launch.

The current hosted beta uses the Stellar public network for new anchors. The code remains
network-configurable, and historical testnet anchors retain their original network labels and
verification links.

### Current goals

- Let an artist establish a complete canonical artwork record without assistance.
- Preserve drafts and support efficient single-artwork, multi-image, and batch creation flows.
- Record provenance and operational history using roles that match the art world.
- Make important events independently verifiable while clearly distinguishing platform-signed
  from artist-wallet-signed records.
- Generate versioned, publicly verifiable Certificates of Authenticity.
- Organize artworks into ordered collections or series.
- Provide useful printable records and controlled publishing to approved external surfaces.
- Stabilize mobile use, authentication, anchoring, and recovery before inviting external testers.

### Current non-goals

- Tokenized title or on-chain ownership as the legal source of truth.
- Atomic delivery-versus-payment settlement.
- Automatic or enforced resale-royalty collection.
- A general art marketplace, auction platform, or payment processor.
- Professional appraisal, conservation, or insurance-provider integrations.
- Automated sales-data aggregation from Artsy, LiveArt, MutualArt, or similar services without a
  licensing partnership.
- Adjudication of authenticity, estate, succession, ownership, or inheritance disputes.
- General access to the private JGA Studio publishing integration.

## Target Users

### Artist — primary user

Creates and maintains the canonical record, documents condition and history, issues
Certificates of Authenticity, organizes collections, manages consignments, and optionally links
a Stellar wallet for artist-signed attestations.

### Collective or studio

Creates honest placeholder profiles and records for artists who are not yet using the platform,
while preserving the distinction between the collective's claim and the artist's own claim.

### Gallery or dealer

Holds work on consignment, records custody, documents exhibitions, and may execute an authorized
sale without being misrepresented as the owner or artist.

### Curator

Logs exhibition history that the artist can later corroborate. Curatorial claims begin as
self-logged rather than automatically receiving institutional authority.

### Collector

Benefits from provenance and authenticity records while retaining control over public identity.
The occurrence and timing of a transfer can remain in the provenance chain without publishing a
private collector's profile.

### Public visitor

Views an artist's public profile, artwork record, provenance timeline, and certificate
verification page without needing an account.

## Core User Journeys

1. **Claim and begin an archive.** A user signs in by email, creates or claims a profile, completes
   the artist profile, and creates the first artwork without requiring a wallet.
2. **Create an artwork record.** The artist adds one or more images, descriptive and physical
   metadata, edition and signature details, initial condition, valuation, private notes,
   collaborators, and a suggested resale royalty.
3. **Resume unfinished work.** A single-artwork draft survives tab changes or navigation until it
   is submitted or explicitly discarded.
4. **Create in volume.** The artist can add multiple artwork records through the batch flow, then
   refine each record and add, replace, reorder, or remove images later.
5. **Document provenance.** An authorized actor records creation, ownership, custody, exhibition,
   condition, claim, or related history. The public timeline identifies the actor and the parties
   affected by the event.
6. **Strengthen trust with a wallet.** A claimed artist links a compatible Stellar wallet. Future
   genesis and ownership-transfer events require that wallet's live signature; lower-friction
   events continue to use platform anchoring.
7. **Manage a consignment.** The owner records the consignee, asking price, commission, term,
   insurance, agreement, and outcome without conflating custody with ownership.
8. **Issue a Certificate of Authenticity.** A claimed artist controller issues an immutable,
   numbered certificate snapshot with a fingerprint and public QR verification page. A revision
   creates a new version and supersedes the previous one.
9. **Build a collection.** The artist creates an ordered body of work, chooses a cover, and
   controls artwork membership and order.
10. **Publish selected records.** The approved Jay Golding profile can push artworks or
    collections to JGA Studio while JGA Studio retains control of storefront publication,
    availability, and pricing.

## Functional Requirements

Status labels in this section mean:

- **Shipped:** implemented in the application and data model.
- **Beta refinement:** implemented, but requires additional usability or reliability work before
  wider testing.
- **Planned:** specified but not yet implemented.

### 1. Authentication, identity, and trust

- **Shipped:** Passwordless email sign-in using Supabase Auth and the verified Archive Atlas
  email domain.
- **Shipped:** Profile types for artist, collective, gallery, curator, and collector.
- **Shipped:** Progressive trust tiers: unclaimed, claimed, and wallet-linked.
- **Shipped:** Claim events preserve the history of who created a placeholder profile and when
  the artist took control.
- **Shipped:** Profiles support one or more controllers, with authorization enforced through
  Row-Level Security.
- **Shipped:** Public/private profile controls support collector privacy.
- **Shipped:** Wallet linking verifies control of the selected Stellar address through a signed
  message before storing it on a profile.
- **Beta refinement:** Wallet guidance must explain network selection, account funding, supported
  signing capabilities, rejection, disconnect, and recovery in non-technical language.
- **Planned:** Threshold approval and formal multisig control for organizations.
- **Planned:** Fully implemented succession workflows for estates and foundations.

### 2. Artwork records and media

- **Shipped:** Create, view, and edit canonical artwork records.
- **Shipped:** Record title, artist, medium, artwork type, subject matter, description, tags,
  dimensions, date or date override, edition information, signature status, condition,
  collaborators, and suggested resale-royalty percentage.
- **Shipped:** Record an artist-maintained artwork value and ISO currency as archival metadata.
  This value is not a listing price and does not set commerce pricing in JGA Studio.
- **Shipped:** Store artist-only private notes in a separately protected table.
- **Shipped:** Upload multiple images, select a primary image, add images after creation, and
  replace or remove unwanted files.
- **Shipped:** Create multiple artwork records through an image-led batch workflow.
- **Shipped:** Preserve a new-artwork draft locally across tab changes and navigation until
  submission or discard.
- **Beta refinement:** Draft recovery must make its state visible and must never restore a draft
  over a newer saved record.
- **Planned:** Spreadsheet/CSV import and export for large legacy archives.
- **Planned:** Automated image derivatives and a documented archival-file strategy for original,
  display, and thumbnail assets.

### 3. Collections and bodies of work

- **Shipped:** Controllers can create, edit, and delete collections for an artist profile.
- **Shipped:** A collection supports title, description, year range, ordered artwork membership,
  and a cover selected from its member works.
- **Shipped:** Collection membership is validated so every work belongs to the collection's root
  artist, duplicates are rejected, and updates occur atomically.
- **Shipped:** Collection management is private to the artist's controllers in Archive Atlas.
- **Shipped:** The server-allowlisted JGA Studio integration can push a collection and its member
  artworks as drafts for storefront curation.
- **Planned:** A native public Archive Atlas collection page with artist-controlled visibility.

### 4. Provenance events and condition

- **Shipped:** Public artwork timelines show creation, ownership transfer, custody change, claim,
  exhibition, and condition-report events.
- **Shipped:** Each event distinguishes the actor who logged it from the parties whose ownership
  or custody changed.
- **Shipped:** Transaction grouping supports multiple events generated by one real-world action.
- **Shipped:** Ownership and custody caches update from their respective event workflows without
  conflating the two states.
- **Shipped:** Exhibition claims can be self-logged and later corroborated by the artist.
- **Shipped:** Authorized owners, custodians, and root-artist controllers can log dated condition
  reports with a rating and notes.
- **Beta refinement:** The artwork's current `condition` field must be clearly distinguished from
  a formal condition-report event. Choosing a condition during artwork creation sets the current
  condition; it must not imply that a dated report was created or anchored.
- **Beta refinement:** After saving a formal report, the interface must provide explicit success,
  timeline visibility, and anchoring status instead of closing silently.
- **Planned:** Dispute events and resolution states.
- **Planned:** Supporting-document attachments for provenance claims beyond consignment
  agreements.

### 5. Consignment management

- **Shipped:** Create a private consignment record with consignor, consignee, asking price,
  currency, commission, term dates, insurance responsibility and value, internal notes, and an
  agreement file.
- **Shipped:** Starting a consignment records custody without transferring ownership.
- **Shipped:** Mark a consignment sold or returned while keeping the formal ownership transfer a
  separate action.
- **Shipped:** Private agreement files use protected storage and short-lived signed access URLs.
- **Shipped:** The database enforces at most one active consignment per artwork.
- **Planned:** Renewal reminders, overdue-return alerts, and agreement templates.

### 6. Certificates of Authenticity

- **Shipped:** A controller of a claimed root-artist profile can issue a numbered Certificate of
  Authenticity from an artwork record.
- **Shipped:** A certificate stores an immutable snapshot of canonical authorship and object
  identity fields, a SHA-256 fingerprint, issuer, version, and issue date.
- **Shipped:** Each certificate has a public verification code and QR-compatible URL.
- **Shipped:** Reissuing creates a new version and marks the prior active certificate as
  superseded; revocation remains visible with a reason.
- **Shipped:** Certificates are printable or saveable as PDF through the browser.
- **Shipped:** Certificates intentionally omit current ownership and monetary value.
- **Beta refinement:** Certificate language must consistently state that the document is not
  proof of title, appraisal, or legal ownership.
- **Planned:** Optional artist signature images and tamper-evident downloadable PDF files after
  security and legal review.

### 7. Stellar anchoring and wallet signatures

- **Shipped:** Event content is canonicalized, hashed, and submitted through the `anchor-event`
  Edge Function.
- **Shipped:** The hosted private beta uses Stellar mainnet for new anchors; historical testnet
  anchors retain their original network attribution.
- **Shipped:** Lower-friction events are platform-signed by default. For a wallet-linked actor,
  genesis and ownership-transfer events remain pending until the actor signs with the linked
  wallet.
- **Shipped:** The platform independently verifies a wallet-signed transaction before attaching
  its hash to an event.
- **Shipped:** Every new anchor transaction writes and removes its event proof in the same
  transaction. The transaction history preserves the proof without accumulating reserve-consuming
  account data entries; later anchors also clean stale entries from older deployments.
- **Shipped:** Provenance timelines distinguish artist-wallet-signed events from
  platform-anchored events and link to the correct Stellar network explorer.
- **Beta refinement:** Automatic anchoring needs visible pending, confirmed, and failed states,
  plus a safe retry path. A saved database event must remain valid if Stellar is unavailable.
- **Beta refinement:** Operational monitoring must detect failed or delayed anchors without
  relying on a tester to notice a missing link.
- **Planned:** A public verification explainer that lets a non-technical visitor understand what
  the transaction proves and what it does not prove.

### 8. Public records, dashboards, and export

- **Shipped:** Logged-out visitors can view the public landing page, artist profiles, artwork
  records, and provenance timelines.
- **Shipped:** Profile pages include biography, website, CV, avatar, trust state, and artwork
  grid.
- **Shipped:** Artists can review daily archive activity, exhibition history, collections, and
  management tasks from authenticated views.
- **Shipped:** Single-artwork and multi-artwork catalog views support browser print and PDF
  output.
- **Shipped:** Certificate verification pages work without an account.
- **Beta refinement:** Responsive layouts must support current iPhone and desktop workflows
  without hiding required actions or truncating archival content.
- **Planned:** Filtered archive export and a complete account data export.

### 9. JGA Studio integration

- **Shipped:** Archive Atlas is the system of record for artwork identity and archival metadata;
  JGA Studio receives a one-way copy for presentation and commerce.
- **Shipped:** Artwork pushes include metadata, categorized tags, synced images, and a read-only
  provenance snapshot so a JGA visitor can remain inside JGA Studio.
- **Shipped:** JGA Studio independently controls publication, availability, asking price, and
  commerce state. Re-pushing from Archive Atlas must not overwrite those fields.
- **Shipped:** Image synchronization uses stable artwork identifiers and content hashes so
  replacement or removal is reflected without uncontrolled duplication.
- **Shipped:** Artwork and collection push controls appear only for Jay Golding's allowlisted root
  artist profile.
- **Shipped:** The Edge Functions on both platforms independently enforce the same profile
  restriction; hiding a button is not treated as authorization.
- **Shipped:** Shared integration secrets remain server-side and are never exposed in Vercel
  client variables.
- **Beta refinement:** Failed pushes need actionable retry status and a concise synchronization
  history.
- **Non-goal:** JGA Studio access will not be generalized to future Archive Atlas users without a
  separate product decision, permissions model, and onboarding plan.

### 10. External publishing and syndication

- **Planned:** A public, read-only artist feed and change-ping protocol as specified in
  [SYNDICATION.md](./SYNDICATION.md).
- **Planned:** An embeddable collection or artwork widget for artists who do not maintain a custom
  website integration.
- **Planned:** Scoped API credentials, documented versioning, and revocation for future approved
  publishing clients.
- **Non-goal:** Archive Atlas will not accept commerce state or provenance edits back from a
  storefront during the initial syndication phase.

## Trust, Privacy, and Integrity Model

- Public provenance identifies the claim, date, actor, and affected relationship while respecting
  a private profile's visibility rules.
- Collector identity is private by default. The fact and timing of a transfer can remain public
  without exposing a collector's public profile.
- Private notes, consignment terms, insurance details, and agreement files are never included in
  public artwork queries or JGA Studio pushes.
- An unclaimed artist profile cannot be used to execute a real ownership transfer.
- A collective's pre-claim activity remains attributed to the collective after the artist claims
  the profile.
- Exhibition corroboration adds support to the original event rather than replacing its actor.
- An artwork value, consignment asking price, JGA listing price, sale-event price, and insurance
  value are distinct fields with distinct meanings.
- Stellar anchors prove that a particular event hash was submitted at a point in time. They do
  not prove the underlying claim was true, lawful, or complete.
- Certificates verify a signed-off snapshot of authorship and object identity. They do not prove
  current ownership or financial value.

## Non-Functional Requirements

### Security and authorization

- All protected operations must be enforced by Supabase Row-Level Security or a server-side Edge
  Function, never solely through interface visibility.
- Stellar secret keys, service-role keys, SMTP credentials, and integration secrets must remain
  in server-managed secret stores.
- Authentication redirects must be restricted to approved local, preview, beta, and production
  origins.
- Mainnet key rotation and incident recovery must be documented before public beta.

### Reliability and data durability

- A failed third-party service must not undo a successfully saved artwork or event.
- Automatic anchors and JGA pushes must be idempotent and safely retryable.
- Drafts must survive ordinary tab changes, accidental navigation, and mobile browser suspension.
- Database backups, storage recovery, and restoration drills must be documented before public
  launch.

### Mobile and responsive use

- Core journeys must work on current iPhone and desktop browsers: sign-in, artwork creation,
  image upload, editing, condition reports, event review, collection management, and certificate
  verification.
- Touch targets, forms, image previews, and management actions must remain usable without relying
  on hover.

### Accessibility and clarity

- Public and authenticated interfaces should meet WCAG 2.1 AA as the launch target.
- Status language must distinguish saved, pending, anchored, wallet-signed, platform-signed,
  failed, superseded, and revoked states.
- Blockchain terminology must be translated into plain-language outcomes, with technical detail
  available as secondary information.

### Performance

- Public artwork and profile pages should prioritize image loading without blocking record text.
- Uploaded media should use stable dimensions and responsive delivery to avoid layout shifts.
- Batch operations must show per-item progress and isolate failures so one file does not discard
  successful records.

## Dependencies and Operational Services

- **Supabase:** Postgres, Auth, Storage, Row-Level Security, RPC functions, and Edge Functions.
- **Vercel:** Hosted Archive Atlas web application and preview deployments.
- **Resend:** Dedicated transactional email delivery for authentication.
- **Stellar Horizon:** Mainnet transaction submission and independent transaction lookup.
- **Stellar Wallets Kit:** Wallet selection and signing support, currently including Freighter,
  Albedo, Rabet, LOBSTR, and Hana with capability differences handled in the interface.
- **JGA Studio:** Private, one-way publishing destination for the allowlisted Jay Golding profile.

## Success Metrics

The following are initial private-beta targets and should be revised after the first invited
testing round:

- At least 80% of invited artists can complete sign-in, profile setup, first artwork, and first
  formal condition report without live assistance.
- Median time from first sign-in to first complete artwork record is under 10 minutes.
- 100% of successfully submitted artwork records remain available after refresh and sign-in on a
  second device.
- 100% of recoverable drafts survive an ordinary tab change or accidental navigation.
- At least 99% of automatic anchors confirm within two minutes; every remaining failure is visible
  and retryable.
- 100% of wallet-linked genesis and ownership-transfer events remain unanchored until signed by
  the linked wallet.
- 100% of issued certificates resolve through their public verification code and accurately show
  active, superseded, or revoked status.
- 0 unauthorized reads of private notes, consignment agreements, private collector profiles, or
  server secrets.
- 0 JGA Studio pushes accepted for a non-allowlisted Archive Atlas profile.
- No data-loss or authorization-severity incidents during the invited private beta.

## Private-Beta Exit Criteria

Archive Atlas is ready for a small invited tester group when:

1. Production builds and lint checks pass from a clean checkout.
2. Email sign-in works on desktop and iPhone using the beta domain.
3. Single and batch artwork creation, draft recovery, and multi-image editing pass a documented
   smoke test.
4. Platform-signed and wallet-signed mainnet events each pass an end-to-end verification test.
5. Automatic anchor failures are visible and retryable.
6. Condition status and formal condition-report language are unambiguous.
7. Certificate issue, supersede, revoke, print, QR, and public verification flows pass.
8. Collections can be created, ordered, edited, and removed without orphaned membership.
9. JGA Studio accepts only Jay Golding's artwork and collection pushes and preserves JGA-owned
   publication and pricing fields.
10. Privacy, authorization, backup, recovery, and mainnet key-handling checklists are documented.
11. Terms, privacy notice, conservative attestation language, and a tester feedback channel are
    available.

## Risks and Open Questions

### Legal meaning of provenance and authenticity claims

Archive Atlas records claims and supporting evidence; it does not adjudicate truth or legal
title. Product language, COA language, dispute handling, and resale features require review by
counsel familiar with art law, privacy, and blockchain systems before public launch.

### Mainnet key custody

The platform anchor secret can spend real XLM and sign public transactions. It must remain only in
Supabase secrets, use a dedicated low-balance account, and have a documented rotation and incident
response process.

### Asynchronous anchoring

Database saves currently remain independent from Stellar availability, which protects the user's
work but can leave an event awaiting proof. The product needs durable retries, monitoring, and
visible status before external testers should depend on anchoring.

### Wallet usability

Network selection, funding, mobile wallet handoff, signing support, and rejected signatures are
still unfamiliar to many artists. Wallet linking must remain optional for ordinary archive use
and receive focused usability testing.

### Privacy boundaries

Public provenance and collector privacy can conflict. The platform must continually verify that
event payloads, exports, certificates, external pushes, and future feeds do not reveal protected
identity or operational data indirectly.

### Certificate misuse

A well-designed certificate can be mistaken for proof of ownership or appraisal. Archive Atlas
must keep disclaimers prominent and preserve revocation and supersession history.

### Integration coupling

JGA Studio and future publishing clients must not become alternate systems of record. Contracts
need versioning, replay protection, synchronization visibility, and secret rotation.

### Succession and disputes

The data model anticipates succession and dispute events, but the product should not determine
rightful heirs, ownership, or authenticity. The standing and evidence required to log or resolve
these events remains an open product and legal question.

## Roadmap

### Completed foundation

- **Phase 0:** Profiles, claims, artwork records, images, provenance timelines, role-aware event
  logging, public pages, collaborators, private notes, and export.
- **Phase 1:** Platform-signed Stellar anchoring.
- **Phase 2:** Verified wallet linking and artist-wallet-signed high-stakes events.
- **Phase 3:** Exhibition corroboration, condition reports, catalog export, rich consignment
  workflows, persistent drafts, batch uploads, Collections, valuation, JGA Studio integration,
  Certificates of Authenticity, and configurable mainnet operation.

### Current — private-beta stabilization

- Add visible anchoring state, durable retries, and operational monitoring.
- Clarify initial condition versus formal condition-report workflows.
- Complete cross-browser and mobile smoke tests.
- Audit responsive layouts, accessibility, empty states, and error recovery.
- Document backups, restoration, key rotation, privacy, and incident response.
- Complete legal copy and tester onboarding materials.

### Next — invited private beta

- Invite a small group of artists, galleries, and collectors.
- Measure activation, completion time, failure rates, and support needs.
- Prioritize observed workflow problems over speculative feature expansion.
- Add feedback capture, error reporting, and a repeatable release checklist.
- Validate data export and account recovery expectations before public beta.

### Later — controlled public beta

- Public Archive Atlas collection pages and artist-controlled visibility.
- Self-site feeds, change pings, and embed tools from [SYNDICATION.md](./SYNDICATION.md).
- Bulk archive import/export and mature media processing.
- Dispute and succession workflows after legal and trust-model review.
- Professional conservation, appraisal, insurance, and institutional verification partnerships.

### Long-term research

- Enforceable resale-royalty participation.
- Atomic delivery-versus-payment settlement.
- Tokenized title only if it solves a demonstrated legal and operational problem.
- Licensed sales-data partnerships.
- Organization multisig and estate/foundation stewardship.

## Changelog

- **July 17, 2026:** Rewritten for the founder-led private beta. Added current artwork/media
  workflows, Collections, valuation, Certificates of Authenticity, mainnet anchoring, reserve-safe
  proofs, the profile-restricted JGA Studio integration, beta success metrics, exit criteria, and
  updated risks and roadmap.
- **July 14, 2026:** Initial MVP PRD created.
