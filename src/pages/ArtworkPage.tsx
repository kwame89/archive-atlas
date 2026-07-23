import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  FileText,
  ImagePlus,
  LockKeyhole,
  Pencil,
  Printer,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../lib/authContext";
import { getMyProfile, canActFor, getWalletInfo } from "../lib/profiles";
import { signAndAnchorEvent, explorerBaseForNetwork } from "../lib/stellarWallet";
import {
  addCollaborators,
  corroborateExhibition,
  getArtwork,
  getArtworkCollaborators,
  getArtworkEvents,
  getArtworkImages,
  getArtworkPrivateNotes,
  getProfileNames,
  removeArtworkImage,
  removeCollaborator,
  replaceArtworkImage,
  saveArtworkPrivateNotes,
  setPrimaryImage,
  updateGenesisDate,
  updateRoyaltyPercentage,
  uploadArtworkImages,
  deleteDraftArtwork,
  uploadOwnerInstallationImages,
} from "../lib/artworks";
import { getErrorMessage } from "../lib/errors";
import {
  JGA_STUDIO_INTEGRATION,
  profileHasIntegration,
} from "../lib/profileIntegrations";
import { TransferForm } from "../components/TransferForm";
import { ExhibitionForm } from "../components/ExhibitionForm";
import { ExhibitionEditor } from "../components/ExhibitionEditor";
import { ConditionReportForm } from "../components/ConditionReportForm";
import { PushToJgaButton } from "../components/PushToJgaButton";
import { ConsignmentManager } from "../components/ConsignmentManager";
import { SaleManager } from "../components/SaleManager";
import { ArtworkImageUploader } from "../components/ArtworkImageUploader";
import { ProfileSearchAdd } from "../components/ProfileSearchAdd";
import { AppHeader } from "../components/AppHeader";
import type { Artwork, ArtworkEvent, ArtworkImage, Profile } from "../types/database";
import { formatEditionLabel } from "../lib/classification";
import { SoldDot } from "../components/SoldDot";
import {
  artworkPath,
  profilePathFromParts,
  recordIdFromRoute,
} from "../lib/recordRoutes";

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

function formatArtworkValue(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

type ProofKind = "signed" | "corroborated" | "anchored" | "recorded";

function getProofStatus(event: ArtworkEvent): {
  kind: ProofKind;
  label: string;
  description: string;
} {
  if (event.wallet_signed) {
    return {
      kind: "signed",
      label: "Artist signed",
      description: "Signed by the artist's linked wallet and independently timestamped.",
    };
  }

  if (event.corroborated_by) {
    return {
      kind: "corroborated",
      label: "Corroborated",
      description: "A second profile has confirmed this recorded claim.",
    };
  }

  if (event.on_chain_anchor_hash) {
    return {
      kind: "anchored",
      label: "Platform anchored",
      description: "A tamper-evident timestamp for this claim exists on Stellar.",
    };
  }

  return {
    kind: "recorded",
    label: "Recorded claim",
    description: "Recorded by the named profile; no additional proof is attached yet.",
  };
}

export function ArtworkPage() {
  const { id: artworkRef } = useParams<{ id: string }>();
  const id = recordIdFromRoute(artworkRef);
  const location = useLocation();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [artwork, setArtwork] = useState<Artwork | null>(null);
  const [images, setImages] = useState<ArtworkImage[]>([]);
  const [events, setEvents] = useState<ArtworkEvent[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [canPushToJga, setCanPushToJga] = useState(false);
  const [myProfileId, setMyProfileId] = useState<string | null>(null);
  const [controlsOwner, setControlsOwner] = useState(false);
  const [controlsCustodian, setControlsCustodian] = useState(false);
  const [collaborators, setCollaborators] = useState<Profile[]>([]);
  const [collaboratorError, setCollaboratorError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [imageActionError, setImageActionError] = useState("");
  const [addingImages, setAddingImages] = useState(false);
  const [ownerImageFiles, setOwnerImageFiles] = useState<File[]>([]);
  const [uploadingOwnerImages, setUploadingOwnerImages] = useState(false);
  const [replacingImageId, setReplacingImageId] = useState<string | null>(null);
  const [removingImageId, setRemovingImageId] = useState<string | null>(null);
  const [settingPrimaryImageId, setSettingPrimaryImageId] = useState<string | null>(null);
  const [pendingImageRemovalId, setPendingImageRemovalId] = useState<string | null>(null);
  const [editingGenesisDate, setEditingGenesisDate] = useState(false);
  const [genesisDateDraft, setGenesisDateDraft] = useState("");
  const [genesisDateError, setGenesisDateError] = useState("");
  const [privateNotes, setPrivateNotes] = useState("");
  const [editingPrivateNotes, setEditingPrivateNotes] = useState(false);
  const [privateNotesDraft, setPrivateNotesDraft] = useState("");
  const [privateNotesError, setPrivateNotesError] = useState("");
  const [savingPrivateNotes, setSavingPrivateNotes] = useState(false);
  const [editingRoyalty, setEditingRoyalty] = useState(false);
  const [royaltyDraft, setRoyaltyDraft] = useState("");
  const [royaltyError, setRoyaltyError] = useState("");
  const [savingRoyalty, setSavingRoyalty] = useState(false);
  const [walletInfo, setWalletInfo] = useState<
    Record<string, { trustTier: string; linkedWallet: string | null }>
  >({});
  const [signingEventId, setSigningEventId] = useState<string | null>(null);
  const [signError, setSignError] = useState("");
  const [signErrorEventId, setSignErrorEventId] = useState<string | null>(null);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletingDraft, setDeletingDraft] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function handleDeleteDraft() {
    if (!id) return;
    setDeletingDraft(true);
    setDeleteError("");
    try {
      await deleteDraftArtwork(id);
      navigate("/", { replace: true });
    } catch (err) {
      setDeleteError(getErrorMessage(err));
      setDeletingDraft(false);
      setConfirmingDelete(false);
    }
  }

  async function reloadImages() {
    if (!id) return;
    const nextImages = await getArtworkImages(id);
    setImages(nextImages);
    setActiveImageId((current) =>
      current && nextImages.some((image) => image.id === current)
        ? current
        : (nextImages.find((image) => image.is_primary) ?? nextImages[0])?.id ?? null
    );
  }

  async function reloadEvents() {
    if (!id) return;
    setEvents(await getArtworkEvents(id));
  }

  const loadAll = useCallback(async () => {
    if (!id) return;
    setError("");
    const [artworkResult, eventsResult, imagesResult, collaboratorsResult] = await Promise.all([
      getArtwork(id),
      getArtworkEvents(id),
      getArtworkImages(id),
      getArtworkCollaborators(id),
    ]);
    setArtwork(artworkResult);
    setEvents(eventsResult);
    setImages(imagesResult);
    setActiveImageId((current) =>
      current && imagesResult.some((image) => image.id === current)
        ? current
        : (imagesResult.find((image) => image.is_primary) ?? imagesResult[0])?.id ?? null
    );
    setCollaborators(collaboratorsResult);

    const profileIds = eventsResult.flatMap((e) => [
      e.actor_id,
      e.to_party_id,
      e.from_party_id,
      e.target_profile_id,
      e.corroborated_by,
    ]);
    if (artworkResult) {
      profileIds.push(
        artworkResult.root_artist_id,
        artworkResult.current_owner_id,
        artworkResult.current_custodian_id
      );
    }
    const uniqueProfileIds = profileIds.filter((x): x is string => !!x);
    setNames(await getProfileNames(uniqueProfileIds));
    setWalletInfo(await getWalletInfo(eventsResult.map((e) => e.actor_id)));

    if (session && artworkResult) {
      const profileResult = await getMyProfile(session.user.id);
      setMyProfile(profileResult);
      if (profileResult) {
        setMyProfileId(profileResult.id);
        const [rootControl, ownerControl, custodianControl, jgaIntegrationEnabled] =
          await Promise.all([
          canActFor(artworkResult.root_artist_id, profileResult.id),
          artworkResult.current_owner_id
            ? canActFor(artworkResult.current_owner_id, profileResult.id)
            : false,
          artworkResult.current_custodian_id
            ? canActFor(artworkResult.current_custodian_id, profileResult.id)
            : false,
          profileHasIntegration(
            artworkResult.root_artist_id,
            JGA_STUDIO_INTEGRATION
          ),
        ]);
        setCanManage(rootControl);
        setCanPushToJga(rootControl && jgaIntegrationEnabled);
        setControlsOwner(ownerControl);
        setControlsCustodian(custodianControl);
        if (rootControl) {
          setPrivateNotes(await getArtworkPrivateNotes(artworkResult.id));
        }
      }
    } else {
      setMyProfile(null);
      setMyProfileId(null);
      setCanManage(false);
      setCanPushToJga(false);
      setControlsOwner(false);
      setControlsCustodian(false);
    }
  }, [id, session]);

  useEffect(() => {
    setLoading(true);
    loadAll()
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [loadAll]);

  useEffect(() => {
    if (!artwork) return;
    const canonicalPath = artworkPath(artwork);
    if (location.pathname !== canonicalPath) {
      navigate(canonicalPath, { replace: true });
    }
  }, [artwork, location.pathname, navigate]);

  async function handleSetPrimary(imageId: string) {
    if (!id) return;
    setSettingPrimaryImageId(imageId);
    setImageActionError("");
    try {
      await setPrimaryImage(id, imageId);
      await reloadImages();
    } catch (err) {
      setImageActionError(getErrorMessage(err));
    } finally {
      setSettingPrimaryImageId(null);
    }
  }

  async function handleAddImages(files: File[]) {
    if (!id || files.length === 0) return;
    setAddingImages(true);
    setImageActionError("");
    try {
      await uploadArtworkImages(id, files);
      await reloadImages();
    } catch (err) {
      setImageActionError(getErrorMessage(err));
    } finally {
      setAddingImages(false);
    }
  }

  async function handleAddOwnerInstallationImages() {
    if (!id || ownerImageFiles.length === 0) return;
    setUploadingOwnerImages(true);
    setImageActionError("");
    try {
      await uploadOwnerInstallationImages(id, ownerImageFiles);
      setOwnerImageFiles([]);
      await reloadImages();
    } catch (err) {
      setImageActionError(getErrorMessage(err));
    } finally {
      setUploadingOwnerImages(false);
    }
  }

  async function handleReplaceImage(image: ArtworkImage, file: File) {
    setReplacingImageId(image.id);
    setPendingImageRemovalId(null);
    setImageActionError("");
    try {
      await replaceArtworkImage(image, file);
      await reloadImages();
    } catch (err) {
      setImageActionError(getErrorMessage(err));
    } finally {
      setReplacingImageId(null);
    }
  }

  async function handleRemoveImage(image: ArtworkImage) {
    setRemovingImageId(image.id);
    setImageActionError("");
    try {
      await removeArtworkImage(image);
      setPendingImageRemovalId(null);
      await reloadImages();
    } catch (err) {
      setImageActionError(getErrorMessage(err));
    } finally {
      setRemovingImageId(null);
    }
  }

  async function handleCorroborate(eventId: string) {
    if (!myProfileId) return;
    try {
      await corroborateExhibition(eventId, myProfileId);
      await reloadEvents();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function handleAddCollaborator(collaboratorProfile: Profile) {
    if (!id) return;
    setCollaboratorError("");
    try {
      await addCollaborators(id, [collaboratorProfile.id]);
      setCollaborators([...collaborators, collaboratorProfile]);
    } catch (err) {
      setCollaboratorError(getErrorMessage(err));
    }
  }

  async function handleRemoveCollaborator(profileId: string) {
    if (!id) return;
    setCollaboratorError("");
    try {
      await removeCollaborator(id, profileId);
      setCollaborators(collaborators.filter((c) => c.id !== profileId));
    } catch (err) {
      setCollaboratorError(getErrorMessage(err));
    }
  }

  function startEditingGenesisDate(currentValue: string) {
    setGenesisDateDraft(currentValue.slice(0, 10));
    setGenesisDateError("");
    setEditingGenesisDate(true);
  }

  async function handleSaveGenesisDate(eventId: string) {
    setGenesisDateError("");
    try {
      await updateGenesisDate(eventId, genesisDateDraft);
      await reloadEvents();
      setEditingGenesisDate(false);
    } catch (err) {
      setGenesisDateError(getErrorMessage(err));
    }
  }

  function startEditingRoyalty() {
    setRoyaltyDraft(artwork?.royalty_percentage != null ? String(artwork.royalty_percentage) : "");
    setRoyaltyError("");
    setEditingRoyalty(true);
  }

  async function handleSaveRoyalty() {
    if (!id) return;
    setSavingRoyalty(true);
    setRoyaltyError("");
    try {
      const value = royaltyDraft.trim() ? Number(royaltyDraft) : null;
      await updateRoyaltyPercentage(id, value);
      setArtwork((prev) => (prev ? { ...prev, royalty_percentage: value } : prev));
      setEditingRoyalty(false);
    } catch (err) {
      setRoyaltyError(getErrorMessage(err));
    } finally {
      setSavingRoyalty(false);
    }
  }

  async function handleSignWithWallet(event: ArtworkEvent) {
    const linkedWallet = walletInfo[event.actor_id]?.linkedWallet;
    if (!linkedWallet) return;
    setSigningEventId(event.id);
    setSignError("");
    setSignErrorEventId(null);
    try {
      await signAndAnchorEvent(linkedWallet, event);
      await reloadEvents();
    } catch (err) {
      setSignError(getErrorMessage(err));
      setSignErrorEventId(event.id);
    } finally {
      setSigningEventId(null);
    }
  }

  function startEditingPrivateNotes() {
    setPrivateNotesDraft(privateNotes);
    setPrivateNotesError("");
    setEditingPrivateNotes(true);
  }

  async function handleSavePrivateNotes() {
    if (!id) return;
    setSavingPrivateNotes(true);
    setPrivateNotesError("");
    try {
      await saveArtworkPrivateNotes(id, privateNotesDraft);
      setPrivateNotes(privateNotesDraft);
      setEditingPrivateNotes(false);
    } catch (err) {
      setPrivateNotesError(getErrorMessage(err));
    } finally {
      setSavingPrivateNotes(false);
    }
  }

  if (loading) {
    return (
      <div className="page-wide">
        <AppHeader profile={myProfile} publicActions={false} />
        <div className="record-message">
          <p className="eyebrow">Artwork record</p>
          <p className="muted">Loading the archive…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-wide">
        <AppHeader profile={myProfile} publicActions={false} />
        <div className="record-message">
          <p className="error">{error}</p>
        </div>
      </div>
    );
  }

  if (!artwork) {
    return (
      <div className="page-wide">
        <AppHeader profile={myProfile} publicActions={false} />
        <div className="record-message">
          <h1>Not found</h1>
          <p className="muted">No artwork with this id.</p>
          <Link to="/">Back to the archive</Link>
        </div>
      </div>
    );
  }

  const primaryImage = images.find((img) => img.is_primary) ?? images[0];
  const activeImage = images.find((img) => img.id === activeImageId) ?? primaryImage;
  const imageActionInProgress = Boolean(
    addingImages || replacingImageId || removingImageId || settingPrimaryImageId
  );

  const dimensionsDisplay =
    artwork.height && artwork.width
      ? `${artwork.height} x ${artwork.width}${artwork.depth ? ` x ${artwork.depth}` : ""} in`
      : artwork.dimensions;

  const dateDisplay = artwork.date_display_override
    ? artwork.date_display_override
    : artwork.year
      ? `${artwork.is_circa ? "circa " : ""}${artwork.year}`
      : null;

  const signedEventCount = events.filter((event) => event.wallet_signed).length;
  const anchoredEventCount = events.filter(
    (event) => event.on_chain_anchor_hash && !event.wallet_signed
  ).length;
  const corroboratedEventCount = events.filter((event) => event.corroborated_by).length;
  const hasManagementTools = Boolean(myProfileId || canManage || controlsOwner || controlsCustodian);

  return (
    <div className="page-wide">
      <AppHeader profile={myProfile} publicActions={false} />

      <main className="artwork-record-page">
        <div className="record-toolbar">
          <Link to="/" className="record-back-link">
            <ArrowLeft size={16} aria-hidden="true" />
            Back to archive
          </Link>
          <div className="record-toolbar-actions">
            {canManage && (
              <>
                <Link to={artworkPath(artwork, "edit")} className="record-edit-link">
                  <Pencil size={16} aria-hidden="true" />
                  Edit details
                </Link>
                <Link to={artworkPath(artwork, "certificate")} className="record-certificate-link">
                  <ShieldCheck size={16} aria-hidden="true" />
                  Certificate of authenticity
                </Link>
                {/* Only for records whose genesis event never landed. Once any
                    event exists the record is provenance and the database
                    refuses to delete it (see 0030). */}
                {events.length === 0 && (
                  confirmingDelete ? (
                    <span className="record-delete-confirm">
                      <span>Discard this record?</span>
                      <button
                        type="button"
                        className="record-delete-yes"
                        onClick={handleDeleteDraft}
                        disabled={deletingDraft}
                      >
                        {deletingDraft ? "Discarding…" : "Yes, discard"}
                      </button>
                      <button
                        type="button"
                        className="record-delete-no"
                        onClick={() => setConfirmingDelete(false)}
                        disabled={deletingDraft}
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="record-delete-link"
                      onClick={() => {
                        setDeleteError("");
                        setConfirmingDelete(true);
                      }}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                      Discard record
                    </button>
                  )
                )}
              </>
            )}
            <Link to={artworkPath(artwork, "print")} className="record-print-link">
              <Printer size={16} aria-hidden="true" />
              Print record
            </Link>
          </div>
        </div>

        {deleteError && <p className="record-delete-error">{deleteError}</p>}

        <section className="artwork-record-hero">
          <div className="artwork-media-column">
            <div className="artwork-media-stage">
              {activeImage ? (
                <>
                  <img src={activeImage.url} alt={artwork.title} className="artwork-record-image" />
                  {activeImage.image_kind === "installation" && (
                    <span className="installation-image-label">Collector installation view</span>
                  )}
                </>
              ) : (
                <div className="artwork-record-image-placeholder">
                  <FileText size={30} strokeWidth={1.4} aria-hidden="true" />
                  <span>No image recorded</span>
                </div>
              )}
            </div>

            {images.length > 1 && (
              <div className="record-thumbnail-row" aria-label="Artwork images">
                {images.map((image, index) => (
                  <button
                    key={image.id}
                    type="button"
                    className={`record-thumbnail${activeImage?.id === image.id ? " active" : ""}`}
                    onClick={() => {
                      setActiveImageId(image.id);
                      setPendingImageRemovalId(null);
                    }}
                    disabled={imageActionInProgress}
                    aria-label={`View image ${index + 1}${image.is_primary ? ", primary image" : ""}`}
                  >
                    <img src={image.url} alt="" />
                    {image.is_primary && <span>Primary</span>}
                    {!image.is_primary && image.image_kind === "installation" && <span>Installed</span>}
                  </button>
                ))}
              </div>
            )}

            {canManage && (
              <div className="artwork-media-actions">
                {activeImage && !activeImage.is_primary && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => handleSetPrimary(activeImage.id)}
                    disabled={imageActionInProgress}
                  >
                    {settingPrimaryImageId === activeImage.id ? "Updating…" : "Make primary"}
                  </button>
                )}
                {activeImage && (
                  <>
                    <label
                      className={`file-action replace-file-action${imageActionInProgress ? " is-disabled" : ""}`}
                      htmlFor="replaceImage"
                    >
                      <RefreshCw size={16} aria-hidden="true" />
                      {replacingImageId === activeImage.id ? "Replacing…" : "Replace image"}
                    </label>
                    <input
                      id="replaceImage"
                      className="visually-hidden"
                      type="file"
                      accept="image/*"
                      disabled={imageActionInProgress}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) handleReplaceImage(activeImage, file);
                        event.target.value = "";
                      }}
                    />
                    <button
                      type="button"
                      className="image-remove-button"
                      onClick={() => setPendingImageRemovalId(activeImage.id)}
                      disabled={imageActionInProgress}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                      Remove image
                    </button>
                  </>
                )}
                <label
                  className={`file-action${imageActionInProgress ? " is-disabled" : ""}`}
                  htmlFor="addImages"
                >
                  <ImagePlus size={16} aria-hidden="true" />
                  {addingImages ? "Adding images…" : "Add images"}
                </label>
                <input
                  id="addImages"
                  className="visually-hidden"
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={imageActionInProgress}
                  onChange={(event) => {
                    handleAddImages(Array.from(event.target.files ?? []));
                    event.target.value = "";
                  }}
                />
              </div>
            )}
            {canManage && activeImage && pendingImageRemovalId === activeImage.id && (
              <div className="image-remove-confirmation" role="alert">
                <span>Remove this image from the artwork record? This cannot be undone.</span>
                <div>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setPendingImageRemovalId(null)}
                    disabled={imageActionInProgress}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="image-remove-confirm-button"
                    onClick={() => handleRemoveImage(activeImage)}
                    disabled={imageActionInProgress}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                    {removingImageId === activeImage.id ? "Removing…" : "Remove"}
                  </button>
                </div>
              </div>
            )}
            {imageActionError && <p className="error">{imageActionError}</p>}
          </div>

          <div className="artwork-record-summary">
            <p className="eyebrow">Artwork record</p>
            <h1>{artwork.title}</h1>
            <SoldDot soldAt={artwork.sold_at} />
            <p className="record-byline">
              By{" "}
              <Link
                to={profilePathFromParts(
                  artwork.root_artist_id,
                  names[artwork.root_artist_id] ?? "Unknown artist"
                )}
              >
                {names[artwork.root_artist_id] ?? "Unknown artist"}
              </Link>
              {collaborators.map((collaborator) => (
                <span key={collaborator.id}>
                  , with{" "}
                  <Link to={profilePathFromParts(collaborator.id, collaborator.display_name)}>
                    {collaborator.display_name}
                  </Link>
                </span>
              ))}
            </p>

            <dl className="record-summary-list">
              <div>
                <dt>Date</dt>
                <dd>{dateDisplay ?? "Not recorded"}</dd>
              </div>
              <div>
                <dt>Medium</dt>
                <dd>{artwork.medium ?? "Not recorded"}</dd>
              </div>
              <div>
                <dt>Dimensions</dt>
                <dd>{dimensionsDisplay ?? "Not recorded"}</dd>
              </div>
              {formatEditionLabel(
                artwork.classification,
                artwork.edition_number,
                artwork.edition_total,
              ) && (
                <div>
                  <dt>Edition</dt>
                  <dd>
                    {formatEditionLabel(
                      artwork.classification,
                      artwork.edition_number,
                      artwork.edition_total,
                    )}
                  </dd>
                </div>
              )}
            </dl>

            <div className="record-parties">
              <div>
                <span>Current owner</span>
                <strong>
                  {artwork.current_owner_id ? (
                    <Link
                      to={profilePathFromParts(
                        artwork.current_owner_id,
                        names[artwork.current_owner_id] ?? "Unknown"
                      )}
                    >
                      {names[artwork.current_owner_id] ?? "Unknown"}
                    </Link>
                  ) : (
                    "Unknown"
                  )}
                </strong>
              </div>
              <div>
                <span>Current custodian</span>
                <strong>
                  {artwork.current_custodian_id ? (
                    <Link
                      to={profilePathFromParts(
                        artwork.current_custodian_id,
                        names[artwork.current_custodian_id] ?? "Unknown"
                      )}
                    >
                      {names[artwork.current_custodian_id] ?? "Unknown"}
                    </Link>
                  ) : (
                    "Unknown"
                  )}
                </strong>
              </div>
            </div>

            <div className="record-integrity-summary">
              <div className="record-integrity-heading">
                <ShieldCheck size={19} strokeWidth={1.7} aria-hidden="true" />
                <div>
                  <span>Record integrity</span>
                  <strong>{events.length} recorded {events.length === 1 ? "event" : "events"}</strong>
                </div>
              </div>
              <div className="record-proof-counts">
                <span>{signedEventCount} artist signed</span>
                <span>{anchoredEventCount} platform anchored</span>
                <span>{corroboratedEventCount} corroborated</span>
              </div>
            </div>
          </div>
        </section>

        <nav className="record-section-nav" aria-label="Artwork record sections">
          <a href="#overview">Overview</a>
          <a href="#provenance">Provenance</a>
          {hasManagementTools && <a href="#management">Manage record</a>}
        </nav>

        <div className="artwork-record-content">
          <div className="artwork-record-main">
            <section className="record-section" id="overview">
              <div className="record-section-heading">
                <p className="eyebrow">The work</p>
                <h2>Overview</h2>
              </div>
              {artwork.description ? (
                <p className="record-description">{artwork.description}</p>
              ) : (
                <p className="muted">No public description has been recorded.</p>
              )}

              {artwork.tags && artwork.tags.length > 0 && (
                <div className="tag-row">
                  {artwork.tags.map((tag) => (
                    <span key={tag} className="tag">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </section>

            <section className="record-section" id="provenance">
              <div className="record-section-heading">
                <p className="eyebrow">Chain of record</p>
                <h2>Provenance</h2>
                <p>
                  Each entry is a recorded claim. Its proof label shows what additional evidence
                  is attached without implying authentication or legal title.
                </p>
              </div>

              {events.length === 0 ? (
                <p className="muted">No provenance events have been recorded.</p>
              ) : (
                <ol className="provenance-list">
                  {events.map((event) => {
                    const proof = getProofStatus(event);
                    return (
                      <li key={event.id} className="provenance-event">
                        <div className="provenance-event-marker" aria-hidden="true" />
                        <div className="provenance-event-content">
                          <header className="provenance-event-header">
                            <div>
                              <p className="event-date">
                                {new Date(event.occurred_at).toLocaleDateString(undefined, {
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                })}
                              </p>
                              <h3>{EVENT_LABELS[event.type]}</h3>
                              <p className="event-actor">
                                Recorded by {names[event.actor_id] ?? "Unknown profile"}
                              </p>
                            </div>
                            <span className={`proof-badge ${proof.kind}`}>
                              {proof.kind === "signed" || proof.kind === "corroborated" ? (
                                <CheckCircle2 size={15} aria-hidden="true" />
                              ) : (
                                <ShieldCheck size={15} aria-hidden="true" />
                              )}
                              {proof.label}
                            </span>
                          </header>

                          {event.type === "genesis" && event.to_party_id && (
                            <p>Owner and custodian: {names[event.to_party_id] ?? "Unknown"}</p>
                          )}
                          {event.type === "ownership_transfer" && (
                            <>
                              <p>
                                {names[event.from_party_id ?? ""] ?? "Private seller"} to{" "}
                                {event.buyer_identity_public
                                  ? event.buyer_display_name_public ?? names[event.to_party_id ?? ""] ?? "Buyer"
                                  : event.sale_channel
                                    ? "Private collector"
                                    : names[event.to_party_id ?? ""] ?? "Unknown"}
                                {event.price != null &&
                                  ` · ${event.currency ?? "USD"} ${event.price.toLocaleString()}`}
                                {event.actor_id !== event.from_party_id &&
                                  ` · represented by ${names[event.actor_id] ?? event.seller_type ?? "Unknown"}`}
                              </p>
                              {event.sale_channel && (
                                <p className="muted sale-provenance-meta">
                                  {event.sale_channel === "private" ? "Private sale" : `${event.sale_channel[0].toUpperCase()}${event.sale_channel.slice(1)} sale`}
                                  {event.seller_type && ` · Seller type: ${event.seller_type}`}
                                </p>
                              )}
                            </>
                          )}
                          {event.type === "custody_change" && (
                            <p>
                              {names[event.from_party_id ?? ""] ?? "Unknown"} to{" "}
                              {names[event.to_party_id ?? ""] ?? "Unknown"}
                            </p>
                          )}
                          {event.type === "exhibition" && (
                            <>
                              <p>
                                <strong>{event.exhibition_title}</strong>
                                {event.exhibition_venue && ` · ${event.exhibition_venue}`}
                                {event.exhibition_location && ` · ${event.exhibition_location}`}
                              </p>
                              {event.exhibition_end_date && (
                                <p className="muted">
                                  Through {new Date(event.exhibition_end_date).toLocaleDateString()}
                                </p>
                              )}
                              {event.corroborated_by ? (
                                <p className="muted">
                                  Corroborated by {names[event.corroborated_by] ?? "the artist"}
                                </p>
                              ) : (
                                canManage && (
                                  <button
                                    type="button"
                                    className="secondary"
                                    onClick={() => handleCorroborate(event.id)}
                                  >
                                    Corroborate this claim
                                  </button>
                                )
                              )}
                            </>
                          )}
                          {event.type === "condition_report" && (
                            <p>
                              Condition: <strong>{event.condition_rating}</strong> · assessed by{" "}
                              {names[event.actor_id] ?? "Unknown"}
                            </p>
                          )}
                          {event.notes && <p className="event-notes">{event.notes}</p>}

                          {event.type === "exhibition" &&
                            myProfileId &&
                            (event.actor_id === myProfileId || canManage) && (
                              <ExhibitionEditor
                                event={event}
                                actorProfileId={myProfileId}
                                onComplete={reloadEvents}
                              />
                            )}

                          {event.type === "genesis" && canManage && (
                            <div className="event-controls">
                              {!editingGenesisDate ? (
                                <button
                                  type="button"
                                  className="secondary"
                                  onClick={() => startEditingGenesisDate(event.occurred_at)}
                                >
                                  Edit recorded date
                                </button>
                              ) : (
                                <div className="edit-date-row">
                                  <input
                                    type="date"
                                    value={genesisDateDraft}
                                    onChange={(changeEvent) =>
                                      setGenesisDateDraft(changeEvent.target.value)
                                    }
                                  />
                                  <button type="button" onClick={() => handleSaveGenesisDate(event.id)}>
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    className="secondary"
                                    onClick={() => setEditingGenesisDate(false)}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              )}
                              {genesisDateError && <p className="error">{genesisDateError}</p>}
                            </div>
                          )}

                          <div className="event-proof-detail">
                            <p>{proof.description}</p>
                            {event.on_chain_anchor_hash && (
                              <a
                                href={`${explorerBaseForNetwork(event.anchor_network)}/tx/${event.on_chain_anchor_hash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                View independent timestamp
                                <ExternalLink size={14} aria-hidden="true" />
                              </a>
                            )}
                          </div>

                          {!event.on_chain_anchor_hash &&
                            (event.type === "genesis" || event.type === "ownership_transfer") &&
                            myProfileId === event.actor_id &&
                            walletInfo[event.actor_id]?.trustTier === "wallet_linked" && (
                              <div className="event-controls">
                                <button
                                  type="button"
                                  className="secondary"
                                  disabled={signingEventId === event.id}
                                  onClick={() => handleSignWithWallet(event)}
                                >
                                  {signingEventId === event.id
                                    ? "Signing…"
                                    : "Sign and anchor with your wallet"}
                                </button>
                                {signErrorEventId === event.id && <p className="error">{signError}</p>}
                              </div>
                            )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          </div>

          <aside className="artwork-record-sidebar" aria-label="Artwork facts">
            <section>
              <p className="eyebrow">Record details</p>
              <h2>At a glance</h2>
              <dl className="record-facts">
                <div>
                  <dt>Type</dt>
                  <dd>{artwork.art_type ?? "Not recorded"}</dd>
                </div>
                <div>
                  <dt>Subject</dt>
                  <dd>{artwork.subject_matter ?? "Not recorded"}</dd>
                </div>
                <div>
                  <dt>Signature</dt>
                  <dd>
                    {artwork.is_signed
                      ? `Signed${artwork.signature_notes ? ` · ${artwork.signature_notes}` : ""}`
                      : "Not recorded as signed"}
                  </dd>
                </div>
                <div>
                  <dt>Condition</dt>
                  <dd>{artwork.condition ?? "Not recorded"}</dd>
                </div>
                <div>
                  <dt>Artwork value</dt>
                  <dd>
                    {artwork.artwork_value != null
                      ? `${formatArtworkValue(artwork.artwork_value, artwork.value_currency)} · archival record`
                      : "Not recorded"}
                  </dd>
                </div>
                <div>
                  <dt>Suggested resale royalty</dt>
                  <dd>
                    {artwork.royalty_percentage != null
                      ? `${artwork.royalty_percentage}% · voluntary, not collected by the platform`
                      : "None recorded"}
                  </dd>
                </div>
              </dl>
            </section>
          </aside>
        </div>

        {hasManagementTools && (
          <section className="record-management" id="management">
            <header className="record-management-header">
              <div>
                <p className="eyebrow">Private workspace</p>
                <h2>Manage this record</h2>
              </div>
              <div className="record-management-header-actions">
                <p>These controls are shown according to your relationship to the artwork.</p>
                {canManage && (
                  <Link to={artworkPath(artwork, "edit")} className="button-link">
                    <Pencil size={16} aria-hidden="true" />
                    Edit artwork details
                  </Link>
                )}
              </div>
            </header>

            <div className="record-management-grid">
              {(controlsOwner || controlsCustodian) && myProfileId && (
                <section className="management-panel">
                  <h3>Ownership &amp; custody</h3>
                  <TransferForm
                    artwork={artwork}
                    actorProfileId={myProfileId}
                    controlsOwner={controlsOwner}
                    controlsCustodian={controlsCustodian}
                    onComplete={loadAll}
                  />
                </section>
              )}

              {(canManage || controlsOwner || controlsCustodian) && myProfileId && (
                <section className="management-panel management-panel-wide">
                  <ConsignmentManager
                    artwork={artwork}
                    actorProfileId={myProfileId}
                    canCreate={controlsOwner}
                    canEdit={controlsOwner || controlsCustodian}
                    onComplete={loadAll}
                  />
                </section>
              )}

              {(controlsOwner || controlsCustodian) && myProfileId && (
                <section className="management-panel management-panel-wide">
                  <SaleManager
                    artwork={artwork}
                    actorProfileId={myProfileId}
                    controlsOwner={controlsOwner}
                    controlsCustodian={controlsCustodian}
                    actorProfile={myProfile}
                    onComplete={loadAll}
                  />
                </section>
              )}

              {controlsOwner && !canManage && (
                <section className="management-panel management-panel-wide owner-media-panel">
                  <h3>Installation photos</h3>
                  <p className="muted">
                    Add views of the artwork displayed in your home or collection. These photos join the public media gallery without changing the artwork record or its primary image.
                  </p>
                  <ArtworkImageUploader
                    files={ownerImageFiles}
                    primaryIndex={0}
                    onFilesChange={setOwnerImageFiles}
                    onPrimaryIndexChange={() => undefined}
                    showPrimaryChoice={false}
                    maxFiles={12}
                    label="Installation images"
                    emptyTitle="Add installation photos"
                    filledTitle="Add more installation photos"
                  />
                  <button
                    type="button"
                    disabled={uploadingOwnerImages || ownerImageFiles.length === 0}
                    onClick={handleAddOwnerInstallationImages}
                  >
                    <ImagePlus size={16} aria-hidden="true" />
                    {uploadingOwnerImages ? "Uploading…" : "Add to artwork media"}
                  </button>
                </section>
              )}

              {(controlsOwner || controlsCustodian || canManage) && myProfileId && (
                <section className="management-panel">
                  <h3>Condition</h3>
                  <ConditionReportForm
                    artworkId={artwork.id}
                    actorProfileId={myProfileId}
                    onComplete={loadAll}
                  />
                </section>
              )}

              {canManage && canPushToJga && (
                <section className="management-panel">
                  <h3>JGA Studio</h3>
                  <PushToJgaButton artworkId={artwork.id} />
                </section>
              )}

              {myProfileId && (
                <section className="management-panel">
                  <h3>Exhibition history</h3>
                  <ExhibitionForm
                    artworkId={artwork.id}
                    actorProfileId={myProfileId}
                    onComplete={loadAll}
                  />
                </section>
              )}

              {canManage && (
                <section className="management-panel collaborator-manager">
                  <h3>Co-artists</h3>
                  {collaborators.length > 0 && (
                    <ul className="results">
                      {collaborators.map((collaborator) => (
                        <li key={collaborator.id}>
                          <span>{collaborator.display_name}</span>
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => handleRemoveCollaborator(collaborator.id)}
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <ProfileSearchAdd
                    excludeIds={collaborators.map((collaborator) => collaborator.id)}
                    onAdd={handleAddCollaborator}
                    placeholder="Search for a co-artist…"
                  />
                  {collaboratorError && <p className="error">{collaboratorError}</p>}
                </section>
              )}

              {canManage && (
                <section className="management-panel">
                  <h3>Resale royalty</h3>
                  {!editingRoyalty ? (
                    <>
                      <p className="muted">
                        {artwork.royalty_percentage != null
                          ? `${artwork.royalty_percentage}% suggested voluntary resale royalty.`
                          : "No resale royalty commitment recorded."}
                      </p>
                      <button type="button" className="secondary" onClick={startEditingRoyalty}>
                        Edit royalty
                      </button>
                    </>
                  ) : (
                    <div className="edit-date-row">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={royaltyDraft}
                        onChange={(event) => setRoyaltyDraft(event.target.value)}
                        placeholder="e.g. 5"
                      />
                      <button type="button" disabled={savingRoyalty} onClick={handleSaveRoyalty}>
                        Save
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => setEditingRoyalty(false)}
                      >
                        Cancel
                      </button>
                      {royaltyError && <p className="error">{royaltyError}</p>}
                    </div>
                  )}
                </section>
              )}

              {canManage && (
                <section className="management-panel private-notes-panel">
                  <div className="private-panel-heading">
                    <LockKeyhole size={17} aria-hidden="true" />
                    <h3>Private notes</h3>
                  </div>
                  {!editingPrivateNotes ? (
                    <>
                      <p className="muted">{privateNotes || "No private notes yet."}</p>
                      <button type="button" className="secondary" onClick={startEditingPrivateNotes}>
                        Edit notes
                      </button>
                    </>
                  ) : (
                    <>
                      <textarea
                        value={privateNotesDraft}
                        onChange={(event) => setPrivateNotesDraft(event.target.value)}
                      />
                      <div className="management-button-row">
                        <button
                          type="button"
                          disabled={savingPrivateNotes}
                          onClick={handleSavePrivateNotes}
                        >
                          {savingPrivateNotes ? "Saving…" : "Save"}
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => setEditingPrivateNotes(false)}
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  )}
                  {privateNotesError && <p className="error">{privateNotesError}</p>}
                </section>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
