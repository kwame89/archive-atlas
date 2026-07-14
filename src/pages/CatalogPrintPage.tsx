import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { getArtworksByIds, getPrimaryImageUrls, getProfileNames } from "../lib/artworks";
import { getErrorMessage } from "../lib/errors";
import type { Artwork } from "../types/database";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function CatalogPrintPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // A malformed id (e.g. a hand-edited URL) shouldn't break the whole batch
  // fetch with a raw Postgres "invalid input syntax for type uuid" error —
  // just drop it, same as a well-formed but nonexistent id already is.
  const ids = (searchParams.get("ids") ?? "").split(",").filter((id) => UUID_RE.test(id));
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [images, setImages] = useState<Record<string, string>>({});
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (ids.length === 0) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    getArtworksByIds(ids)
      .then(async (result) => {
        const byId = new Map(result.map((a) => [a.id, a]));
        const ordered = ids.map((id) => byId.get(id)).filter((a): a is Artwork => Boolean(a));
        setArtworks(ordered);
        const [imageMap, nameMap] = await Promise.all([
          getPrimaryImageUrls(ordered.map((a) => a.id)),
          getProfileNames(ordered.map((a) => a.root_artist_id)),
        ]);
        setImages(imageMap);
        setNames(nameMap);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get("ids")]);

  const backLink = (
    <p className="no-print">
      <button type="button" className="link-back" onClick={() => navigate(-1)}>
        ← Back
      </button>
      {" · "}
      <Link to="/">Home</Link>
    </p>
  );

  if (loading)
    return (
      <div className="print-page catalog-page">
        {backLink}
        <p className="muted">Loading…</p>
      </div>
    );
  if (error)
    return (
      <div className="print-page catalog-page">
        {backLink}
        <p className="error">{error}</p>
      </div>
    );
  if (artworks.length === 0)
    return (
      <div className="print-page catalog-page">
        {backLink}
        <p className="muted">No artworks selected.</p>
      </div>
    );

  return (
    <div className="print-page catalog-page">
      {backLink}
      <button type="button" className="no-print print-button" onClick={() => window.print()}>
        Print
      </button>
      <p className="muted no-print">
        In the dialog, choose "Save as PDF" from the destination/printer list to export a PDF
        instead of printing.
      </p>

      {artworks.map((artwork) => {
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
          <div className="print-sheet catalog-sheet" key={artwork.id}>
            {images[artwork.id] && <img src={images[artwork.id]} alt={artwork.title} />}
            <h1>{artwork.title}</h1>
            <p className="print-byline">{names[artwork.root_artist_id] ?? "Unknown"}</p>
            <p>
              {[artwork.medium, dimensionsDisplay, dateDisplay].filter(Boolean).join(" · ")}
              {artwork.edition_number && artwork.edition_total
                ? ` · Edition ${artwork.edition_number}/${artwork.edition_total}`
                : ""}
            </p>
            {(artwork.is_signed || artwork.condition) && (
              <p>
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
          </div>
        );
      })}
    </div>
  );
}
