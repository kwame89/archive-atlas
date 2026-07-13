import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { listArtworksByArtist } from "../lib/artworks";
import { getErrorMessage } from "../lib/errors";
import type { Artwork, Profile } from "../types/database";

export function HomePage({ profile }: { profile: Profile }) {
  const navigate = useNavigate();
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    listArtworksByArtist(profile.id)
      .then(setArtworks)
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [profile.id]);

  return (
    <div className="card">
      <h1>Welcome, {profile.display_name}</h1>
      <p className="muted">
        {profile.type} · {profile.trust_tier}
      </p>

      <h2 className="section-heading">Your artworks</h2>
      {loading && <p className="muted">Loading…</p>}
      {error && <p className="error">{error}</p>}
      {!loading && artworks.length === 0 && <p className="muted">No artworks yet.</p>}

      <ul className="results">
        {artworks.map((artwork) => (
          <li key={artwork.id}>
            <Link to={`/artworks/${artwork.id}`}>{artwork.title}</Link>
          </li>
        ))}
      </ul>

      <button type="button" onClick={() => navigate("/artworks/new")}>
        + New artwork
      </button>
      <button className="secondary" onClick={() => navigate("/collective")}>
        Collective dashboard
      </button>
      <button className="secondary" onClick={() => supabase.auth.signOut()}>
        Sign out
      </button>
    </div>
  );
}
