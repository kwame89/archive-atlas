import { useState, type FormEvent } from "react";
import { createProfile, searchUnclaimedProfiles, claimProfile } from "../lib/profiles";
import { getErrorMessage } from "../lib/errors";
import type { Profile, ProfileType } from "../types/database";

interface OnboardingPageProps {
  authUserId: string;
  onComplete: (profile: Profile) => void;
}

type Mode = "choose" | "create" | "claim";

export function OnboardingPage({ authUserId, onComplete }: OnboardingPageProps) {
  const [mode, setMode] = useState<Mode>("choose");

  if (mode === "choose") {
    return (
      <div className="card">
        <h1>Welcome</h1>
        <p className="muted">You don't have a profile yet. Are you new here, or has someone
          (a gallery or collective) already created a placeholder for you?</p>
        <button onClick={() => setMode("create")}>Create a new profile</button>
        <button className="secondary" onClick={() => setMode("claim")}>
          Claim an existing profile
        </button>
      </div>
    );
  }

  if (mode === "create") {
    return (
      <CreateProfileForm
        authUserId={authUserId}
        onBack={() => setMode("choose")}
        onComplete={onComplete}
      />
    );
  }

  return (
    <ClaimProfileFlow
      authUserId={authUserId}
      onBack={() => setMode("choose")}
      onComplete={onComplete}
    />
  );
}

function CreateProfileForm({
  authUserId,
  onBack,
  onComplete,
}: {
  authUserId: string;
  onBack: () => void;
  onComplete: (profile: Profile) => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [type, setType] = useState<ProfileType>("artist");
  const [legalName, setLegalName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const profile = await createProfile(authUserId, {
        displayName,
        type,
        legalName: legalName || undefined,
      });
      onComplete(profile);
    } catch (err) {
      setError(getErrorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="card">
      <h1>Create your profile</h1>
      <form onSubmit={handleSubmit}>
        <label htmlFor="displayName">Name</label>
        <input
          id="displayName"
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Your name or studio name"
        />

        <label htmlFor="type">I am a…</label>
        <select id="type" value={type} onChange={(e) => setType(e.target.value as ProfileType)}>
          <option value="artist">Artist</option>
          <option value="collective">Collective / Studio</option>
          <option value="gallery">Gallery</option>
          <option value="curator">Curator</option>
          <option value="collector">Collector</option>
        </select>

        <label htmlFor="legalName">Legal / business name (optional)</label>
        <input
          id="legalName"
          value={legalName}
          onChange={(e) => setLegalName(e.target.value)}
          placeholder="e.g. Studio Jane Doe LLC"
        />

        <button type="submit" disabled={submitting}>
          {submitting ? "Creating…" : "Create profile"}
        </button>
        <button type="button" className="secondary" onClick={onBack}>
          Back
        </button>
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  );
}

function ClaimProfileFlow({
  authUserId,
  onBack,
  onComplete,
}: {
  authUserId: string;
  onBack: () => void;
  onComplete: (profile: Profile) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [searched, setSearched] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleSearch(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const profiles = await searchUnclaimedProfiles(query);
      setResults(profiles);
      setSearched(true);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function handleClaim(profileId: string) {
    setClaimingId(profileId);
    setError("");
    try {
      const profile = await claimProfile(authUserId, profileId);
      onComplete(profile);
    } catch (err) {
      setError(getErrorMessage(err));
      setClaimingId(null);
    }
  }

  return (
    <div className="card">
      <h1>Claim your profile</h1>
      <p className="muted">Search by the name a gallery or collective may have used for you.</p>
      <form onSubmit={handleSearch}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search unclaimed profiles…"
        />
        <button type="submit">Search</button>
      </form>

      {searched && results.length === 0 && <p className="muted">No unclaimed profiles found.</p>}

      <ul className="results">
        {results.map((profile) => (
          <li key={profile.id}>
            <span>{profile.display_name}</span>
            <button onClick={() => handleClaim(profile.id)} disabled={claimingId === profile.id}>
              {claimingId === profile.id ? "Claiming…" : "This is me"}
            </button>
          </li>
        ))}
      </ul>

      <button type="button" className="secondary" onClick={onBack}>
        Back
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
