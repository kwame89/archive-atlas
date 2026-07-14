import { useState, type FormEvent } from "react";
import { logExhibition } from "../lib/artworks";
import { getErrorMessage } from "../lib/errors";

interface ExhibitionFormProps {
  artworkId: string;
  actorProfileId: string;
  onComplete: () => void;
}

export function ExhibitionForm({ artworkId, actorProfileId, onComplete }: ExhibitionFormProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [venue, setVenue] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await logExhibition(actorProfileId, {
        artworkId,
        title,
        venue: venue || undefined,
        location: location || undefined,
        startDate,
        endDate: endDate || undefined,
        notes: notes || undefined,
      });
      setTitle("");
      setVenue("");
      setLocation("");
      setStartDate("");
      setEndDate("");
      setNotes("");
      setOpen(false);
      onComplete();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="secondary" onClick={() => setOpen(true)}>
        Log an exhibition
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="transfer-form">
      <p className="muted">
        Recording a showing of this work. This won't change ownership or custody. It's logged
        under your profile and can be corroborated by the artist later.
      </p>

      <label htmlFor="exTitle">Exhibition / show title</label>
      <input id="exTitle" required value={title} onChange={(e) => setTitle(e.target.value)} />

      <label htmlFor="exVenue">Venue / institution</label>
      <input id="exVenue" value={venue} onChange={(e) => setVenue(e.target.value)} />

      <label htmlFor="exLocation">Location</label>
      <input
        id="exLocation"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        placeholder="City, country"
      />

      <label htmlFor="exStart">Start date</label>
      <input
        id="exStart"
        type="date"
        required
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
      />

      <label htmlFor="exEnd">End date (optional)</label>
      <input id="exEnd" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />

      <label htmlFor="exNotes">Notes</label>
      <textarea id="exNotes" value={notes} onChange={(e) => setNotes(e.target.value)} />

      <button type="submit" disabled={submitting}>
        {submitting ? "Logging…" : "Log exhibition"}
      </button>
      <button type="button" className="secondary" onClick={() => setOpen(false)}>
        Cancel
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
