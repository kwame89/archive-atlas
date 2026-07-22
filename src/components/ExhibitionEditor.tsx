import { useState, type FormEvent } from "react";
import { Pencil, Save, Trash2, X } from "lucide-react";
import {
  updateExhibition,
  withdrawExhibition,
} from "../lib/artworks";
import { getErrorMessage } from "../lib/errors";
import type { ArtworkEvent } from "../types/database";

interface ExhibitionEditorProps {
  event: ArtworkEvent;
  actorProfileId: string;
  onComplete: () => void | Promise<void>;
}

export function ExhibitionEditor({
  event,
  actorProfileId,
  onComplete,
}: ExhibitionEditorProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(event.exhibition_title ?? "");
  const [venue, setVenue] = useState(event.exhibition_venue ?? "");
  const [location, setLocation] = useState(event.exhibition_location ?? "");
  const [startDate, setStartDate] = useState(event.occurred_at.slice(0, 10));
  const [endDate, setEndDate] = useState(event.exhibition_end_date?.slice(0, 10) ?? "");
  const [notes, setNotes] = useState(event.notes ?? "");
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);
  const [removalReason, setRemovalReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(submitEvent: FormEvent) {
    submitEvent.preventDefault();
    setSaving(true);
    setError("");
    try {
      await updateExhibition(event.id, actorProfileId, {
        title,
        venue: venue || undefined,
        location: location || undefined,
        startDate,
        endDate: endDate || undefined,
        notes: notes || undefined,
      });
      setOpen(false);
      await onComplete();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setRemoving(true);
    setError("");
    try {
      await withdrawExhibition(
        event.id,
        actorProfileId,
        removalReason.trim() || "Removed as an incorrect exhibition record."
      );
      setOpen(false);
      await onComplete();
    } catch (removeError) {
      setError(getErrorMessage(removeError));
    } finally {
      setRemoving(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="secondary exhibition-edit-trigger" onClick={() => setOpen(true)}>
        <Pencil size={14} aria-hidden="true" />
        Edit exhibition
      </button>
    );
  }

  return (
    <div className="exhibition-editor-panel">
      <form onSubmit={handleSubmit} className="exhibition-editor-form">
        <div className="exhibition-editor-heading">
          <div>
            <p className="eyebrow">Correct this record</p>
            <h4>Edit exhibition</h4>
          </div>
          <button type="button" className="icon-button" onClick={() => setOpen(false)} title="Close editor">
            <X size={17} aria-hidden="true" />
            <span className="visually-hidden">Close editor</span>
          </button>
        </div>

        <label htmlFor={`exhibition-title-${event.id}`}>Exhibition / show title</label>
        <input
          id={`exhibition-title-${event.id}`}
          required
          value={title}
          onChange={(changeEvent) => setTitle(changeEvent.target.value)}
        />

        <div className="exhibition-editor-grid">
          <div>
            <label htmlFor={`exhibition-venue-${event.id}`}>Venue / institution</label>
            <input
              id={`exhibition-venue-${event.id}`}
              value={venue}
              onChange={(changeEvent) => setVenue(changeEvent.target.value)}
            />
          </div>
          <div>
            <label htmlFor={`exhibition-location-${event.id}`}>Location</label>
            <input
              id={`exhibition-location-${event.id}`}
              value={location}
              onChange={(changeEvent) => setLocation(changeEvent.target.value)}
              placeholder="City, country"
            />
          </div>
          <div>
            <label htmlFor={`exhibition-start-${event.id}`}>Start date</label>
            <input
              id={`exhibition-start-${event.id}`}
              type="date"
              required
              value={startDate}
              onChange={(changeEvent) => setStartDate(changeEvent.target.value)}
            />
          </div>
          <div>
            <label htmlFor={`exhibition-end-${event.id}`}>End date</label>
            <input
              id={`exhibition-end-${event.id}`}
              type="date"
              value={endDate}
              onChange={(changeEvent) => setEndDate(changeEvent.target.value)}
            />
          </div>
        </div>

        <label htmlFor={`exhibition-notes-${event.id}`}>Notes</label>
        <textarea
          id={`exhibition-notes-${event.id}`}
          value={notes}
          onChange={(changeEvent) => setNotes(changeEvent.target.value)}
        />

        <div className="exhibition-editor-actions">
          <button type="submit" disabled={saving || removing}>
            <Save size={15} aria-hidden="true" />
            {saving ? "Saving…" : "Save changes"}
          </button>
          <button type="button" className="secondary" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>

        {error && <p className="error" role="alert">{error}</p>}
      </form>

      <div className="exhibition-remove-zone">
        {!confirmingRemoval ? (
          <button type="button" className="exhibition-remove-trigger" onClick={() => setConfirmingRemoval(true)}>
            <Trash2 size={15} aria-hidden="true" />
            Remove this exhibition record
          </button>
        ) : (
          <div className="exhibition-remove-confirmation">
            <p><strong>Remove this exhibition?</strong></p>
            <p className="muted">
              It will disappear from the artwork and exhibition pages. A private withdrawal record
              is retained for archive integrity.
            </p>
            <label htmlFor={`exhibition-removal-reason-${event.id}`}>Reason (optional)</label>
            <input
              id={`exhibition-removal-reason-${event.id}`}
              value={removalReason}
              onChange={(changeEvent) => setRemovalReason(changeEvent.target.value)}
              placeholder="For example: Test record, not a real exhibition"
            />
            <div className="exhibition-editor-actions">
              <button type="button" className="danger" disabled={removing || saving} onClick={handleRemove}>
                <Trash2 size={15} aria-hidden="true" />
                {removing ? "Removing…" : "Yes, remove record"}
              </button>
              <button type="button" className="secondary" onClick={() => setConfirmingRemoval(false)}>
                Keep record
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
