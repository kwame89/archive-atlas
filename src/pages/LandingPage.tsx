import { ArrowRight, Fingerprint, LibraryBig, ShieldCheck, Waypoints } from "lucide-react";
import archiveAtlasLogo from "../assets/archive-atlas-logo.png";
import { AppHeader } from "../components/AppHeader";
import { SignInPage } from "./SignInPage";

/** Public homepage for logged-out visitors — everything a signed-in user
 * sees at "/" lives in HomePage.tsx instead; this is what explains the
 * product before asking for an email address. */
export function LandingPage() {
  return (
    <div className="page-wide landing-page">
      <AppHeader />

      <main>
        <section className="landing-hero">
          <img
            src={archiveAtlasLogo}
            className="landing-hero-logo"
            alt=""
            aria-hidden="true"
          />
          <div className="landing-hero-copy">
            <p className="eyebrow">The artist-rooted record</p>
            <h1>Archive Atlas</h1>
            <p>
              Preserve the work. Prove its story. Build a lasting archive that begins with the
              artist and travels with the artwork.
            </p>
            <a href="#get-started" className="button-link">
              Begin your archive
              <ArrowRight size={17} aria-hidden="true" />
            </a>
          </div>
        </section>

        <section className="landing-intro" aria-label="Archive Atlas approach">
          <p className="eyebrow">A different center of gravity</p>
          <p>
            Most archival tools begin with whoever stores or sells the work. Archive Atlas begins
            with the artist, creating a durable record you control through every studio move,
            exhibition, consignment, and collection.
          </p>
          <div className="principle-strip" aria-label="Platform principles">
            <span>Artist controlled</span>
            <span>Independently verifiable</span>
            <span>Built for a lifetime</span>
          </div>
        </section>

        <section className="landing-feature-band" id="principles">
          <header className="landing-section-header">
            <p className="eyebrow">Designed around the work</p>
            <h2>Everything your archive needs. Nothing between you and the record.</h2>
          </header>

          <div className="landing-features">
            <article>
              <span className="feature-icon" aria-hidden="true">
                <LibraryBig size={22} strokeWidth={1.6} />
              </span>
              <p className="feature-number">01</p>
              <h3>Your record, your control</h3>
              <p>
                Create the canonical record for each piece: images, medium, dimensions, condition,
                collaborators, and private notes.
              </p>
            </article>
            <article>
              <span className="feature-icon" aria-hidden="true">
                <Waypoints size={22} strokeWidth={1.6} />
              </span>
              <p className="feature-number">02</p>
              <h3>Provenance that matches reality</h3>
              <p>
                Track sales, consignments, loans, and exhibitions without confusing possession,
                representation, and ownership.
              </p>
            </article>
            <article>
              <span className="feature-icon" aria-hidden="true">
                <Fingerprint size={22} strokeWidth={1.6} />
              </span>
              <p className="feature-number">03</p>
              <h3>Proof beyond the platform</h3>
              <p>
                Records are hashed and anchored on Stellar, creating an independently verifiable
                history that is not trapped in one database.
              </p>
            </article>
            <article>
              <span className="feature-icon" aria-hidden="true">
                <ShieldCheck size={22} strokeWidth={1.6} />
              </span>
              <p className="feature-number">04</p>
              <h3>Ready for real studio work</h3>
              <p>
                Prepare printable catalogs, document condition, credit collaborators, and keep
                sensitive working notes private.
              </p>
            </article>
          </div>
        </section>

        <section className="landing-cta" id="get-started">
          <div className="landing-cta-copy">
            <p className="eyebrow">Open your archive</p>
            <h2>A lasting record begins with one work.</h2>
            <p>
              Claim your profile with an email. No wallet or technical setup is required to begin.
            </p>
          </div>
          <SignInPage />
        </section>
      </main>

      <p className="landing-footnote">
        Early-stage build, currently anchoring on Stellar testnet — not yet handling real
        financial transactions.
      </p>
    </div>
  );
}
