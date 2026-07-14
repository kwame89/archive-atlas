import { SignInPage } from "./SignInPage";

/** Public homepage for logged-out visitors — everything a signed-in user
 * sees at "/" lives in HomePage.tsx instead; this is what explains the
 * product before asking for an email address. */
export function LandingPage() {
  return (
    <div className="page-wide">
      <header className="landing-hero">
        <h1>Archive Atlas</h1>
        <p className="muted">
          Artist-first archival & provenance — the artist is the root of the record, not a field
          in a gallery's database.
        </p>
      </header>

      <p className="landing-intro">
        Most archival tools are built around convenience for whoever's storing your work — a
        gallery's database, a dealer's spreadsheet. Archive Atlas starts from the artist instead:
        a durable, independently verifiable record of your work that you own and control for its
        whole life, not just while it's in your studio.
      </p>

      <div className="landing-features">
        <div>
          <h2 className="section-heading">Your record, your control</h2>
          <p className="muted">
            Create a canonical record for each piece — images, medium, dimensions, condition, a
            suggested resale royalty — that only you (or someone you've authorized) can edit.
            Claim your profile with just an email; no wallet required to start.
          </p>
        </div>
        <div>
          <h2 className="section-heading">Provenance that matches reality</h2>
          <p className="muted">
            Sales, consignments, loans, and exhibitions are tracked the way they actually happen —
            a gallery selling consigned work doesn't quietly become "the owner" in the record, and
            self-logged exhibition claims can be corroborated over time.
          </p>
        </div>
        <div>
          <h2 className="section-heading">Anchored on Stellar</h2>
          <p className="muted">
            Every record is hashed and anchored on Stellar, independently verifiable outside our
            own database. Link a real wallet later and your most important attestations — a
            piece's creation, a sale — get signed by you personally, not just recorded on your
            behalf.
          </p>
        </div>
        <div>
          <h2 className="section-heading">Built for real use</h2>
          <p className="muted">
            Generate a printable catalog for a submission or show in one click, keep private notes
            only you ever see, and credit collaborators on shared pieces.
          </p>
        </div>
      </div>

      <div className="landing-cta">
        <SignInPage />
      </div>

      <p className="muted landing-footnote">
        Early-stage build, currently anchoring on Stellar testnet — not yet handling real
        financial transactions.
      </p>
    </div>
  );
}
