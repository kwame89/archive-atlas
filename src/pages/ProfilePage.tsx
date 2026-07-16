import { useEffect, useState, type FormEvent } from "react";
import {
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Unplug,
  Wallet,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../lib/authContext";
import {
  canActFor,
  getMyProfile,
  getProfile,
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
  const [bioDraft, setBioDraft] = useState("");
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
        bio: bioDraft,
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

      <div className="profile-header">
        {profile.avatar_url ? (
          <img src={profile.avatar_url} alt={profile.display_name} className="avatar" />
        ) : (
          <div className="avatar avatar-placeholder" aria-hidden="true">
            {profile.display_name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="profile-identity">
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
          {canEdit && (
            <section className="wallet-account" aria-labelledby="stellar-wallet-heading">
              <div className="wallet-account-icon" aria-hidden="true">
                <Wallet size={20} strokeWidth={1.7} />
              </div>
              <div className="wallet-account-body">
                <header className="wallet-account-heading">
                  <div>
                    <span>Stellar identity</span>
                    <h2 id="stellar-wallet-heading">Wallet</h2>
                  </div>
                  <span
                    className={`wallet-account-status${profile.linked_wallet ? " is-connected" : ""}`}
                  >
                    {profile.linked_wallet && <CheckCircle2 size={14} aria-hidden="true" />}
                    {profile.linked_wallet
                      ? `Connected to ${STELLAR_NETWORK === "mainnet" ? "Stellar mainnet" : "testnet"}`
                      : "Not connected"}
                  </span>
                </header>

                {profile.linked_wallet ? (
                  <>
                    <div className="wallet-address-row">
                      <code>
                        {profile.linked_wallet.slice(0, 8)}…{profile.linked_wallet.slice(-8)}
                      </code>
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
                    <p className="wallet-account-meta">Artist-controlled signing is active.</p>
                  </>
                ) : (
                  <p className="wallet-account-meta">
                    Supports Freighter, Albedo, Rabet, LOBSTR, and Hana.
                  </p>
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
                  <button
                    type="button"
                    className="secondary"
                    disabled={linkingWallet}
                    onClick={handleLinkWallet}
                  >
                    <Wallet size={15} aria-hidden="true" />
                    {linkingWallet ? "Linking…" : "Link wallet"}
                  </button>
                )}
              </div>
            </section>
          )}
        </div>
      </div>

      {profile.bio && <p className="profile-bio">{profile.bio}</p>}

      {canEdit && !editing && (
        <>
          {!profile.is_public && (
            <p className="muted">Your profile is private — hidden from other visitors.</p>
          )}
          <button type="button" className="secondary" onClick={startEditing}>
            Edit profile
          </button>
        </>
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

          <label htmlFor="isPublic">
            <input
              id="isPublic"
              type="checkbox"
              checked={isPublicDraft}
              onChange={(e) => setIsPublicDraft(e.target.checked)}
            />{" "}
            Publicly visible profile
          </label>
          <p className="muted">
            When off, your name is hidden from other visitors — collectors often keep this off.
            Transfers involving you still show up in a piece's public provenance record, just
            without your identity attached. The artist can always see who owns their work,
            regardless of this setting.
          </p>

          <button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button type="button" className="secondary" onClick={() => setEditing(false)}>
            Cancel
          </button>
          {editError && <p className="error">{editError}</p>}
        </form>
      )}

      <div className="artworks-header">
        <h2 className="section-heading">Artworks</h2>
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
              <span>{artwork.title}</span>
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
                <Link to={`/artworks/${artwork.id}`}>
                  {thumb}
                  {caption}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
