import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getPrimaryImageUrls, listArtworksByArtist } from "../lib/artworks";
import { getErrorMessage } from "../lib/errors";
import { AppHeader } from "../components/AppHeader";
import type { Artwork, Profile } from "../types/database";

export function HomePage({ profile }: { profile: Profile }) {
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    listArtworksByArtist(profile.id)
      .then(async (list) => {
        setArtworks(list);
        setThumbnails(await getPrimaryImageUrls(list.map((a) => a.id)));
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [profile.id]);

  return (
    <div className="page-wide">
      <AppHeader profile={profile} />

      <h1>Welcome, {profile.display_name}</h1>
      <p className="muted">
        {profile.type} · {profile.trust_tier}
      </p>

      <h2 className="section-heading">Your artworks</h2>
      {loading && <p className="muted">Loading…</p>}
      {error && <p className="error">{error}</p>}
      {!loading && artworks.length === 0 && <p className="muted">No artworks yet.</p>}

      <ul className="artwork-grid">
        {artworks.map((artwork) => (
          <li key={artwork.id}>
            <Link to={`/artworks/${artwork.id}`}>
              {thumbnails[artwork.id] ? (
                <img src={thumbnails[artwork.id]} alt={artwork.title} />
              ) : (
                <div className="thumb-placeholder" aria-hidden="true" />
              )}
              <span>{artwork.title}</span>
              <span className="muted">
                {[artwork.medium, artwork.year].filter(Boolean).join(" · ")}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
