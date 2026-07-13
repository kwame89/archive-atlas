import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { createArtwork, uploadArtworkImages } from "../lib/artworks";
import { getErrorMessage } from "../lib/errors";
import type { Profile } from "../types/database";

export function CreateArtworkPage({ profile }: { profile: Profile }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [medium, setMedium] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [year, setYear] = useState("");
  const [editionNumber, setEditionNumber] = useState("");
  const [editionTotal, setEditionTotal] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [primaryIndex, setPrimaryIndex] = useState(0);
  const [previews, setPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const urls = images.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [images]);

  function handleFilesSelected(files: File[]) {
    setImages(files);
    setPrimaryIndex(0);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const artwork = await createArtwork(profile.id, {
        title,
        medium: medium || undefined,
        dimensions: dimensions || undefined,
        year: year ? Number(year) : undefined,
        editionNumber: editionNumber ? Number(editionNumber) : undefined,
        editionTotal: editionTotal ? Number(editionTotal) : undefined,
      });
      if (images.length > 0) {
        // Artwork is already created at this point; an image upload failure
        // shouldn't lose the genesis record, so this is intentionally a
        // separate try/catch rather than part of the block above.
        try {
          await uploadArtworkImages(artwork.id, images, primaryIndex);
        } catch (uploadErr) {
          setError(`Artwork created, but images failed to upload: ${getErrorMessage(uploadErr)}`);
          navigate(`/artworks/${artwork.id}`);
          return;
        }
      }
      navigate(`/artworks/${artwork.id}`);
    } catch (err) {
      setError(getErrorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="card">
      <h1>New artwork</h1>
      <p className="muted">This logs the genesis record — you as creator, initial owner, and
        initial custodian.</p>
      <form onSubmit={handleSubmit}>
        <label htmlFor="title">Title</label>
        <input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} />

        <label htmlFor="images">Images</label>
        <input
          id="images"
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => handleFilesSelected(Array.from(e.target.files ?? []))}
        />
        {previews.length > 0 && (
          <>
            <p className="muted">Choose which one is the primary image:</p>
            <div className="thumbnail-row">
              {previews.map((src, i) => (
                <label key={src} className="thumbnail">
                  <img src={src} alt="" />
                  <span>
                    <input
                      type="radio"
                      name="primaryImage"
                      checked={primaryIndex === i}
                      onChange={() => setPrimaryIndex(i)}
                    />{" "}
                    Primary
                  </span>
                </label>
              ))}
            </div>
          </>
        )}

        <label htmlFor="medium">Medium</label>
        <input
          id="medium"
          value={medium}
          onChange={(e) => setMedium(e.target.value)}
          placeholder="e.g. Oil on canvas"
        />

        <label htmlFor="dimensions">Dimensions</label>
        <input
          id="dimensions"
          value={dimensions}
          onChange={(e) => setDimensions(e.target.value)}
          placeholder={'e.g. 24 x 36 in'}
        />

        <label htmlFor="year">Year</label>
        <input
          id="year"
          type="number"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          placeholder="2026"
        />

        <label htmlFor="editionNumber">Edition number (if applicable)</label>
        <input
          id="editionNumber"
          type="number"
          value={editionNumber}
          onChange={(e) => setEditionNumber(e.target.value)}
        />

        <label htmlFor="editionTotal">Edition total (if applicable)</label>
        <input
          id="editionTotal"
          type="number"
          value={editionTotal}
          onChange={(e) => setEditionTotal(e.target.value)}
        />

        <button type="submit" disabled={submitting}>
          {submitting ? "Creating…" : "Create artwork"}
        </button>
        <button type="button" className="secondary" onClick={() => navigate("/")}>
          Cancel
        </button>
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  );
}
