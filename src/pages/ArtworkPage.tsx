import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../lib/AuthProvider";
import { getMyProfile, canActFor } from "../lib/profiles";
import {
  addCollaborators,
  corroborateExhibition,
  getArtwork,
  getArtworkCollaborators,
  getArtworkEvents,
  getArtworkImages,
  getArtworkPrivateNotes,
  getProfileNames,
  removeCollaborator,
  saveArtworkPrivateNotes,
  setPrimaryImage,
  updateGenesisDate,
  updateRoyaltyPercentage,
  uploadArtworkImages,
} from "../lib/artworks";
import { getErrorMessage } from "../lib/errors";
import { TransferForm } from "../components/TransferForm";
import { ExhibitionForm } from "../components/ExhibitionForm";
import { ConditionReportForm } from "../components/ConditionReportForm";
import { ProfileSearchAdd } from "../components/ProfileSearchAdd";
import type { Artwork, ArtworkEvent, ArtworkImage, Profile } from "../types/database";

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
  const { session } = useAuth();
  const [artwork, setArtwork] = useState<Artwork | null>(null);
  const [images, setImages] = useState<ArtworkImage[]>([]);
  const [events, setEvents] = useState<ArtworkEvent[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [canManage, setCanManage] = useState(false);
  const [myProfileId, setMyProfileId] = useState<string | null>(null);
  const [controlsOwner, setControlsOwner] = useState(false);
  const [controlsCustodian, setControlsCustodian] = useState(false);
  const [collaborators, setCollaborators] = useState<Profile[]>([]);
  const [collaboratorError, setCollaboratorError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [imageActionError, setImageActionError] = useState("");
  const [addingImages, setAddingImages] = useState(false);
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

  async function reloadImages() {
    if (!id) return;
    setImages(await getArtworkImages(id));
  }

  async function reloadEvents() {
    if (!id) return;
    setEvents(await getArtworkEvents(id));
  }

  async function loadAll() {
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
    setCollaborators(collaboratorsResult);

    const profileIds = eventsResult.flatMap((e) => [
      e.actor_id,
      e.to_party_id,
      e.from_party_id,
      e.target_profile_id,
    ]);
    if (artworkResult) {
      profileIds.push(
        artworkResult.root_artist_id,
        artworkResult.current_owner_id,
        artworkResult.current_custodian_id
      );
    }
    setNames(await getProfileNames(profileIds.filter((x): x is string => !!x)));

    if (session && artworkResult) {
      const myProfile = await getMyProfile(session.user.id);
      if (myProfile) {
        setMyProfileId(myProfile.id);
        const [rootControl, ownerControl, custodianControl] = await Promise.all([
          canActFor(artworkResult.root_artist_id, myProfile.id),
          artworkResult.current_owner_id
            ? canActFor(artworkResult.current_owner_id, myProfile.id)
            : false,
          artworkResult.current_custodian_id
            ? canActFor(artworkResult.current_custodian_id, myProfile.id)
            : false,
        ]);
        setCanManage(rootControl);
        setControlsOwner(ownerControl);
        setControlsCustodian(custodianControl);
        if (rootControl) {
          setPrivateNotes(await getArtworkPrivateNotes(artworkResult.id));
        }
      }
    }
  }

  useEffect(() => {
    setLoading(true);
    loadAll()
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [id, session]);

  async function handleSetPrimary(imageId: string) {
    if (!id) return;
    setImageActionError("");
    try {
      await setPrimaryImage(id, imageId);
      await reloadImages();
    } catch (err) {
      setImageActionError(getErrorMessage(err));
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

  const primaryImage = images.find((img) => img.is_primary) ?? images[0];

  const dimensionsDisplay =
    artwork.height && artwork.width
      ? `${artwork.height} x ${artwork.width}${artwork.depth ? ` x ${artwork.depth}` : ""} in`
      : artwork.dimensions;

  const dateDisplay = artwork.date_display_override
    ? artwork.date_display_override
    : artwork.year
      ? `${artwork.is_circa ? "circa " : ""}${artwork.year}`
      : null;

  return (
    <div className="card">
      {primaryImage && (
        <img src={primaryImage.url} alt={artwork.title} className="artwork-image" />
      )}

      {images.length > 1 && (
        <div className="thumbnail-row">
          {images.map((img) => (
            <div key={img.id} className="thumbnail">
              <img src={img.url} alt="" />
              {canManage && !img.is_primary && (
                <button type="button" className="secondary" onClick={() => handleSetPrimary(img.id)}>
                  Set as primary
                </button>
              )}
              {img.is_primary && <span className="muted">Primary</span>}
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <div className="add-images">
          <label htmlFor="addImages">Add images</label>
          <input
            id="addImages"
            type="file"
            accept="image/*"
            multiple
            disabled={addingImages}
            onChange={(e) => handleAddImages(Array.from(e.target.files ?? []))}
          />
        </div>
      )}
      {imageActionError && <p className="error">{imageActionError}</p>}

      <h1>{artwork.title}</h1>
      <p className="muted">
        {[artwork.medium, dimensionsDisplay, dateDisplay].filter(Boolean).join(" · ") ||
          "No details recorded"}
        {artwork.edition_number && artwork.edition_total
          ? ` · Edition ${artwork.edition_number}/${artwork.edition_total}`
          : ""}
      </p>
      <p className="muted">
        By{" "}
        <Link to={`/profiles/${artwork.root_artist_id}`}>
          {names[artwork.root_artist_id] ?? "Unknown"}
        </Link>
        {collaborators.map((c) => (
          <span key={c.id}>
            , with <Link to={`/profiles/${c.id}`}>{c.display_name}</Link>
          </span>
        ))}
      </p>
      <p className="muted">
        Owned by{" "}
        {artwork.current_owner_id ? (
          <Link to={`/profiles/${artwork.current_owner_id}`}>
            {names[artwork.current_owner_id] ?? "Unknown"}
          </Link>
        ) : (
          "Unknown"
        )}
        {artwork.current_custodian_id !== artwork.current_owner_id && (
          <>
            {" · Held by "}
            {artwork.current_custodian_id ? (
              <Link to={`/profiles/${artwork.current_custodian_id}`}>
                {names[artwork.current_custodian_id] ?? "Unknown"}
              </Link>
            ) : (
              "Unknown"
            )}
          </>
        )}
      </p>

      {canManage && (
        <div className="collaborator-manager">
          <label>Co-artists</label>
          {collaborators.length > 0 && (
            <ul className="results">
              {collaborators.map((c) => (
                <li key={c.id}>
                  <span>{c.display_name}</span>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => handleRemoveCollaborator(c.id)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <ProfileSearchAdd
            excludeIds={collaborators.map((c) => c.id)}
            onAdd={handleAddCollaborator}
            placeholder="Search for a co-artist…"
          />
          {collaboratorError && <p className="error">{collaboratorError}</p>}
        </div>
      )}

      {(artwork.subject_matter || artwork.art_type) && (
        <p className="muted">
          {[artwork.art_type, artwork.subject_matter].filter(Boolean).join(" · ")}
        </p>
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

      {artwork.description && <p>{artwork.description}</p>}

      {(artwork.is_signed || artwork.condition) && (
        <p className="muted">
          {[
            artwork.is_signed
              ? `Signed${artwork.signature_notes ? ` (${artwork.signature_notes})` : ""}`
              : null,
            artwork.condition ? `Condition: ${artwork.condition}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}

      {(artwork.royalty_percentage != null || canManage) && (
        <div className="royalty-commitment">
          {!editingRoyalty ? (
            <p className="muted">
              {artwork.royalty_percentage != null
                ? `Suggested resale royalty: ${artwork.royalty_percentage}% (not enforced or collected by the platform)`
                : "No resale royalty commitment recorded"}{" "}
              {canManage && (
                <button type="button" className="secondary" onClick={startEditingRoyalty}>
                  Edit
                </button>
              )}
            </p>
          ) : (
            <div className="edit-date-row">
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={royaltyDraft}
                onChange={(e) => setRoyaltyDraft(e.target.value)}
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
        </div>
      )}

      <h2 className="section-heading">Provenance</h2>
      <ul className="timeline">
        {events.map((event) => (
          <li key={event.id}>
            <strong>{EVENT_LABELS[event.type]}</strong>
            <span className="muted"> — {new Date(event.occurred_at).toLocaleDateString()}</span>
            {event.type === "genesis" && canManage && (
              <>
                {!editingGenesisDate ? (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => startEditingGenesisDate(event.occurred_at)}
                  >
                    Edit date
                  </button>
                ) : (
                  <div className="edit-date-row">
                    <input
                      type="date"
                      value={genesisDateDraft}
                      onChange={(e) => setGenesisDateDraft(e.target.value)}
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
              </>
            )}
            {event.type === "genesis" && event.to_party_id && (
              <p className="muted">Owner and custodian: {names[event.to_party_id]}</p>
            )}
            {event.type === "ownership_transfer" && (
              <p className="muted">
                {names[event.from_party_id ?? ""] ?? "Unknown"} →{" "}
                {names[event.to_party_id ?? ""] ?? "Unknown"}
                {event.price != null &&
                  ` · ${event.currency ?? "USD"} ${event.price.toLocaleString()}`}
                {event.actor_id !== event.from_party_id &&
                  ` (via ${names[event.actor_id] ?? "Unknown"})`}
              </p>
            )}
            {event.type === "custody_change" && (
              <p className="muted">
                {names[event.from_party_id ?? ""] ?? "Unknown"} →{" "}
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
                <p className="muted">
                  {event.corroborated_by ? (
                    <span className="tier-badge">
                      Corroborated by {names[event.corroborated_by] ?? "the artist"}
                    </span>
                  ) : (
                    <>
                      <span className="muted">Self-logged by {names[event.actor_id] ?? "Unknown"}</span>
                      {canManage && (
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => handleCorroborate(event.id)}
                        >
                          Corroborate
                        </button>
                      )}
                    </>
                  )}
                </p>
              </>
            )}
            {event.type === "condition_report" && (
              <p className="muted">
                <span className="tier-badge">{event.condition_rating}</span>
                {` · assessed by ${names[event.actor_id] ?? "Unknown"}`}
              </p>
            )}
            {event.notes && <p className="muted">{event.notes}</p>}
            {event.on_chain_anchor_hash && (
              <p className="muted">
                <a
                  href={`https://stellar.expert/explorer/testnet/tx/${event.on_chain_anchor_hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Anchored on Stellar →
                </a>
              </p>
            )}
          </li>
        ))}
      </ul>

      {(controlsOwner || controlsCustodian) && myProfileId && (
        <>
          <h2 className="section-heading">Ownership &amp; custody</h2>
          <TransferForm
            artwork={artwork}
            actorProfileId={myProfileId}
            controlsOwner={controlsOwner}
            controlsCustodian={controlsCustodian}
            onComplete={loadAll}
          />
        </>
      )}

      {(controlsOwner || controlsCustodian || canManage) && myProfileId && (
        <>
          <h2 className="section-heading">Condition</h2>
          <ConditionReportForm
            artworkId={artwork.id}
            actorProfileId={myProfileId}
            onComplete={loadAll}
          />
        </>
      )}

      {myProfileId && (
        <>
          <h2 className="section-heading">Exhibitions</h2>
          <ExhibitionForm artworkId={artwork.id} actorProfileId={myProfileId} onComplete={loadAll} />
        </>
      )}

      {canManage && (
        <>
          <h2 className="section-heading">Private notes</h2>
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
                onChange={(e) => setPrivateNotesDraft(e.target.value)}
              />
              <button type="button" disabled={savingPrivateNotes} onClick={handleSavePrivateNotes}>
                {savingPrivateNotes ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => setEditingPrivateNotes(false)}
              >
                Cancel
              </button>
            </>
          )}
          {privateNotesError && <p className="error">{privateNotesError}</p>}
        </>
      )}

      <p className="muted">
        <Link to="/">Back home</Link> · <Link to={`/artworks/${artwork.id}/print`}>Print</Link>
      </p>
    </div>
  );
}
