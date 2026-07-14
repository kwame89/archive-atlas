import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createArtwork, saveArtworkPrivateNotes, uploadArtworkImages } from "../lib/artworks";
import { getProfile } from "../lib/profiles";
import { getErrorMessage } from "../lib/errors";
import { ProfileSearchAdd } from "../components/ProfileSearchAdd";
import type { Profile } from "../types/database";

const CONDITION_OPTIONS = ["Excellent", "Good", "Fair", "Poor", "Needs restoration"];

export function CreateArtworkPage({ profile }: { profile: Profile }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const onBehalfOfId = searchParams.get("onBehalfOf");
  const [onBehalfOfProfile, setOnBehalfOfProfile] = useState<Profile | null>(null);
  const [onBehalfOfError, setOnBehalfOfError] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [medium, setMedium] = useState("");
  const [height, setHeight] = useState("");
  const [width, setWidth] = useState("");
  const [depth, setDepth] = useState("");
  const [dimensionsOverride, setDimensionsOverride] = useState("");
  const [year, setYear] = useState("");
  const [isCirca, setIsCirca] = useState(false);
  const [dateDisplayOverride, setDateDisplayOverride] = useState("");
  const [editionNumber, setEditionNumber] = useState("");
  const [editionTotal, setEditionTotal] = useState("");
  const [subjectMatter, setSubjectMatter] = useState("");
  const [artType, setArtType] = useState("");
  const [tags, setTags] = useState("");
  const [isSigned, setIsSigned] = useState(false);
  const [signatureNotes, setSignatureNotes] = useState("");
  const [condition, setCondition] = useState("");
  const [royaltyPercentage, setRoyaltyPercentage] = useState("");
  const [collaborators, setCollaborators] = useState<Profile[]>([]);
  const [privateNotes, setPrivateNotes] = useState("");
  const [dateCreated, setDateCreated] = useState(() => new Date().toISOString().slice(0, 10));
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

  useEffect(() => {
    if (!onBehalfOfId) return;
    getProfile(onBehalfOfId)
      .then(setOnBehalfOfProfile)
      .catch((err) => setOnBehalfOfError(getErrorMessage(err)));
  }, [onBehalfOfId]);

  function handleFilesSelected(files: File[]) {
    setImages(files);
    setPrimaryIndex(0);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const rootArtistId = onBehalfOfProfile?.id ?? profile.id;
      const artwork = await createArtwork(
        rootArtistId,
        {
          title,
          description: description || undefined,
          medium: medium || undefined,
          dimensions: dimensionsOverride || undefined,
          height: height ? Number(height) : undefined,
          width: width ? Number(width) : undefined,
          depth: depth ? Number(depth) : undefined,
          year: year ? Number(year) : undefined,
          isCirca,
          dateDisplayOverride: dateDisplayOverride || undefined,
          editionNumber: editionNumber ? Number(editionNumber) : undefined,
          editionTotal: editionTotal ? Number(editionTotal) : undefined,
          subjectMatter: subjectMatter || undefined,
          artType: artType || undefined,
          tags: tags
            ? tags
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean)
            : undefined,
          isSigned,
          signatureNotes: signatureNotes || undefined,
          condition: condition || undefined,
          royaltyPercentage: royaltyPercentage ? Number(royaltyPercentage) : undefined,
          dateCreated: dateCreated || undefined,
          collaboratorIds: collaborators.map((c) => c.id),
        },
        profile.id
      );

      if (privateNotes) {
        await saveArtworkPrivateNotes(artwork.id, privateNotes);
      }

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
      {onBehalfOfId && onBehalfOfProfile ? (
        <p className="muted">
          Logging historical work on behalf of <strong>{onBehalfOfProfile.display_name}</strong>{" "}
          (unclaimed) — they'll be credited as creator, initial owner, and initial custodian; you
          are recorded as the one who logged it.
        </p>
      ) : (
        <p className="muted">
          This logs the genesis record — you as creator, initial owner, and initial custodian.
        </p>
      )}
      {onBehalfOfError && <p className="error">{onBehalfOfError}</p>}
      <form onSubmit={handleSubmit}>
        <label htmlFor="title">Title</label>
        <input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} />

        <label>Co-artists (for collaborative pieces)</label>
        {collaborators.length > 0 && (
          <ul className="results">
            {collaborators.map((c) => (
              <li key={c.id}>
                <span>{c.display_name}</span>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setCollaborators(collaborators.filter((x) => x.id !== c.id))}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <ProfileSearchAdd
          excludeIds={collaborators.map((c) => c.id)}
          onAdd={(p) => setCollaborators([...collaborators, p])}
          placeholder="Search for a co-artist…"
        />

        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Shown publicly on the artwork's page"
        />

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

        <h2 className="section-heading">Physical details</h2>

        <label htmlFor="medium">Medium</label>
        <input
          id="medium"
          value={medium}
          onChange={(e) => setMedium(e.target.value)}
          placeholder="e.g. Oil on canvas"
        />

        <label>Dimensions (in)</label>
        <div className="dimension-row">
          <input
            type="number"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            placeholder="H"
          />
          <input
            type="number"
            value={width}
            onChange={(e) => setWidth(e.target.value)}
            placeholder="W"
          />
          <input
            type="number"
            value={depth}
            onChange={(e) => setDepth(e.target.value)}
            placeholder="D (optional)"
          />
        </div>

        <label htmlFor="dimensionsOverride">Dimensions override</label>
        <input
          id="dimensionsOverride"
          value={dimensionsOverride}
          onChange={(e) => setDimensionsOverride(e.target.value)}
          placeholder={'For irregular cases, e.g. "Variable dimensions"'}
        />

        <label htmlFor="subjectMatter">Subject matter</label>
        <input
          id="subjectMatter"
          value={subjectMatter}
          onChange={(e) => setSubjectMatter(e.target.value)}
          placeholder="Landscape, Still Life, Portrait, etc."
        />

        <label htmlFor="artType">Type of art</label>
        <input
          id="artType"
          value={artType}
          onChange={(e) => setArtType(e.target.value)}
          placeholder="Painting, Sculpture, Photography, etc."
        />

        <label htmlFor="tags">Tags</label>
        <input
          id="tags"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="Comma-separated"
        />

        <label htmlFor="isSigned">
          <input
            id="isSigned"
            type="checkbox"
            checked={isSigned}
            onChange={(e) => setIsSigned(e.target.checked)}
          />{" "}
          Signed
        </label>
        <input
          value={signatureNotes}
          onChange={(e) => setSignatureNotes(e.target.value)}
          placeholder="Signature location/notes"
        />

        <label htmlFor="condition">Condition</label>
        <select id="condition" value={condition} onChange={(e) => setCondition(e.target.value)}>
          <option value="">Not recorded</option>
          {CONDITION_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <label htmlFor="royaltyPercentage">Suggested resale royalty (%)</label>
        <input
          id="royaltyPercentage"
          type="number"
          min="0"
          max="100"
          step="0.1"
          value={royaltyPercentage}
          onChange={(e) => setRoyaltyPercentage(e.target.value)}
          placeholder="e.g. 5"
        />
        <p className="muted">
          Optional. A resale royalty you'd like collectors to honor when this piece changes hands
          again — not enforced or collected by the platform yet, but recorded on the piece and
          visible in its provenance.
        </p>

        <h2 className="section-heading">Date & edition</h2>

        <label htmlFor="dateCreated">Date created</label>
        <input
          id="dateCreated"
          type="date"
          value={dateCreated}
          onChange={(e) => setDateCreated(e.target.value)}
        />
        <p className="muted">
          When the work was actually made — not necessarily today, if you're archiving older
          work.
        </p>

        <label htmlFor="year">Display year</label>
        <input
          id="year"
          type="number"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          placeholder="2026"
        />

        <label htmlFor="isCirca">
          <input
            id="isCirca"
            type="checkbox"
            checked={isCirca}
            onChange={(e) => setIsCirca(e.target.checked)}
          />{" "}
          Show year as "circa"
        </label>

        <label htmlFor="dateDisplayOverride">Date display override</label>
        <input
          id="dateDisplayOverride"
          value={dateDisplayOverride}
          onChange={(e) => setDateDisplayOverride(e.target.value)}
          placeholder={'For imprecise dates, e.g. "1970s" or "2007-2010"'}
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

        <h2 className="section-heading">Private notes</h2>
        <label htmlFor="privateNotes">Notes — always private</label>
        <textarea
          id="privateNotes"
          value={privateNotes}
          onChange={(e) => setPrivateNotes(e.target.value)}
          placeholder="Only visible to you and other controllers of your profile"
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
