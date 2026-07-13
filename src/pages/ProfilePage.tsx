import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../lib/AuthProvider";
import {
  canActFor,
  getMyProfile,
  getProfile,
  updateProfile,
  uploadProfileMedia,
} from "../lib/profiles";
import { getPrimaryImageUrls, isController, listArtworksByArtist } from "../lib/artworks";
import { getErrorMessage } from "../lib/errors";
import { AppHeader } from "../components/AppHeader";
import type { Artwork, Profile } from "../types/database";

const TIER_LABELS: Record<Profile["trust_tier"], string> = {
  unclaimed: "Unclaimed",
  claimed: "Claimed",
  wallet_linked: "Wallet-linked",
  entity: "Entity",
};

export function ProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editing, setEditing] = useState(false);
  const [bioDraft, setBioDraft] = useState("");
  const [websiteDraft, setWebsiteDraft] = useState("");
  const [legalNameDraft, setLegalNameDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCv, setUploadingCv] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError("");
    (async () => {
      const profileResult = await getProfile(id);
      setProfile(profileResult);
      if (!profileResult) return;

      const [artworkList, mine] = await Promise.all([
        listArtworksByArtist(profileResult.id),
        session ? getMyProfile(session.user.id) : Promise.resolve(null),
      ]);
      setArtworks(artworkList);
      setThumbnails(await getPrimaryImageUrls(artworkList.map((a) => a.id)));
      setMyProfile(mine);
      if (mine) {
        setCanEdit(
          mine.id === profileResult.id
            ? await isController(profileResult.id, mine.id)
            : await canActFor(profileResult.id, mine.id)
        );
      }
    })()
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [id, session]);

  function startEditing() {
    if (!profile) return;
    setBioDraft(profile.bio ?? "");
    setWebsiteDraft(profile.website_url ?? "");
    setLegalNameDraft(profile.legal_name ?? "");
    setEditError("");
    setEditing(true);
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!profile) return;
    setSaving(true);
    setEditError("");
    try {
      const updated = await updateProfile(profile.id, {
        bio: bioDraft,
        websiteUrl: websiteDraft,
        legalName: legalNameDraft,
      });
      setProfile(updated);
      setEditing(false);
    } catch (err) {
      setEditError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(file: File | undefined, kind: "avatar" | "cv") {
    if (!file || !profile) return;
    const setBusy = kind === "avatar" ? setUploadingAvatar : setUploadingCv;
    setBusy(true);
    setEditError("");
    try {
      const url = await uploadProfileMedia(profile.id, file, kind);
      setProfile({ ...profile, [kind === "avatar" ? "avatar_url" : "cv_url"]: url });
    } catch (err) {
      setEditError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="page-wide">
        <AppHeader profile={myProfile} />
        <p className="muted">Loading…</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="page-wide">
        <AppHeader profile={myProfile} />
        {error ? <p className="error">{error}</p> : <p className="muted">No profile found.</p>}
        <Link to="/">Back home</Link>
      </div>
    );
  }

  return (
    <div className="page-wide">
      <AppHeader profile={myProfile} />

      <div className="profile-header">
        {profile.avatar_url ? (
          <img src={profile.avatar_url} alt={profile.display_name} className="avatar" />
        ) : (
          <div className="avatar avatar-placeholder" aria-hidden="true">
            {profile.display_name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div>
          <h1>{profile.display_name}</h1>
          <p className="muted">
            {profile.type} · <span className="tier-badge">{TIER_LABELS[profile.trust_tier]}</span>
            {profile.legal_name && ` · ${profile.legal_name}`}
          </p>
          {profile.trust_tier === "unclaimed" && (
            <p className="muted">
              This is a placeholder profile created on the artist's behalf — they haven't claimed
              it yet.
            </p>
          )}
          {profile.website_url && (
            <p>
              <a href={profile.website_url} target="_blank" rel="noopener noreferrer">
                {profile.website_url}
              </a>
            </p>
          )}
          {profile.cv_url && (
            <p>
              <a href={profile.cv_url} target="_blank" rel="noopener noreferrer">
                View CV →
              </a>
            </p>
          )}
        </div>
      </div>

      {profile.bio && <p className="profile-bio">{profile.bio}</p>}

      {canEdit && !editing && (
        <button type="button" className="secondary" onClick={startEditing}>
          Edit profile
        </button>
      )}

      {canEdit && editing && (
        <form onSubmit={handleSave} className="profile-edit">
          <label htmlFor="bio">Bio</label>
          <textarea id="bio" value={bioDraft} onChange={(e) => setBioDraft(e.target.value)} />

          <label htmlFor="website">Website</label>
          <input
            id="website"
            type="url"
            value={websiteDraft}
            onChange={(e) => setWebsiteDraft(e.target.value)}
            placeholder="https://…"
          />

          <label htmlFor="legalNameEdit">Legal / business name</label>
          <input
            id="legalNameEdit"
            value={legalNameDraft}
            onChange={(e) => setLegalNameDraft(e.target.value)}
          />

          <label htmlFor="avatarUpload">Profile picture</label>
          <input
            id="avatarUpload"
            type="file"
            accept="image/*"
            disabled={uploadingAvatar}
            onChange={(e) => handleUpload(e.target.files?.[0], "avatar")}
          />

          <label htmlFor="cvUpload">CV (PDF)</label>
          <input
            id="cvUpload"
            type="file"
            accept=".pdf,application/pdf"
            disabled={uploadingCv}
            onChange={(e) => handleUpload(e.target.files?.[0], "cv")}
          />

          <button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button type="button" className="secondary" onClick={() => setEditing(false)}>
            Cancel
          </button>
          {editError && <p className="error">{editError}</p>}
        </form>
      )}

      <h2 className="section-heading">Artworks</h2>
      {artworks.length === 0 && <p className="muted">No artworks yet.</p>}
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
