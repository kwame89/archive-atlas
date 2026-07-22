import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createUnclaimedProfile, listProfilesCreatedBy } from "../lib/profiles";
import { getErrorMessage } from "../lib/errors";
import type { Profile, ProfileType } from "../types/database";

export function CollectiveDashboardPage({ profile }: { profile: Profile }) {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [type, setType] = useState<ProfileType>("artist");
  const [legalName, setLegalName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setCreated(await listProfilesCreatedBy(profile.id));
  }, [profile.id]);

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, [reload]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await createUnclaimedProfile(profile.id, {
        displayName,
        type,
        legalName: legalName || undefined,
      });
      setDisplayName("");
      setLegalName("");
      await reload();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card">
      <h1>Collective dashboard</h1>
      <p className="muted">
        Create placeholder profiles for artists who aren't on the platform yet, and log
        historical work on their behalf until they claim their own profile.
      </p>

      <form onSubmit={handleSubmit}>
        <label htmlFor="displayName">Artist name</label>
        <input
          id="displayName"
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />

        <label htmlFor="type">Profile type</label>
        <select id="type" value={type} onChange={(e) => setType(e.target.value as ProfileType)}>
          <option value="artist">Artist</option>
          <option value="collective">Collective / Studio</option>
          <option value="gallery">Gallery</option>
          <option value="curator">Curator</option>
          <option value="institution">Institution</option>
        </select>

        <label htmlFor="legalName">Legal / business name (optional)</label>
        <input
          id="legalName"
          value={legalName}
          onChange={(e) => setLegalName(e.target.value)}
        />

        <button type="submit" disabled={submitting}>
          {submitting ? "Creating…" : "Create placeholder profile"}
        </button>
        {error && <p className="error">{error}</p>}
      </form>

      <h2 className="section-heading">Profiles you've created</h2>
      {loading && <p className="muted">Loading…</p>}
      {!loading && created.length === 0 && <p className="muted">None yet.</p>}
      <ul className="results">
        {created.map((p) => (
          <li key={p.id}>
            <span>
              {p.display_name} — {p.trust_tier}
            </span>
            {p.trust_tier === "unclaimed" && (
              <button type="button" onClick={() => navigate(`/artworks/new?onBehalfOf=${p.id}`)}>
                Log a work
              </button>
            )}
          </li>
        ))}
      </ul>

      <p className="muted">
        <Link to="/">Back home</Link>
      </p>
    </div>
  );
}
