import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AppHeader } from "../components/AppHeader";
import { getArtwork, updateArtworkDetails } from "../lib/artworks";
import { getErrorMessage } from "../lib/errors";
import { canActFor } from "../lib/profiles";
import type { Artwork, Profile } from "../types/database";

const CONDITION_OPTIONS = ["Excellent", "Good", "Fair", "Poor", "Needs restoration"];

interface ArtworkEditForm {
  title: string;
  description: string;
  medium: string;
  height: string;
  width: string;
  depth: string;
  dimensions: string;
  year: string;
  isCirca: boolean;
  dateDisplayOverride: string;
  editionNumber: string;
  editionTotal: string;
  subjectMatter: string;
  artType: string;
  tags: string;
  isSigned: boolean;
  signatureNotes: string;
  condition: string;
  royaltyPercentage: string;
}

function formFromArtwork(artwork: Artwork): ArtworkEditForm {
  return {
    title: artwork.title,
    description: artwork.description ?? "",
    medium: artwork.medium ?? "",
    height: artwork.height?.toString() ?? "",
    width: artwork.width?.toString() ?? "",
    depth: artwork.depth?.toString() ?? "",
    dimensions: artwork.dimensions ?? "",
    year: artwork.year?.toString() ?? "",
    isCirca: artwork.is_circa,
    dateDisplayOverride: artwork.date_display_override ?? "",
    editionNumber: artwork.edition_number?.toString() ?? "",
    editionTotal: artwork.edition_total?.toString() ?? "",
    subjectMatter: artwork.subject_matter ?? "",
    artType: artwork.art_type ?? "",
    tags: artwork.tags?.join(", ") ?? "",
    isSigned: artwork.is_signed,
    signatureNotes: artwork.signature_notes ?? "",
    condition: artwork.condition ?? "",
    royaltyPercentage: artwork.royalty_percentage?.toString() ?? "",
  };
}

function numberOrNull(value: string): number | null {
  return value.trim() ? Number(value) : null;
}

function textOrNull(value: string): string | null {
  return value.trim() || null;
}

export function EditArtworkPage({ profile }: { profile: Profile }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [artwork, setArtwork] = useState<Artwork | null>(null);
  const [form, setForm] = useState<ArtworkEditForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadEditor() {
      if (!id) return;
      setLoading(true);
      setError("");
      try {
        const nextArtwork = await getArtwork(id);
        if (!nextArtwork) {
          if (!cancelled) setError("Artwork record not found.");
          return;
        }

        const allowed =
          profile.id === nextArtwork.root_artist_id ||
          (await canActFor(nextArtwork.root_artist_id, profile.id));
        if (!allowed) {
          if (!cancelled) setError("You do not have permission to edit this artwork record.");
          return;
        }

        if (!cancelled) {
          setArtwork(nextArtwork);
          setForm(formFromArtwork(nextArtwork));
        }
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadEditor();
    return () => {
      cancelled = true;
    };
  }, [id, profile.id]);

  function updateField<K extends keyof ArtworkEditForm>(key: K, value: ArtworkEditForm[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!id || !form) return;

    if (!form.title.trim()) {
      setError("Artwork title is required.");
      return;
    }

    const royalty = numberOrNull(form.royaltyPercentage);
    if (royalty != null && (royalty < 0 || royalty > 100)) {
      setError("Suggested resale royalty must be between 0 and 100 percent.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await updateArtworkDetails(id, {
        title: form.title,
        description: textOrNull(form.description),
        medium: textOrNull(form.medium),
        height: numberOrNull(form.height),
        width: numberOrNull(form.width),
        depth: numberOrNull(form.depth),
        dimensions: textOrNull(form.dimensions),
        year: numberOrNull(form.year),
        isCirca: form.isCirca,
        dateDisplayOverride: textOrNull(form.dateDisplayOverride),
        editionNumber: numberOrNull(form.editionNumber),
        editionTotal: numberOrNull(form.editionTotal),
        subjectMatter: textOrNull(form.subjectMatter),
        artType: textOrNull(form.artType),
        tags: form.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        isSigned: form.isSigned,
        signatureNotes: textOrNull(form.signatureNotes),
        condition: textOrNull(form.condition),
        royaltyPercentage: royalty,
      });
      navigate(`/artworks/${id}`);
    } catch (err) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  }

  return (
    <div className="page-wide">
      <AppHeader profile={profile} />

      <main className="artwork-edit-page">
        {id && (
          <Link to={`/artworks/${id}`} className="record-back-link">
            <ArrowLeft size={16} aria-hidden="true" />
            Back to artwork
          </Link>
        )}

        {loading && <p className="muted record-message">Loading artwork details…</p>}
        {!loading && !form && <p className="error record-message">{error}</p>}

        {!loading && form && artwork && (
          <>
            <header className="artwork-edit-header">
              <p className="eyebrow">Artwork record</p>
              <h1>Edit artwork details</h1>
              <p>{artwork.title}</p>
            </header>

            <form className="artwork-edit-form" onSubmit={handleSubmit}>
              <section className="artwork-edit-section">
                <header>
                  <span>01</span>
                  <div><h2>Identity</h2><p>Catalog information and public description.</p></div>
                </header>
                <div className="artwork-edit-fields">
                  <label>
                    <span>Title</span>
                    <input required value={form.title} onChange={(event) => updateField("title", event.target.value)} />
                  </label>
                  <label>
                    <span>Type of art</span>
                    <input value={form.artType} onChange={(event) => updateField("artType", event.target.value)} placeholder="Painting, sculpture, photography…" />
                  </label>
                  <label>
                    <span>Subject matter</span>
                    <input value={form.subjectMatter} onChange={(event) => updateField("subjectMatter", event.target.value)} placeholder="Portrait, landscape, still life…" />
                  </label>
                  <label className="edit-field-wide">
                    <span>Description</span>
                    <textarea value={form.description} onChange={(event) => updateField("description", event.target.value)} />
                  </label>
                  <label className="edit-field-wide">
                    <span>Tags</span>
                    <input value={form.tags} onChange={(event) => updateField("tags", event.target.value)} placeholder="Comma-separated" />
                  </label>
                </div>
              </section>

              <section className="artwork-edit-section">
                <header>
                  <span>02</span>
                  <div><h2>Physical details</h2><p>Material, measurements, and current condition.</p></div>
                </header>
                <div className="artwork-edit-fields">
                  <label className="edit-field-wide">
                    <span>Medium</span>
                    <input value={form.medium} onChange={(event) => updateField("medium", event.target.value)} placeholder="Oil on canvas" />
                  </label>
                  <fieldset className="edit-dimensions edit-field-wide">
                    <legend>Dimensions (in)</legend>
                    <label><span>Height</span><input type="number" min="0" step="any" value={form.height} onChange={(event) => updateField("height", event.target.value)} /></label>
                    <label><span>Width</span><input type="number" min="0" step="any" value={form.width} onChange={(event) => updateField("width", event.target.value)} /></label>
                    <label><span>Depth</span><input type="number" min="0" step="any" value={form.depth} onChange={(event) => updateField("depth", event.target.value)} /></label>
                  </fieldset>
                  <label>
                    <span>Dimensions override</span>
                    <input value={form.dimensions} onChange={(event) => updateField("dimensions", event.target.value)} placeholder="Variable dimensions" />
                  </label>
                  <label>
                    <span>Condition</span>
                    <select value={form.condition} onChange={(event) => updateField("condition", event.target.value)}>
                      <option value="">Not recorded</option>
                      {CONDITION_OPTIONS.map((condition) => <option key={condition} value={condition}>{condition}</option>)}
                    </select>
                  </label>
                </div>
              </section>

              <section className="artwork-edit-section">
                <header>
                  <span>03</span>
                  <div><h2>Date and edition</h2><p>Display information used across the archive and catalog.</p></div>
                </header>
                <div className="artwork-edit-fields">
                  <label>
                    <span>Display year</span>
                    <input type="number" value={form.year} onChange={(event) => updateField("year", event.target.value)} />
                  </label>
                  <label className="edit-checkbox-field">
                    <input type="checkbox" checked={form.isCirca} onChange={(event) => updateField("isCirca", event.target.checked)} />
                    <span>Show year as circa</span>
                  </label>
                  <label className="edit-field-wide">
                    <span>Date display override</span>
                    <input value={form.dateDisplayOverride} onChange={(event) => updateField("dateDisplayOverride", event.target.value)} placeholder="1970s or 2007-2010" />
                  </label>
                  <label>
                    <span>Edition number</span>
                    <input type="number" min="0" value={form.editionNumber} onChange={(event) => updateField("editionNumber", event.target.value)} />
                  </label>
                  <label>
                    <span>Edition total</span>
                    <input type="number" min="0" value={form.editionTotal} onChange={(event) => updateField("editionTotal", event.target.value)} />
                  </label>
                </div>
              </section>

              <section className="artwork-edit-section">
                <header>
                  <span>04</span>
                  <div><h2>Signature and royalty</h2><p>Authorship marks and the voluntary resale request.</p></div>
                </header>
                <div className="artwork-edit-fields">
                  <label className="edit-checkbox-field">
                    <input type="checkbox" checked={form.isSigned} onChange={(event) => updateField("isSigned", event.target.checked)} />
                    <span>Artwork is signed</span>
                  </label>
                  <label>
                    <span>Signature location or notes</span>
                    <input value={form.signatureNotes} onChange={(event) => updateField("signatureNotes", event.target.value)} />
                  </label>
                  <label>
                    <span>Suggested resale royalty (%)</span>
                    <input type="number" min="0" max="100" step="0.1" value={form.royaltyPercentage} onChange={(event) => updateField("royaltyPercentage", event.target.value)} />
                  </label>
                </div>
              </section>

              <div className="artwork-edit-actions">
                <button type="submit" disabled={saving}>
                  <Save size={16} aria-hidden="true" />
                  {saving ? "Saving…" : "Save changes"}
                </button>
                <button type="button" className="secondary" onClick={() => navigate(`/artworks/${id}`)} disabled={saving}>Cancel</button>
                {error && <p className="error">{error}</p>}
              </div>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
