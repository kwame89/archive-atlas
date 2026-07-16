import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  CalendarPlus,
  CheckCircle2,
  CircleAlert,
  Images,
  Plus,
  Layers,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  getArtworkEventCount,
  getPrimaryImageUrls,
  getRecentArtworkEvents,
  listArtworksByArtist,
  type RecentArtworkEvent,
} from "../lib/artworks";
import { getErrorMessage } from "../lib/errors";
import { AppHeader } from "../components/AppHeader";
import type { Artwork, ArtworkEvent, Profile } from "../types/database";

type ArchiveFilter = "all" | "attention" | "complete";

const EVENT_LABELS: Record<ArtworkEvent["type"], string> = {
  genesis: "Artwork record created",
  ownership_transfer: "Ownership transferred",
  custody_change: "Custody updated",
  exhibition: "Exhibition recorded",
  claim: "Profile claimed",
  condition_report: "Condition report added",
  dispute: "Record disputed",
  succession: "Succession recorded",
};

function getMissingCoreDetails(artwork: Artwork, imageUrl?: string): string[] {
  const missing: string[] = [];
  if (!imageUrl) missing.push("image");
  if (!artwork.medium) missing.push("medium");
  if (!(artwork.dimensions || (artwork.height && artwork.width))) missing.push("dimensions");
  if (!(artwork.date_display_override || artwork.year)) missing.push("date");
  if (!artwork.condition) missing.push("condition");
  return missing;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatEventDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function HomePage({ profile }: { profile: Profile }) {
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [recentEvents, setRecentEvents] = useState<RecentArtworkEvent[]>([]);
  const [eventCount, setEventCount] = useState(0);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ArchiveFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);
      setError("");
      try {
        const list = await listArtworksByArtist(profile.id);
        const artworkIds = list.map((artwork) => artwork.id);
        const [nextThumbnails, nextEvents, nextEventCount] = await Promise.all([
          getPrimaryImageUrls(artworkIds),
          getRecentArtworkEvents(artworkIds),
          getArtworkEventCount(artworkIds),
        ]);
        if (cancelled) return;
        setArtworks(list);
        setThumbnails(nextThumbnails);
        setRecentEvents(nextEvents);
        setEventCount(nextEventCount);
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadDashboard();
    return () => {
      cancelled = true;
    };
  }, [profile.id]);

  const archiveRecords = useMemo(
    () =>
      artworks.map((artwork) => ({
        artwork,
        missing: getMissingCoreDetails(artwork, thumbnails[artwork.id]),
      })),
    [artworks, thumbnails]
  );

  const attentionRecords = archiveRecords.filter((record) => record.missing.length > 0);
  const completeRecords = archiveRecords.filter((record) => record.missing.length === 0);
  const worksWithImages = artworks.filter((artwork) => thumbnails[artwork.id]).length;
  const completedCoreFields = archiveRecords.reduce(
    (total, record) => total + (5 - record.missing.length),
    0
  );
  const archiveCoverage = artworks.length
    ? Math.round((completedCoreFields / (artworks.length * 5)) * 100)
    : 0;

  const filteredRecords = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return archiveRecords.filter((record) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "attention" && record.missing.length > 0) ||
        (filter === "complete" && record.missing.length === 0);
      if (!matchesFilter) return false;
      if (!normalizedQuery) return true;

      const artwork = record.artwork;
      return [
        artwork.title,
        artwork.medium,
        artwork.subject_matter,
        artwork.art_type,
        artwork.year?.toString(),
        ...(artwork.tags ?? []),
      ]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(normalizedQuery));
    });
  }, [archiveRecords, filter, query]);

  const firstName = profile.display_name.trim().split(/\s+/)[0] || profile.display_name;

  return (
    <div className="page-wide dashboard-page">
      <AppHeader profile={profile} />

      <main>
        <section className="dashboard-intro">
          <div>
            <p className="eyebrow">Studio archive</p>
            <h1>{getGreeting()}, {firstName}</h1>
            <p>
              Keep the record moving: document new work, resolve gaps, and follow recent archive
              activity.
            </p>
          </div>
          <div className="dashboard-intro-actions">
            <Link to="/artworks/new" className="button-link dashboard-add-button">
              <Plus size={18} aria-hidden="true" />
              Add artwork
            </Link>
            <Link to="/artworks/batch" className="dashboard-batch-button">
              <Images size={17} aria-hidden="true" />
              Batch add
            </Link>
          </div>
        </section>

        {loading && <p className="muted dashboard-loading">Loading your archive…</p>}
        {error && <p className="error">{error}</p>}

        {!loading && artworks.length === 0 && (
          <div className="empty-state">
            <span className="empty-state-mark" aria-hidden="true">A</span>
            <div>
              <h2>Your archive is ready.</h2>
              <p>Begin with the work that feels most important to document today.</p>
            </div>
            <Link to="/artworks/new" className="button-link">
              <Plus size={17} aria-hidden="true" />
              Add your first artwork
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
        )}

        {!loading && artworks.length > 0 && (
          <>
            <nav className="dashboard-command-bar" aria-label="Archive shortcuts">
              <Link to="/artworks/new">
                <Plus size={18} aria-hidden="true" />
                <span><strong>Add artwork</strong><small>Start a new record</small></span>
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link to="/exhibitions">
                <CalendarPlus size={18} aria-hidden="true" />
                <span><strong>Log exhibition</strong><small>Record a showing</small></span>
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link to="/collections">
                <Layers size={18} aria-hidden="true" />
                <span><strong>Collections</strong><small>Organize bodies of work</small></span>
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link to={`/profiles/${profile.id}`}>
                <UserRound size={18} aria-hidden="true" />
                <span><strong>Artist profile</strong><small>Edit public details</small></span>
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </nav>

            <section className="archive-metrics" aria-label="Archive overview">
              <div>
                <span>Total works</span>
                <strong>{artworks.length}</strong>
                <small>in your archive</small>
              </div>
              <div>
                <span>Record coverage</span>
                <strong>{archiveCoverage}%</strong>
                <small>across core details</small>
              </div>
              <div>
                <span>Photographed</span>
                <strong>{worksWithImages}/{artworks.length}</strong>
                <small>with primary images</small>
              </div>
              <div>
                <span>Provenance entries</span>
                <strong>{eventCount}</strong>
                <small>recorded events</small>
              </div>
            </section>

            <div className="dashboard-focus-grid">
              <section className="dashboard-panel dashboard-attention-panel">
                <div className="dashboard-panel-heading">
                  <div>
                    <p className="eyebrow">Archive health</p>
                    <h2>Needs attention</h2>
                  </div>
                  <span>{attentionRecords.length}</span>
                </div>

                {attentionRecords.length === 0 ? (
                  <div className="dashboard-all-clear">
                    <CheckCircle2 size={24} strokeWidth={1.6} aria-hidden="true" />
                    <div>
                      <strong>Core records are complete.</strong>
                      <p>Your artworks have images, dates, medium, dimensions, and condition.</p>
                    </div>
                  </div>
                ) : (
                  <ul className="attention-list">
                    {attentionRecords.slice(0, 5).map(({ artwork, missing }) => (
                      <li key={artwork.id}>
                        <Link to={`/artworks/${artwork.id}/edit`}>
                          <span className="attention-icon" aria-hidden="true">
                            <CircleAlert size={18} />
                          </span>
                          <span>
                            <strong>{artwork.title}</strong>
                            <small>Add {missing.join(", ")}</small>
                          </span>
                          <ArrowRight size={17} aria-hidden="true" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="dashboard-panel dashboard-activity-panel">
                <div className="dashboard-panel-heading">
                  <div>
                    <p className="eyebrow">Audit trail</p>
                    <h2>Recent activity</h2>
                  </div>
                  <Activity size={20} strokeWidth={1.7} aria-hidden="true" />
                </div>

                {recentEvents.length === 0 ? (
                  <p className="muted">Activity will appear as you build the archive.</p>
                ) : (
                  <ol className="activity-list">
                    {recentEvents.slice(0, 5).map(({ event, artworkTitle }) => (
                      <li key={event.id}>
                        <span className="activity-marker" aria-hidden="true" />
                        <div>
                          <strong>{EVENT_LABELS[event.type]}</strong>
                          {event.artwork_id ? (
                            <Link to={`/artworks/${event.artwork_id}`}>{artworkTitle}</Link>
                          ) : (
                            <span>{artworkTitle}</span>
                          )}
                          <small>{formatEventDate(event.occurred_at)}</small>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </div>

            <section className="dashboard-collection">
              <div className="dashboard-collection-heading">
                <div>
                  <p className="eyebrow">Collection</p>
                  <h2>Your archive</h2>
                </div>
                <span>{filteredRecords.length} shown</span>
              </div>

              <div className="archive-toolbar">
                <label className="archive-search">
                  <Search size={17} aria-hidden="true" />
                  <span className="visually-hidden">Search your archive</span>
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search title, medium, year, or tag"
                  />
                  {query && (
                    <button type="button" onClick={() => setQuery("")} aria-label="Clear search" title="Clear search">
                      <X size={15} aria-hidden="true" />
                    </button>
                  )}
                </label>

                <div className="archive-filter" role="group" aria-label="Filter artwork records">
                  <button type="button" className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")} aria-pressed={filter === "all"}>
                    All <span>{archiveRecords.length}</span>
                  </button>
                  <button type="button" className={filter === "attention" ? "active" : ""} onClick={() => setFilter("attention")} aria-pressed={filter === "attention"}>
                    Needs attention <span>{attentionRecords.length}</span>
                  </button>
                  <button type="button" className={filter === "complete" ? "active" : ""} onClick={() => setFilter("complete")} aria-pressed={filter === "complete"}>
                    Complete <span>{completeRecords.length}</span>
                  </button>
                </div>
              </div>

              {filteredRecords.length === 0 ? (
                <div className="archive-no-results">
                  <Search size={22} strokeWidth={1.5} aria-hidden="true" />
                  <p>No artwork records match this view.</p>
                </div>
              ) : (
                <ul className="dashboard-artwork-grid">
                  {filteredRecords.map(({ artwork, missing }) => {
                    const date = artwork.date_display_override ?? (artwork.year ? `${artwork.is_circa ? "circa " : ""}${artwork.year}` : "Date not recorded");
                    return (
                      <li key={artwork.id}>
                        <Link to={`/artworks/${artwork.id}`}>
                          <div className="dashboard-artwork-image">
                            {thumbnails[artwork.id] ? (
                              <img src={thumbnails[artwork.id]} alt={artwork.title} />
                            ) : (
                              <div className="thumb-placeholder" aria-hidden="true" />
                            )}
                            {missing.length > 0 && (
                              <span><CircleAlert size={13} aria-hidden="true" /> {missing.length}</span>
                            )}
                          </div>
                          <div className="dashboard-artwork-copy">
                            <strong>{artwork.title}</strong>
                            <span>{[artwork.medium, date].filter(Boolean).join(" · ")}</span>
                            <small className={missing.length > 0 ? "needs-attention" : "complete"}>
                              {missing.length > 0 ? (
                                <><CircleAlert size={13} aria-hidden="true" /> {missing.join(", ")} needed</>
                              ) : (
                                <><CheckCircle2 size={13} aria-hidden="true" /> Core record complete</>
                              )}
                            </small>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
