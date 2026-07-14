import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import type { Profile } from "../types/database";

/** Top navigation bar for full-width pages. `profile` is the signed-in
 * user's own profile, if any — nav actions render only when present. */
export function AppHeader({ profile }: { profile?: Profile | null }) {
  const navigate = useNavigate();

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
      <Link to="/" className="brand">
        Archive Atlas
      </Link>
      {profile && (
        <nav>
          <button type="button" onClick={() => navigate("/artworks/new")}>
            + New artwork
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => navigate(`/profiles/${profile.id}`)}
          >
            My profile
          </button>
          <button type="button" className="secondary" onClick={() => navigate("/collective")}>
            Collective
          </button>
          <button type="button" className="secondary" onClick={() => navigate("/exhibitions")}>
            My exhibitions
          </button>
          <button type="button" className="secondary" onClick={handleSignOut}>
            Sign out
          </button>
        </nav>
      )}
    </header>
  );
}
