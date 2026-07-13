import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getArtwork, getArtworkEvents, getProfileNames } from "../lib/artworks";
import { getErrorMessage } from "../lib/errors";
import type { Artwork, ArtworkEvent } from "../types/database";

const EVENT_LABELS: Record<ArtworkEvent["type"], string> = {
  genesis: "Created",
  ownership_transfer: "Ownership transferred",
  custody_change: "Custody changed",
  exhibition: "Exhibited",
  claim: "Profile claimed",
  condition_report: "Condition report",
  dispute: "Disputed",
  succession: "Succession",
};

export function ArtworkPage() {
  const { id } = useParams<{ id: string }>();
  const [artwork, setArtwork] = useState<Artwork | null>(null);
  const [events, setEvents] = useState<ArtworkEvent[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError("");
    Promise.all([getArtwork(id), getArtworkEvents(id)])
      .then(async ([artworkResult, eventsResult]) => {
        setArtwork(artworkResult);
        setEvents(eventsResult);
        const profileIds = eventsResult.flatMap((e) => [
          e.actor_id,
          e.to_party_id,
          e.from_party_id,
          e.target_profile_id,
        ]);
        if (artworkResult) profileIds.push(artworkResult.root_artist_id);
        setNames(await getProfileNames(profileIds.filter((x): x is string => !!x)));
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="card">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <p className="error">{error}</p>
      </div>
    );
  }

  if (!artwork) {
    return (
      <div className="card">
        <h1>Not found</h1>
        <p className="muted">No artwork with this id.</p>
        <Link to="/">Back home</Link>
      </div>
    );
  }

  return (
    <div className="card">
      {artwork.image_url && (
        <img src={artwork.image_url} alt={artwork.title} className="artwork-image" />
      )}
      <h1>{artwork.title}</h1>
      <p className="muted">
        {[artwork.medium, artwork.dimensions, artwork.year].filter(Boolean).join(" · ") ||
          "No details recorded"}
        {artwork.edition_number && artwork.edition_total
          ? ` · Edition ${artwork.edition_number}/${artwork.edition_total}`
          : ""}
      </p>
      <p className="muted">By {names[artwork.root_artist_id] ?? "Unknown"}</p>

      <h2 className="section-heading">Provenance</h2>
      <ul className="timeline">
        {events.map((event) => (
          <li key={event.id}>
            <strong>{EVENT_LABELS[event.type]}</strong>
            <span className="muted"> — {new Date(event.occurred_at).toLocaleDateString()}</span>
            {event.type === "genesis" && event.to_party_id && (
              <p className="muted">Owner and custodian: {names[event.to_party_id]}</p>
            )}
            {event.type === "ownership_transfer" && (
              <p className="muted">
                {names[event.from_party_id ?? ""] ?? "Unknown"} →{" "}
                {names[event.to_party_id ?? ""] ?? "Unknown"}
              </p>
            )}
            {event.notes && <p className="muted">{event.notes}</p>}
          </li>
        ))}
      </ul>

      <Link to="/">Back home</Link>
    </div>
  );
}
