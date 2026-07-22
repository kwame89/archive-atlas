import {
  CalendarRange,
  Images,
  Layers,
  LogOut,
  Plus,
  UserRound,
  UsersRound,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import archiveAtlasMark from "../assets/archive-atlas-mark.png";
import { supabase } from "../lib/supabaseClient";
import type { Profile } from "../types/database";

/** Top navigation bar for full-width pages. `profile` is the signed-in
 * user's own profile, if any — nav actions render only when present. */
export function AppHeader({
  profile,
  publicActions = true,
}: {
  profile?: Profile | null;
  publicActions?: boolean;
}) {
  const location = useLocation();

  function navClass(path: string) {
    return `nav-link${location.pathname === path ? " active" : ""}`;
  }

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Sign out failed:", error);
      return;
    }
    // Force a full reload rather than relying on React auth-context state to
    // propagate — guarantees a clean slate (no stale profile/session state
    // left over in memory) regardless of any react-state edge case.
    window.location.href = "/";
  }

  return (
    <header className="app-header">
      <Link to="/" className="brand" aria-label="Archive Atlas home">
        <span className="brand-mark" aria-hidden="true">
          <img src={archiveAtlasMark} alt="" />
        </span>
        <span className="brand-copy">
          <span className="brand-name-row">
            <span className="brand-name">Archive Atlas</span>
            <span className="beta-environment-badge">Private beta · Testnet</span>
          </span>
          <span className="brand-tagline">Preserve. Prove. Perpetuate.</span>
        </span>
      </Link>
      {profile ? (
        <nav aria-label="Primary navigation">
          <Link
            to="/#artworks"
            className={`nav-link${location.pathname === "/" && location.hash === "#artworks" ? " active" : ""}`}
          >
            <Images size={16} strokeWidth={1.8} aria-hidden="true" />
            Artworks
          </Link>
          <Link to={`/profiles/${profile.id}`} className={navClass(`/profiles/${profile.id}`)}>
            <UserRound size={16} strokeWidth={1.8} aria-hidden="true" />
            Profile
          </Link>
          <Link to="/collective" className={navClass("/collective")}>
            <UsersRound size={16} strokeWidth={1.8} aria-hidden="true" />
            Collective
          </Link>
          <Link to="/exhibitions" className={navClass("/exhibitions")}>
            <CalendarRange size={16} strokeWidth={1.8} aria-hidden="true" />
            Exhibitions
          </Link>
          <Link to="/collections" className={navClass("/collections")}>
            <Layers size={16} strokeWidth={1.8} aria-hidden="true" />
            Collections
          </Link>
          <button type="button" className="nav-link nav-link-button" onClick={handleSignOut}>
            <LogOut size={16} strokeWidth={1.8} aria-hidden="true" />
            Sign out
          </button>
          <Link to="/artworks/new" className="nav-link nav-primary">
            <Plus size={16} strokeWidth={2} aria-hidden="true" />
            New artwork
          </Link>
        </nav>
      ) : publicActions ? (
        <nav aria-label="Public navigation">
          <a href="#principles" className="nav-link">
            Principles
          </a>
          <a href="#get-started" className="nav-link nav-primary">
            Get started
          </a>
        </nav>
      ) : null}
    </header>
  );
}
