import { useEffect, useState, type FormEvent } from "react";
import {
  BadgeCheck,
  CheckCircle2,
  ExternalLink,
  FileText,
  Mail,
  MapPin,
  Pencil,
  RefreshCw,
  Unplug,
  UserCheck,
  UserPlus,
  Wallet,
} from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../lib/authContext";
import {
  canActFor,
  followProfile,
  getMyProfile,
  getProfile,
  isFollowingProfile,
  unfollowProfile,
  updateProfile,
  uploadProfileMedia,
} from "../lib/profiles";
import { getPrimaryImageUrls, isController, listArtworksByArtist } from "../lib/artworks";
import {
  linkWallet,
  disconnectWallet,
  STELLAR_NETWORK,
  STELLAR_EXPERT_BASE,
} from "../lib/stellarWallet";
import { getErrorMessage } from "../lib/errors";
import { artworkPath, profilePath, recordIdFromRoute } from "../lib/recordRoutes";
import {
  formatProfileRoles,
  normalizeSpecialties,
  PROFILE_TYPE_LABELS,
  PROFILE_TYPE_OPTIONS,
} from "../lib/profilePresentation";
import { AppHeader } from "../components/AppHeader";
import type { Artwork, Profile, ProfileType } from "../types/database";
import { SoldDot } from "../components/SoldDot";

const TIER_LABELS: Record<Profile["trust_tier"], string> = {
  unclaimed: "Unclaimed",
  claimed: "Claimed",
  wallet_linked: "Wallet-linked",
  entity: "Entity",
};

export function ProfilePage() {
  const { id: profileRef } = useParams<{ id: string }>();
  const id = recordIdFromRoute(profileRef);
  const location = useLocation();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editing, setEditing] = useState(false);
  const [displayNameDraft, setDisplayNameDraft] = useState("");
  const [bioDraft, setBioDraft] = useState("");
  const [headlineDraft, setHeadlineDraft] = useState("");
  const [locationDraft, setLocationDraft] = useState("");
  const [specialtiesDraft, setSpecialtiesDraft] = useState("");
  const [secondaryRolesDraft, setSecondaryRolesDraft] = useState<ProfileType[]>([]);
  const [publicEmailDraft, setPublicEmailDraft] = useState("");
  const [websiteDraft, setWebsiteDraft] = useState("");
  const [legalNameDraft, setLegalNameDraft] = useState("");
  const [isPublicDraft, setIsPublicDraft] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCv, setUploadingCv] = useState(false);
  const [selectingForCatalog, setSelectingForCatalog] = useState(false);
  const [selectedForCatalog, setSelectedForCatalog] = useState<string[]>([]);
  const [linkingWallet, setLinkingWallet] = useState(false);
  const [disconnectingWallet, setDisconnectingWallet] = useState(false);
  const [linkWalletError, setLinkWalletError] = useState("");
  const [following, setFollowing] = useState(false);
  const [followSaving, setFollowSaving] = useState(false);
  const [followError, setFollowError] = useState("");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError("");
    setCanEdit(false);
    setFollowing(false);
    setFollowError("");
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
        if (mine.id !== profileResult.id) {
          try {
            setFollowing(await isFollowingProfile(mine.id, profileResult.id));
          } catch (err) {
            console.error("Follow status could not be loaded:", err);
          }
        }
      }
    })()
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [id, session]);

  useEffect(() => {
    if (!profile) return;
    const canonicalPath = profilePath(profile);
    if (location.pathname !== canonicalPath) {
      navigate(canonicalPath, { replace: true });
    }
  }, [location.pathname, navigate, profile]);

  function startEditing() {
    if (!profile) return;
    setDisplayNameDraft(profile.display_name);
    setBioDraft(profile.bio ?? "");
    setHeadlineDraft(profile.headline ?? "");
    setLocationDraft(profile.location ?? "");
    setSpecialtiesDraft((profile.specialties ?? []).join(", "));
    setSecondaryRolesDraft(profile.secondary_roles ?? []);
    setPublicEmailDraft(profile.public_email ?? "");
    setWebsiteDraft(profile.website_url ?? "");
    setLegalNameDraft(profile.legal_name ?? "");
    setIsPublicDraft(profile.is_public);
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
        displayName: displayNameDraft,
        bio: bioDraft,
        headline: headlineDraft,
        location: locationDraft,
        specialties: normalizeSpecialties(specialtiesDraft),
        secondaryRoles: secondaryRolesDraft,
        primaryRole: profile.type,
        publicEmail: publicEmailDraft,
        websiteUrl: websiteDraft,
        legalName: legalNameDraft,
        isPublic: isPublicDraft,
      });
      setProfile(updated);
      setEditing(false);
    } catch (err) {
      setEditError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleFollowToggle() {
    if (!profile || !myProfile || myProfile.id === profile.id) return;
    setFollowSaving(true);
    setFollowError("");
    try {
      if (following) {
        await unfollowProfile(myProfile.id, profile.id);
        setFollowing(false);
      } else {
        await followProfile(myProfile.id, profile.id);
        setFollowing(true);
      }
    } catch (err) {
      setFollowError(getErrorMessage(err));
    } finally {
      setFollowSaving(false);
    }
  }

  function toggleCatalogSelection(artworkId: string) {
    setSelectedForCatalog((prev) =>
      prev.includes(artworkId) ? prev.filter((id) => id !== artworkId) : [...prev, artworkId]
    );
  }

  function startCatalogSelection() {
    setSelectedForCatalog([]);
    setSelectingForCatalog(true);
  }

  function cancelCatalogSelection() {
    setSelectingForCatalog(false);
    setSelectedForCatalog([]);
  }

  function handleGenerateCatalog() {
    navigate(`/catalog/print?ids=${selectedForCatalog.join(",")}`);
  }

  async function handleLinkWallet() {
    if (!profile) return;
    setLinkingWallet(true);
    setLinkWalletError("");
    try {
      const publicKey = await linkWallet(profile.id);
      setProfile({ ...profile, linked_wallet: publicKey, trust_tier: "wallet_linked" });
    } catch (err) {
      setLinkWalletError(getErrorMessage(err));
    } finally {
      setLinkingWallet(false);
    }
  }

  async function handleDisconnectWallet() {
    if (!profile) return;
    setDisconnectingWallet(true);
    setLinkWalletError("");
    try {
      await disconnectWallet(profile.id);
      setProfile({ ...profile, linked_wallet: null, trust_tier: "claimed" });
    } catch (err) {
      setLinkWalletError(getErrorMessage(err));
    } finally {
      setDisconnectingWallet(false);
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

      <main className="public-profile-page">
        <section className="public-profile-hero">
          <div className="public-profile-avatar-wrap">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.display_name} className="public-profile-avatar" />
            ) : (
              <div className="public-profile-avatar public-profile-avatar-placeholder" aria-hidden="true">
                {profile.display_name.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>

          <div className="public-profile-identity">
            <p className="eyebrow">{formatProfileRoles(profile)}</p>
            <h1>{profile.display_name}</h1>
            {profile.headline && <p className="public-profile-headline">{profile.headline}</p>}

            <div className="public-profile-meta">
              {profile.location && (
                <span>
                  <MapPin size={15} aria-hidden="true" />
                  {profile.location}
                </span>
              )}
              <span>
                <BadgeCheck size={15} aria-hidden="true" />
                {TIER_LABELS[profile.trust_tier]}
              </span>
            </div>

            {(profile.specialties ?? []).length > 0 && (
              <div className="public-profile-specialties" aria-label="Specialties">
                {profile.specialties.map((specialty) => (
                  <span key={specialty}>{specialty}</span>
                ))}
              </div>
            )}

            <div className="public-profile-actions">
              {profile.website_url && (
                <a href={profile.website_url} target="_blank" rel="noopener noreferrer">
                  Website
                  <ExternalLink size={15} aria-hidden="true" />
                </a>
              )}
              {profile.public_email && (
                <a href={`mailto:${profile.public_email}`}>
                  Contact
                  <Mail size={15} aria-hidden="true" />
                </a>
              )}
              {profile.cv_url && (
                <a href={profile.cv_url} target="_blank" rel="noopener noreferrer">
                  CV
                  <FileText size={15} aria-hidden="true" />
                </a>
              )}
              {myProfile && myProfile.id !== profile.id && profile.is_public && (
                <button
                  type="button"
                  className={following ? "is-following" : ""}
                  disabled={followSaving}
                  onClick={handleFollowToggle}
                >
                  {following ? <UserCheck size={16} aria-hidden="true" /> : <UserPlus size={16} aria-hidden="true" />}
                  {followSaving ? "Saving…" : following ? "Following" : "Follow"}
                </button>
              )}
              {!session && profile.is_public && (
                <Link to="/#get-started">
                  <UserPlus size={16} aria-hidden="true" />
                  Sign in to follow
                </Link>
              )}
              {canEdit && !editing && (
                <button type="button" onClick={startEditing}>
                  <Pencil size={15} aria-hidden="true" />
                  Edit profile
                </button>
              )}
            </div>
            {followError && <p className="error public-profile-action-error">{followError}</p>}
          </div>
        </section>

        {profile.trust_tier === "unclaimed" && (
          <div className="public-profile-notice">
            This community record has not yet been claimed by the person or organization named.
          </div>
        )}

        {canEdit && !profile.is_public && (
          <div className="public-profile-notice is-private">
            This profile is private. Only authorized account managers can view it.
          </div>
        )}

        {canEdit && editing && (
          <form onSubmit={handleSave} className="profile-edit public-profile-editor">
            <header>
              <p className="eyebrow">Profile settings</p>
              <h2>Edit public profile</h2>
              <p>These details help artists, curators, galleries, and institutions find your work.</p>
            </header>

            <div className="public-profile-edit-grid">
              <label htmlFor="displayNameEdit">
                Display name
                <input
                  id="displayNameEdit"
                  required
                  value={displayNameDraft}
                  onChange={(event) => setDisplayNameDraft(event.target.value)}
                />
              </label>
              <label htmlFor="headlineEdit">
                Headline
                <input
                  id="headlineEdit"
                  value={headlineDraft}
                  maxLength={140}
                  onChange={(event) => setHeadlineDraft(event.target.value)}
                  placeholder="Artist exploring memory, migration, and place"
                />
              </label>
              <label htmlFor="locationEdit">
                Public location
                <input
                  id="locationEdit"
                  value={locationDraft}
                  onChange={(event) => setLocationDraft(event.target.value)}
                  placeholder="Newark, New Jersey"
                />
              </label>
              <label htmlFor="publicEmailEdit">
                Public contact email
                <input
                  id="publicEmailEdit"
                  type="email"
                  value={publicEmailDraft}
                  onChange={(event) => setPublicEmailDraft(event.target.value)}
                  placeholder="studio@example.com"
                />
              </label>
              <label htmlFor="website" className="public-profile-edit-wide">
                Website
                <input
                  id="website"
                  type="url"
                  value={websiteDraft}
                  onChange={(event) => setWebsiteDraft(event.target.value)}
                  placeholder="https://example.com"
                />
              </label>
              <fieldset className="public-profile-edit-wide role-fieldset">
                <legend>Also works as</legend>
                <div className="role-options">
                  {PROFILE_TYPE_OPTIONS.filter((option) => option.value !== profile.type).map(
                    (option) => (
                      <label key={option.value} className="role-option">
                        <input
                          type="checkbox"
                          checked={secondaryRolesDraft.includes(option.value)}
                          onChange={(event) =>
                            setSecondaryRolesDraft((current) =>
                              event.target.checked
                                ? [...current, option.value]
                                : current.filter((role) => role !== option.value)
                            )
                          }
                        />
                        <span>{option.label}</span>
                      </label>
                    )
                  )}
                </div>
                <small>
                  Your account type stays {PROFILE_TYPE_LABELS[profile.type]}. Anything added here
                  appears on your profile and makes you findable under that role in the directory.
                </small>
              </fieldset>
              <label htmlFor="specialtiesEdit" className="public-profile-edit-wide">
                Specialties
                <input
                  id="specialtiesEdit"
                  value={specialtiesDraft}
                  onChange={(event) => setSpecialtiesDraft(event.target.value)}
                  placeholder="Painting, public art, Caribbean diaspora"
                />
                <small>Separate up to 12 specialties with commas.</small>
              </label>
              <label htmlFor="bio" className="public-profile-edit-wide">
                Biography or overview
                <textarea id="bio" value={bioDraft} onChange={(event) => setBioDraft(event.target.value)} />
              </label>
            </div>

            <div className="public-profile-media-fields">
              <label htmlFor="avatarUpload">
                Profile image
                <input
                  id="avatarUpload"
                  type="file"
                  accept="image/*"
                  disabled={uploadingAvatar}
                  onChange={(event) => handleUpload(event.target.files?.[0], "avatar")}
                />
              </label>
              <label htmlFor="cvUpload">
                CV (PDF)
                <input
                  id="cvUpload"
                  type="file"
                  accept=".pdf,application/pdf"
                  disabled={uploadingCv}
                  onChange={(event) => handleUpload(event.target.files?.[0], "cv")}
                />
              </label>
            </div>

            <details className="public-profile-private-settings">
              <summary>Private account details</summary>
              <label htmlFor="legalNameEdit">
                Legal / business name
                <input
                  id="legalNameEdit"
                  value={legalNameDraft}
                  onChange={(event) => setLegalNameDraft(event.target.value)}
                />
              </label>
            </details>

            <label htmlFor="isPublic" className="public-profile-visibility">
              <input
                id="isPublic"
                type="checkbox"
                checked={isPublicDraft}
                onChange={(event) => setIsPublicDraft(event.target.checked)}
              />
              <span>
                <strong>Show this profile in the public directory</strong>
                <small>
                  Collectors remain private by default. Turning this off hides your identity from
                  public search without removing provenance records.
                </small>
              </span>
            </label>

            <div className="public-profile-edit-actions">
              <button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save profile"}
              </button>
              <button type="button" className="secondary" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </div>
            {editError && <p className="error">{editError}</p>}
          </form>
        )}

        {canEdit && (
          <section className="wallet-account" aria-labelledby="stellar-wallet-heading">
            <div className="wallet-account-icon" aria-hidden="true">
              <Wallet size={20} strokeWidth={1.7} />
            </div>
            <div className="wallet-account-body">
              <header className="wallet-account-heading">
                <div>
                  <span>Private account administration</span>
                  <h2 id="stellar-wallet-heading">Stellar identity</h2>
                </div>
              </header>
              {profile.linked_wallet ? (
                <>
                  <div className="wallet-address-row">
                    <code>{profile.linked_wallet.slice(0, 8)}…{profile.linked_wallet.slice(-8)}</code>
                    <a
                      href={`${STELLAR_EXPERT_BASE}/account/${profile.linked_wallet}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="View this account on Stellar Expert"
                    >
                      Explorer
                      <ExternalLink size={13} aria-hidden="true" />
                    </a>
                  </div>
                  <p className="wallet-account-meta">Profile-controlled signing is active.</p>
                </>
              ) : (
                <p className="wallet-account-meta">Supports Freighter, Albedo, Rabet, LOBSTR, and Hana.</p>
              )}
              {linkWalletError && <p className="error wallet-account-error">{linkWalletError}</p>}
            </div>
            <div className="wallet-account-actions">
              {profile.linked_wallet ? (
                <>
                  <button
                    type="button"
                    className="secondary"
                    disabled={linkingWallet || disconnectingWallet}
                    onClick={handleLinkWallet}
                  >
                    <RefreshCw size={15} aria-hidden="true" />
                    {linkingWallet ? "Linking…" : "Change wallet"}
                  </button>
                  <button
                    type="button"
                    className="wallet-disconnect-button"
                    disabled={linkingWallet || disconnectingWallet}
                    onClick={handleDisconnectWallet}
                  >
                    <Unplug size={15} aria-hidden="true" />
                    {disconnectingWallet ? "Disconnecting…" : "Disconnect"}
                  </button>
                </>
              ) : (
                <button type="button" className="secondary" disabled={linkingWallet} onClick={handleLinkWallet}>
                  <Wallet size={15} aria-hidden="true" />
                  {linkingWallet ? "Linking…" : "Link wallet"}
                </button>
              )}
              <span className={`wallet-account-status${profile.linked_wallet ? " is-connected" : ""}`}>
                {profile.linked_wallet && <CheckCircle2 size={14} aria-hidden="true" />}
                {profile.linked_wallet
                  ? `Connected to ${STELLAR_NETWORK === "mainnet" ? "Stellar mainnet" : "testnet"}`
                  : "Not connected"}
              </span>
            </div>
          </section>
        )}

        {(profile.bio || canEdit) && (
          <section className="public-profile-about">
            <p className="eyebrow">About</p>
            <h2>{PROFILE_TYPE_LABELS[profile.type]} profile</h2>
            {profile.bio ? (
              <p className="profile-bio">{profile.bio}</p>
            ) : (
              <p className="muted">Add a biography or overview to complete this public profile.</p>
            )}
          </section>
        )}

        {(artworks.length > 0 || canEdit) && (
          <section className="public-profile-works">
            <div className="artworks-header public-profile-works-heading">
              <div>
                <p className="eyebrow">Archive</p>
                <h2 className="section-heading">Artworks</h2>
              </div>
              {canEdit && artworks.length > 0 && !selectingForCatalog && (
                <button type="button" className="secondary" onClick={startCatalogSelection}>
                  Select for catalog
                </button>
              )}
              {selectingForCatalog && (
                <div className="catalog-selection-bar">
                  <button
                    type="button"
                    disabled={selectedForCatalog.length === 0}
                    onClick={handleGenerateCatalog}
                  >
                    Generate catalog ({selectedForCatalog.length})
                  </button>
                  <button type="button" className="secondary" onClick={cancelCatalogSelection}>
                    Cancel
                  </button>
                </div>
              )}
            </div>
            {artworks.length === 0 && <p className="muted">No artworks yet.</p>}
            <ul className="artwork-grid">
              {artworks.map((artwork) => {
                const thumb = thumbnails[artwork.id] ? (
                  <img src={thumbnails[artwork.id]} alt={artwork.title} />
                ) : (
                  <div className="thumb-placeholder" aria-hidden="true" />
                );
                const caption = (
                  <>
                    <span className="artwork-tile-title">
                      {artwork.title}
                      <SoldDot soldAt={artwork.sold_at} />
                    </span>
                    <span className="muted">
                      {[artwork.medium, artwork.year].filter(Boolean).join(" · ")}
                    </span>
                  </>
                );

                return (
                  <li key={artwork.id}>
                    {selectingForCatalog ? (
                      <button
                        type="button"
                        className={`artwork-tile-select${
                          selectedForCatalog.includes(artwork.id) ? " selected" : ""
                        }`}
                        onClick={() => toggleCatalogSelection(artwork.id)}
                      >
                        {thumb}
                        {caption}
                      </button>
                    ) : (
                      <Link to={artworkPath(artwork)}>
                        {thumb}
                        {caption}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
