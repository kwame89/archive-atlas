import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getExhibitionsLoggedBy, getProfileNames, type LoggedExhibition } from "../lib/artworks";
import { getErrorMessage } from "../lib/errors";
import { artworkPathFromParts } from "../lib/recordRoutes";
import { AppHeader } from "../components/AppHeader";
import { ExhibitionEditor } from "../components/ExhibitionEditor";
import type { Profile } from "../types/database";

export function MyExhibitionsPage({ profile }: { profile: Profile }) {
  const [entries, setEntries] = useState<LoggedExhibition[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError("");
    getExhibitionsLoggedBy(profile.id)
      .then(async (result) => {
        setEntries(result);
        const corroboratorIds = result
          .map(({ event }) => event.corroborated_by)
          .filter((id): id is string => Boolean(id));
        setNames(await getProfileNames(corroboratorIds));
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [profile.id, reloadKey]);

  return (
    <div className="page-wide">
      <AppHeader profile={profile} />

      <h1>My exhibitions</h1>
      <p className="muted">Every exhibition you've logged, across all artworks.</p>

      {loading && <p className="muted">Loading…</p>}
      {error && <p className="error">{error}</p>}
      {!loading && entries.length === 0 && (
        <p className="muted">You haven't logged any exhibitions yet.</p>
      )}

      <ul className="timeline">
        {entries.map(({ event, artworkTitle }) => (
          <li key={event.id}>
            <strong>{event.exhibition_title}</strong>
            <span className="muted"> — {new Date(event.occurred_at).toLocaleDateString()}</span>
            <p className="muted">
              {event.artwork_id ? (
                <Link to={artworkPathFromParts(event.artwork_id, artworkTitle)}>{artworkTitle}</Link>
              ) : (
                artworkTitle
              )}
              {event.exhibition_venue && ` · ${event.exhibition_venue}`}
              {event.exhibition_location && ` · ${event.exhibition_location}`}
            </p>
            {event.exhibition_end_date && (
              <p className="muted">
                Through {new Date(event.exhibition_end_date).toLocaleDateString()}
              </p>
            )}
            {event.notes && <p className="muted">{event.notes}</p>}
            <p className="muted">
              {event.corroborated_by ? (
                <span className="tier-badge">
                  Corroborated by {names[event.corroborated_by] ?? "the artist"}
                </span>
              ) : (
                "Self-logged — not yet corroborated"
              )}
            </p>
            <ExhibitionEditor
              event={event}
              actorProfileId={profile.id}
              onComplete={() => setReloadKey((current) => current + 1)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
