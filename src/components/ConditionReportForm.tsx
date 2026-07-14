import { useState, type FormEvent } from "react";
import { logConditionReport } from "../lib/artworks";
import { getErrorMessage } from "../lib/errors";

const CONDITION_OPTIONS = ["Excellent", "Good", "Fair", "Poor", "Needs restoration"];

interface ConditionReportFormProps {
  artworkId: string;
  actorProfileId: string;
  onComplete: () => void;
}

export function ConditionReportForm({
  artworkId,
  actorProfileId,
  onComplete,
}: ConditionReportFormProps) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(CONDITION_OPTIONS[0]);
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await logConditionReport(actorProfileId, {
        artworkId,
        rating,
        notes: notes || undefined,
        reportDate,
      });
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
        Log a condition report
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="transfer-form">
      <label htmlFor="crRating">Condition</label>
      <select id="crRating" value={rating} onChange={(e) => setRating(e.target.value)}>
        {CONDITION_OPTIONS.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <label htmlFor="crDate">Date assessed</label>
      <input
        id="crDate"
        type="date"
        required
        value={reportDate}
        onChange={(e) => setReportDate(e.target.value)}
      />

      <label htmlFor="crNotes">Notes</label>
      <textarea
        id="crNotes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Any damage, wear, or restoration details"
      />

      <button type="submit" disabled={submitting}>
        {submitting ? "Saving…" : "Save report"}
      </button>
      <button type="button" className="secondary" onClick={() => setOpen(false)}>
        Cancel
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
