import { useEffect, useState, type FormEvent } from "react";
import { Images } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { createArtwork, saveArtworkPrivateNotes, uploadArtworkImages } from "../lib/artworks";
import { getProfile } from "../lib/profiles";
import { getErrorMessage } from "../lib/errors";
import { useLocalDraft } from "../lib/useLocalDraft";
import { ArtworkImageUploader } from "../components/ArtworkImageUploader";
import { ProfileSearchAdd } from "../components/ProfileSearchAdd";
import type { Profile } from "../types/database";
import {
  CLASSIFICATION_OPTIONS,
  getClassificationOption,
  validateClassification,
} from "../lib/classification";

const CONDITION_OPTIONS = ["Excellent", "Good", "Fair", "Poor", "Needs restoration"];

type CollaboratorDraft = Pick<Profile, "id" | "display_name">;

interface ArtworkDraft {
  title: string;
  description: string;
  medium: string;
  height: string;
  width: string;
  depth: string;
  dimensionsOverride: string;
  year: string;
  isCirca: boolean;
  dateDisplayOverride: string;
  classification: string;
  editionNumber: string;
  editionTotal: string;
  subjectMatter: string;
  artType: string;
  tags: string;
  isSigned: boolean;
  signatureNotes: string;
  condition: string;
  royaltyPercentage: string;
  artworkValue: string;
  valueCurrency: string;
  collaborators: CollaboratorDraft[];
  privateNotes: string;
  dateCreated: string;
}

function createInitialDraft(): ArtworkDraft {
  return {
    title: "",
    description: "",
    medium: "",
    height: "",
    width: "",
    depth: "",
    dimensionsOverride: "",
    year: "",
    isCirca: false,
    dateDisplayOverride: "",
    classification: "",
    editionNumber: "",
    editionTotal: "",
    subjectMatter: "",
    artType: "",
    tags: "",
    isSigned: false,
    signatureNotes: "",
    condition: "",
    royaltyPercentage: "",
    artworkValue: "",
    valueCurrency: "USD",
    collaborators: [],
    privateNotes: "",
    dateCreated: new Date().toISOString().slice(0, 10),
  };
}

export function CreateArtworkPage({ profile }: { profile: Profile }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const onBehalfOfId = searchParams.get("onBehalfOf");
  const [onBehalfOfProfile, setOnBehalfOfProfile] = useState<Profile | null>(null);
  const [onBehalfOfError, setOnBehalfOfError] = useState("");
  const draftKey = `archive-atlas:artwork-draft:${profile.id}:${onBehalfOfId ?? "self"}`;
  const [draft, setDraft, clearDraft] = useLocalDraft(draftKey, createInitialDraft);
  const {
    title,
    description,
    medium,
    height,
    width,
    depth,
    dimensionsOverride,
    year,
    isCirca,
    dateDisplayOverride,
    classification,
    editionNumber,
    editionTotal,
    subjectMatter,
    artType,
    tags,
    isSigned,
    signatureNotes,
    condition,
    royaltyPercentage,
    artworkValue,
    valueCurrency,
    collaborators,
    privateNotes,
    dateCreated,
  } = draft;
  const [images, setImages] = useState<File[]>([]);
  const [primaryIndex, setPrimaryIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function updateDraft<K extends keyof ArtworkDraft>(field: K, value: ArtworkDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  useEffect(() => {
    if (!onBehalfOfId) return;
    getProfile(onBehalfOfId)
      .then(setOnBehalfOfProfile)
      .catch((err) => setOnBehalfOfError(getErrorMessage(err)));
  }, [onBehalfOfId]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const parsedArtworkValue = artworkValue.trim() ? Number(artworkValue) : undefined;
      if (
        parsedArtworkValue !== undefined &&
        (!Number.isFinite(parsedArtworkValue) || parsedArtworkValue < 0)
      ) {
        throw new Error("Artwork value must be zero or greater.");
      }

      // Mirrors artworks_classification_valid so the mismatch reads as a
      // sentence rather than a Postgres constraint violation.
      const classificationError = validateClassification(
        classification || null,
        editionNumber ? Number(editionNumber) : null,
        editionTotal ? Number(editionTotal) : null,
      );
      if (classificationError) {
        throw new Error(classificationError);
      }

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
          classification: classification || null,
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
          artworkValue: parsedArtworkValue,
          valueCurrency,
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
          clearDraft();
          setError(`Artwork created, but images failed to upload: ${getErrorMessage(uploadErr)}`);
          navigate(`/artworks/${artwork.id}`);
          return;
        }
      }
      clearDraft();
      navigate(`/artworks/${artwork.id}`);
    } catch (err) {
      setError(getErrorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="card">
      <div className="create-artwork-heading">
        <h1>New artwork</h1>
        <Link to="/artworks/batch" className="create-artwork-batch-link">
          <Images size={16} aria-hidden="true" />
          Batch add
        </Link>
      </div>
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
        <input
          id="title"
          required
          value={title}
          onChange={(e) => updateDraft("title", e.target.value)}
        />

        <label>Co-artists (for collaborative pieces)</label>
        {collaborators.length > 0 && (
          <ul className="results">
            {collaborators.map((c) => (
              <li key={c.id}>
                <span>{c.display_name}</span>
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    updateDraft(
                      "collaborators",
                      collaborators.filter((x) => x.id !== c.id)
                    )
                  }
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <ProfileSearchAdd
          excludeIds={collaborators.map((c) => c.id)}
          onAdd={(p) =>
            updateDraft("collaborators", [
              ...collaborators,
              { id: p.id, display_name: p.display_name },
            ])
          }
          placeholder="Search for a co-artist…"
        />

        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => updateDraft("description", e.target.value)}
          placeholder="Shown publicly on the artwork's page"
        />

        <ArtworkImageUploader
          files={images}
          primaryIndex={primaryIndex}
          onFilesChange={setImages}
          onPrimaryIndexChange={setPrimaryIndex}
        />

        <h2 className="section-heading">Physical details</h2>

        <label htmlFor="medium">Medium</label>
        <input
          id="medium"
          value={medium}
          onChange={(e) => updateDraft("medium", e.target.value)}
          placeholder="e.g. Oil on canvas"
        />

        <label>Dimensions (in)</label>
        <div className="dimension-row">
          <input
            type="number"
            value={height}
            onChange={(e) => updateDraft("height", e.target.value)}
            placeholder="H"
          />
          <input
            type="number"
            value={width}
            onChange={(e) => updateDraft("width", e.target.value)}
            placeholder="W"
          />
          <input
            type="number"
            value={depth}
            onChange={(e) => updateDraft("depth", e.target.value)}
            placeholder="D (optional)"
          />
        </div>

        <label htmlFor="dimensionsOverride">Dimensions override</label>
        <input
          id="dimensionsOverride"
          value={dimensionsOverride}
          onChange={(e) => updateDraft("dimensionsOverride", e.target.value)}
          placeholder={'For irregular cases, e.g. "Variable dimensions"'}
        />

        <label htmlFor="subjectMatter">Subject matter</label>
        <input
          id="subjectMatter"
          value={subjectMatter}
          onChange={(e) => updateDraft("subjectMatter", e.target.value)}
          placeholder="Landscape, Still Life, Portrait, etc."
        />

        <label htmlFor="artType">Type of art</label>
        <input
          id="artType"
          value={artType}
          onChange={(e) => updateDraft("artType", e.target.value)}
          placeholder="Painting, Sculpture, Photography, etc."
        />

        <label htmlFor="tags">Tags</label>
        <input
          id="tags"
          value={tags}
          onChange={(e) => updateDraft("tags", e.target.value)}
          placeholder="Comma-separated"
        />

        <label htmlFor="isSigned">
          <input
            id="isSigned"
            type="checkbox"
            checked={isSigned}
            onChange={(e) => updateDraft("isSigned", e.target.checked)}
          />{" "}
          Signed
        </label>
        <input
          value={signatureNotes}
          onChange={(e) => updateDraft("signatureNotes", e.target.value)}
          placeholder="Signature location/notes"
        />

        <label htmlFor="condition">Condition</label>
        <select
          id="condition"
          value={condition}
          onChange={(e) => updateDraft("condition", e.target.value)}
        >
          <option value="">Not recorded</option>
          {CONDITION_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <h2 className="section-heading">Value &amp; stewardship</h2>

        <label htmlFor="artworkValue">Artwork value</label>
        <div className="dimension-row">
          <select
            id="valueCurrency"
            aria-label="Artwork value currency"
            value={valueCurrency}
            onChange={(e) => updateDraft("valueCurrency", e.target.value)}
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="CAD">CAD</option>
          </select>
          <input
            id="artworkValue"
            type="number"
            min="0"
            step="0.01"
            value={artworkValue}
            onChange={(e) => updateDraft("artworkValue", e.target.value)}
            placeholder="Optional"
          />
        </div>
        <p className="muted">
          Optional archival value for insurance and recordkeeping. This does not set the public
          sale price in JGA Studio.
        </p>

        <label htmlFor="royaltyPercentage">Suggested resale royalty (%)</label>
        <input
          id="royaltyPercentage"
          type="number"
          min="0"
          max="100"
          step="0.1"
          value={royaltyPercentage}
          onChange={(e) => updateDraft("royaltyPercentage", e.target.value)}
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
          onChange={(e) => updateDraft("dateCreated", e.target.value)}
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
          onChange={(e) => updateDraft("year", e.target.value)}
          placeholder="2026"
        />

        <label htmlFor="isCirca">
          <input
            id="isCirca"
            type="checkbox"
            checked={isCirca}
            onChange={(e) => updateDraft("isCirca", e.target.checked)}
          />{" "}
          Show year as "circa"
        </label>

        <label htmlFor="dateDisplayOverride">Date display override</label>
        <input
          id="dateDisplayOverride"
          value={dateDisplayOverride}
          onChange={(e) => updateDraft("dateDisplayOverride", e.target.value)}
          placeholder={'For imprecise dates, e.g. "1970s" or "2007-2010"'}
        />

        <label htmlFor="classification">Classification</label>
        <select
          id="classification"
          value={classification}
          onChange={(e) => {
            const next = getClassificationOption(e.target.value);
            updateDraft("classification", e.target.value);
            // Drop edition values the new classification cannot hold.
            if (next && !next.allowsEditionNumber) updateDraft("editionNumber", "");
            if (next && !next.allowsEditionTotal) updateDraft("editionTotal", "");
          }}
        >
          <option value="">Not recorded</option>
          {CLASSIFICATION_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <p className="field-hint">
          {getClassificationOption(classification)?.description ??
            "Whether this work is one of a kind or part of an edition run. It appears on the certificate of authenticity, so leave it unrecorded rather than guessing."}
        </p>

        {getClassificationOption(classification)?.allowsEditionNumber !== false && (
          <>
            <label htmlFor="editionNumber">Edition number (if applicable)</label>
            <input
              id="editionNumber"
              type="number"
              value={editionNumber}
              onChange={(e) => updateDraft("editionNumber", e.target.value)}
            />
          </>
        )}

        {getClassificationOption(classification)?.allowsEditionTotal !== false && (
          <>
            <label htmlFor="editionTotal">
              Edition total
              {getClassificationOption(classification)?.requiresEditionTotal
                ? " (required)"
                : " (if applicable)"}
            </label>
            <input
              id="editionTotal"
              type="number"
              value={editionTotal}
              onChange={(e) => updateDraft("editionTotal", e.target.value)}
            />
          </>
        )}

        <h2 className="section-heading">Private notes</h2>
        <label htmlFor="privateNotes">Notes — always private</label>
        <textarea
          id="privateNotes"
          value={privateNotes}
          onChange={(e) => updateDraft("privateNotes", e.target.value)}
          placeholder="Only visible to you and other controllers of your profile"
        />

        <button type="submit" disabled={submitting}>
          {submitting ? "Creating…" : "Create artwork"}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => {
            clearDraft();
            navigate("/");
          }}
        >
          Cancel
        </button>
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  );
}
