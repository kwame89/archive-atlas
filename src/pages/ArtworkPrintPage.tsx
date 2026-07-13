import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getArtwork, getArtworkImages, getProfileNames } from "../lib/artworks";
import { getErrorMessage } from "../lib/errors";
import type { Artwork, ArtworkImage } from "../types/database";

export function ArtworkPrintPage() {
  const { id } = useParams<{ id: string }>();
  const [artwork, setArtwork] = useState<Artwork | null>(null);
  const [images, setImages] = useState<ArtworkImage[]>([]);
  const [artistName, setArtistName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError("");
    Promise.all([getArtwork(id), getArtworkImages(id)])
      .then(async ([artworkResult, imagesResult]) => {
        setArtwork(artworkResult);
        setImages(imagesResult);
        if (artworkResult) {
          const names = await getProfileNames([artworkResult.root_artist_id]);
          setArtistName(names[artworkResult.root_artist_id] ?? "Unknown");
        }
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="muted">Loading…</p>;
  if (error) return <p className="error">{error}</p>;
  if (!artwork) return <p className="muted">No artwork with this id.</p>;

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
    <div className="print-page">
      <button type="button" className="no-print print-button" onClick={() => window.print()}>
        Print
      </button>
      <p className="muted no-print">
        In the dialog, choose "Save as PDF" from the destination/printer list to export a PDF
        instead of printing.
      </p>

      <div className="print-sheet">
        {primaryImage && <img src={primaryImage.url} alt={artwork.title} />}
        <h1>{artwork.title}</h1>
        <p className="print-byline">{artistName}</p>
        <p>
          {[artwork.medium, dimensionsDisplay, dateDisplay].filter(Boolean).join(" · ")}
          {artwork.edition_number && artwork.edition_total
            ? ` · Edition ${artwork.edition_number}/${artwork.edition_total}`
            : ""}
        </p>
        {(artwork.art_type || artwork.subject_matter) && (
          <p>{[artwork.art_type, artwork.subject_matter].filter(Boolean).join(" · ")}</p>
        )}
        {artwork.description && <p>{artwork.description}</p>}
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
    </div>
  );
}
