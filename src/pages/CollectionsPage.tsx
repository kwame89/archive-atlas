import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Image as ImageIcon,
  Layers,
  Plus,
  Save,
  Search,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { AppHeader } from "../components/AppHeader";
import {
  createCollection,
  deleteCollection,
  getCollectionMembers,
  listCollectionsByArtist,
  updateCollection,
  type CollectionSummary,
  type SaveCollectionInput,
} from "../lib/collections";
import {
  getPrimaryImageUrls,
  listArtworksByArtist,
} from "../lib/artworks";
import { getErrorMessage } from "../lib/errors";
import {
  JGA_STUDIO_INTEGRATION,
  profileHasIntegration,
} from "../lib/profileIntegrations";
import {
  pushCollectionToJga,
  type JgaPushCollectionResult,
} from "../lib/pushToJga";
import type { Artwork, Profile } from "../types/database";

const NEW_COLLECTION_ID = "new";

function formatYearRange(collection: CollectionSummary): string {
  if (collection.start_year && collection.end_year) {
    return collection.start_year === collection.end_year
      ? String(collection.start_year)
      : `${collection.start_year}–${collection.end_year}`;
  }
  if (collection.start_year) return `From ${collection.start_year}`;
  if (collection.end_year) return `Through ${collection.end_year}`;
  return "Dates not set";
}

function parseOptionalYear(value: string): number | null {
  if (!value.trim()) return null;
  const year = Number(value);
  if (!Number.isInteger(year) || year < 1000 || year > 3000) {
    throw new Error("Years must be four-digit numbers.");
  }
  return year;
}

export function CollectionsPage({ profile }: { profile: Profile }) {
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [activeId, setActiveId] = useState(NEW_COLLECTION_ID);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startYear, setStartYear] = useState("");
  const [endYear, setEndYear] = useState("");
  const [coverArtworkId, setCoverArtworkId] = useState("");
  const [selectedArtworkIds, setSelectedArtworkIds] = useState<string[]>([]);
  const [artworkQuery, setArtworkQuery] = useState("");
  const [canPushToJga, setCanPushToJga] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingCollection, setLoadingCollection] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<JgaPushCollectionResult | null>(null);
  const [error, setError] = useState("");

  async function loadWorkspace(preferredCollectionId?: string) {
    setLoading(true);
    setError("");
    try {
      const [nextCollections, nextArtworks, integrationEnabled] =
        await Promise.all([
          listCollectionsByArtist(profile.id),
          listArtworksByArtist(profile.id),
          profileHasIntegration(profile.id, JGA_STUDIO_INTEGRATION),
        ]);
      const nextThumbnails = await getPrimaryImageUrls(
        nextArtworks.map((artwork) => artwork.id)
      );

      setCollections(nextCollections);
      setArtworks(nextArtworks);
      setThumbnails(nextThumbnails);
      setCanPushToJga(integrationEnabled);

      if (preferredCollectionId) {
        setActiveId(preferredCollectionId);
      } else if (
        activeId !== NEW_COLLECTION_ID &&
        nextCollections.some((collection) => collection.id === activeId)
      ) {
        setActiveId(activeId);
      } else {
        setActiveId(nextCollections[0]?.id ?? NEW_COLLECTION_ID);
      }
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkspace();
    // load once per signed-in profile
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id]);

  useEffect(() => {
    let cancelled = false;
    setPushResult(null);
    setArtworkQuery("");

    if (activeId === NEW_COLLECTION_ID) {
      setTitle("");
      setDescription("");
      setStartYear("");
      setEndYear("");
      setCoverArtworkId("");
      setSelectedArtworkIds([]);
      return;
    }

    const collection = collections.find((item) => item.id === activeId);
    if (!collection) return;

    setTitle(collection.title);
    setDescription(collection.description ?? "");
    setStartYear(collection.start_year?.toString() ?? "");
    setEndYear(collection.end_year?.toString() ?? "");
    setCoverArtworkId(collection.cover_artwork_id ?? "");
    setLoadingCollection(true);
    getCollectionMembers(collection.id)
      .then((members) => {
        if (cancelled) return;
        const artworkIds = members.map((member) => member.artwork.id);
        setSelectedArtworkIds(artworkIds);
        setCoverArtworkId((current) =>
          current && artworkIds.includes(current)
            ? current
            : artworkIds[0] ?? ""
        );
      })
      .catch((loadError) => {
        if (!cancelled) setError(getErrorMessage(loadError));
      })
      .finally(() => {
        if (!cancelled) setLoadingCollection(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeId, collections]);

  const artworkById = useMemo(
    () => new Map(artworks.map((artwork) => [artwork.id, artwork])),
    [artworks]
  );

  const selectedArtworks = selectedArtworkIds
    .map((artworkId) => artworkById.get(artworkId))
    .filter((artwork): artwork is Artwork => Boolean(artwork));

  const availableArtworks = useMemo(() => {
    const selected = new Set(selectedArtworkIds);
    const query = artworkQuery.trim().toLowerCase();
    return artworks.filter((artwork) => {
      if (selected.has(artwork.id)) return false;
      if (!query) return true;
      return [artwork.title, artwork.medium, artwork.year?.toString()]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(query));
    });
  }, [artworkQuery, artworks, selectedArtworkIds]);

  function addArtwork(artworkId: string) {
    setSelectedArtworkIds((current) => [...current, artworkId]);
    setCoverArtworkId((current) => current || artworkId);
  }

  function removeArtwork(artworkId: string) {
    setSelectedArtworkIds((current) => {
      const next = current.filter((id) => id !== artworkId);
      setCoverArtworkId((cover) =>
        cover === artworkId ? next[0] ?? "" : cover
      );
      return next;
    });
  }

  function moveArtwork(index: number, direction: -1 | 1) {
    setSelectedArtworkIds((current) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  }

  function buildInput(): SaveCollectionInput {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) throw new Error("Give this collection a title.");
    if (selectedArtworkIds.length === 0) {
      throw new Error("Add at least one artwork to the collection.");
    }

    const normalizedStartYear = parseOptionalYear(startYear);
    const normalizedEndYear = parseOptionalYear(endYear);
    if (
      normalizedStartYear &&
      normalizedEndYear &&
      normalizedStartYear > normalizedEndYear
    ) {
      throw new Error("The ending year cannot be earlier than the starting year.");
    }

    return {
      title: normalizedTitle,
      description: description.trim() || null,
      startYear: normalizedStartYear,
      endYear: normalizedEndYear,
      coverArtworkId:
        coverArtworkId && selectedArtworkIds.includes(coverArtworkId)
          ? coverArtworkId
          : selectedArtworkIds[0],
      artworkIds: selectedArtworkIds,
    };
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setPushResult(null);
    try {
      const input = buildInput();
      const saved =
        activeId === NEW_COLLECTION_ID
          ? await createCollection(profile.id, input)
          : await updateCollection(activeId, input);
      await loadWorkspace(saved.id);
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (activeId === NEW_COLLECTION_ID) return;
    const collection = collections.find((item) => item.id === activeId);
    if (!window.confirm(`Delete “${collection?.title ?? "this collection"}”? The artwork records will remain in your archive.`)) {
      return;
    }

    setDeleting(true);
    setError("");
    try {
      await deleteCollection(activeId);
      setActiveId(NEW_COLLECTION_ID);
      await loadWorkspace();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
    } finally {
      setDeleting(false);
    }
  }

  async function handlePush() {
    if (activeId === NEW_COLLECTION_ID) return;
    setPushing(true);
    setError("");
    setPushResult(null);
    try {
      const saved = await updateCollection(activeId, buildInput());
      setCollections((current) =>
        current.map((collection) =>
          collection.id === saved.id
            ? {
                ...collection,
                ...saved,
                artwork_count: selectedArtworkIds.length,
              }
            : collection
        )
      );
      const response = await pushCollectionToJga(activeId);
      setPushResult(response.collection);
    } catch (pushError) {
      setError(getErrorMessage(pushError));
    } finally {
      setPushing(false);
    }
  }

  const activeCollection = collections.find(
    (collection) => collection.id === activeId
  );

  return (
    <div className="page-wide collections-page">
      <AppHeader profile={profile} />

      <main>
        <header className="collections-intro">
          <div>
            <p className="eyebrow">Bodies of work</p>
            <h1>Collections</h1>
            <p>Manage cohesive bodies of work and their presentation order.</p>
          </div>
          <button
            type="button"
            className="collections-new-button"
            onClick={() => setActiveId(NEW_COLLECTION_ID)}
          >
            <Plus size={17} aria-hidden="true" />
            New collection
          </button>
        </header>

        {error && <p className="error collections-page-error" role="alert">{error}</p>}

        <div className="collections-workspace">
          <aside className="collections-index" aria-label="Your collections">
            <div className="collections-index-heading">
              <span>Your collections</span>
              <strong>{collections.length}</strong>
            </div>

            {loading ? (
              <p className="muted">Loading collections…</p>
            ) : collections.length === 0 ? (
              <div className="collections-empty-index">
                <Layers size={22} strokeWidth={1.5} aria-hidden="true" />
                <p>No collections yet.</p>
              </div>
            ) : (
              <ul>
                {collections.map((collection) => (
                  <li key={collection.id}>
                    <button
                      type="button"
                      className={activeId === collection.id ? "active" : ""}
                      onClick={() => setActiveId(collection.id)}
                    >
                      <span className="collection-index-cover">
                        {collection.cover_artwork_id &&
                        thumbnails[collection.cover_artwork_id] ? (
                          <img
                            src={thumbnails[collection.cover_artwork_id]}
                            alt=""
                          />
                        ) : (
                          <ImageIcon size={20} strokeWidth={1.4} aria-hidden="true" />
                        )}
                      </span>
                      <span>
                        <strong>{collection.title}</strong>
                        <small>
                          {collection.artwork_count} work
                          {collection.artwork_count === 1 ? "" : "s"} ·{" "}
                          {formatYearRange(collection)}
                        </small>
                      </span>
                      <ArrowRight size={15} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          <section className="collection-editor">
            <div className="collection-editor-heading">
              <div>
                <p className="eyebrow">
                  {activeId === NEW_COLLECTION_ID ? "New record" : "Collection record"}
                </p>
                <h2>
                  {activeId === NEW_COLLECTION_ID
                    ? "Build a collection"
                    : activeCollection?.title}
                </h2>
              </div>
              {activeId !== NEW_COLLECTION_ID && (
                <button
                  type="button"
                  className="collection-delete-button"
                  onClick={handleDelete}
                  disabled={deleting || saving}
                  title="Delete collection"
                  aria-label="Delete collection"
                >
                  <Trash2 size={17} aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="collection-fields">
              <label className="collection-title-field">
                <span>Collection title</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g. Between Two Shores"
                />
              </label>

              <div className="collection-year-fields">
                <label>
                  <span>Starting year</span>
                  <input
                    inputMode="numeric"
                    value={startYear}
                    onChange={(event) => setStartYear(event.target.value)}
                    placeholder="2022"
                  />
                </label>
                <label>
                  <span>Ending year</span>
                  <input
                    inputMode="numeric"
                    value={endYear}
                    onChange={(event) => setEndYear(event.target.value)}
                    placeholder="2026"
                  />
                </label>
              </div>

              <label className="collection-description-field">
                <span>Collection statement</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Describe the ideas, period, or visual language that ties these works together."
                />
              </label>
            </div>

            <div className="collection-artwork-columns">
              <section className="collection-selected-works">
                <div className="collection-subheading">
                  <div>
                    <h3>Selected works</h3>
                  </div>
                  <span>{selectedArtworks.length}</span>
                </div>

                {loadingCollection ? (
                  <p className="muted">Loading this collection…</p>
                ) : selectedArtworks.length === 0 ? (
                  <div className="collection-empty-selection">
                    <Layers size={22} strokeWidth={1.4} aria-hidden="true" />
                    <p>Add works from your archive to begin the sequence.</p>
                  </div>
                ) : (
                  <>
                    <label className="collection-cover-field">
                      <span>Collection cover</span>
                      <select
                        value={coverArtworkId}
                        onChange={(event) => setCoverArtworkId(event.target.value)}
                      >
                        {selectedArtworks.map((artwork) => (
                          <option key={artwork.id} value={artwork.id}>
                            {artwork.title}
                          </option>
                        ))}
                      </select>
                    </label>

                    <ol className="collection-sequence">
                      {selectedArtworks.map((artwork, index) => (
                        <li key={artwork.id}>
                          <span className="collection-sequence-number">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span className="collection-artwork-thumbnail">
                            {thumbnails[artwork.id] ? (
                              <img src={thumbnails[artwork.id]} alt="" />
                            ) : (
                              <ImageIcon size={18} strokeWidth={1.4} aria-hidden="true" />
                            )}
                          </span>
                          <span className="collection-artwork-copy">
                            <strong>{artwork.title}</strong>
                            <small>
                              {[artwork.year, artwork.medium]
                                .filter(Boolean)
                                .join(" · ") || "Details not recorded"}
                            </small>
                          </span>
                          <span className="collection-order-actions">
                            <button
                              type="button"
                              onClick={() => moveArtwork(index, -1)}
                              disabled={index === 0}
                              title="Move earlier"
                              aria-label={`Move ${artwork.title} earlier`}
                            >
                              <ArrowUp size={15} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveArtwork(index, 1)}
                              disabled={index === selectedArtworks.length - 1}
                              title="Move later"
                              aria-label={`Move ${artwork.title} later`}
                            >
                              <ArrowDown size={15} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className="remove"
                              onClick={() => removeArtwork(artwork.id)}
                              title="Remove from collection"
                              aria-label={`Remove ${artwork.title} from collection`}
                            >
                              <X size={15} aria-hidden="true" />
                            </button>
                          </span>
                        </li>
                      ))}
                    </ol>
                  </>
                )}
              </section>

              <section className="collection-available-works">
                <div className="collection-subheading">
                  <div>
                    <h3>Archive works</h3>
                  </div>
                </div>

                <label className="collection-artwork-search">
                  <Search size={16} aria-hidden="true" />
                  <span className="visually-hidden">Search archive works</span>
                  <input
                    type="search"
                    value={artworkQuery}
                    onChange={(event) => setArtworkQuery(event.target.value)}
                    placeholder="Search title, year, or medium"
                  />
                </label>

                {availableArtworks.length === 0 ? (
                  <p className="muted collection-no-available">
                    {artworks.length === selectedArtworkIds.length
                      ? "Every archive work is already selected."
                      : "No archive works match this search."}
                  </p>
                ) : (
                  <ul className="collection-available-list">
                    {availableArtworks.map((artwork) => (
                      <li key={artwork.id}>
                        <span className="collection-artwork-thumbnail">
                          {thumbnails[artwork.id] ? (
                            <img src={thumbnails[artwork.id]} alt="" />
                          ) : (
                            <ImageIcon size={18} strokeWidth={1.4} aria-hidden="true" />
                          )}
                        </span>
                        <span className="collection-artwork-copy">
                          <strong>{artwork.title}</strong>
                          <small>
                            {[artwork.year, artwork.medium]
                              .filter(Boolean)
                              .join(" · ") || "Details not recorded"}
                          </small>
                        </span>
                        <button
                          type="button"
                          onClick={() => addArtwork(artwork.id)}
                          title="Add to collection"
                          aria-label={`Add ${artwork.title} to collection`}
                        >
                          <Plus size={16} aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <footer className="collection-editor-actions">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || loadingCollection}
              >
                <Save size={16} aria-hidden="true" />
                {saving ? "Saving…" : activeId === NEW_COLLECTION_ID ? "Create collection" : "Save collection"}
              </button>

              {canPushToJga && activeId !== NEW_COLLECTION_ID && (
                <div className="collection-jga-action">
                  <div>
                    <strong>JGA Studio</strong>
                    <span>Draft collection</span>
                  </div>
                  <button
                    type="button"
                    className="secondary"
                    onClick={handlePush}
                    disabled={pushing || saving}
                  >
                    <Send size={16} aria-hidden="true" />
                    {pushing ? "Pushing…" : pushResult ? "Push again" : "Push collection"}
                  </button>
                </div>
              )}
            </footer>

            {pushResult && (
              <p className="collection-push-result" role="status">
                Collection {pushResult.status === "created" ? "created" : "updated"} in
                JGA Studio as a draft with {pushResult.artwork_count ?? selectedArtworkIds.length} works.
              </p>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
