import { useState, type FormEvent } from "react";
import { changeCustody, transferOwnership } from "../lib/artworks";
import { searchProfiles } from "../lib/profiles";
import { getErrorMessage } from "../lib/errors";
import type { Artwork, Profile } from "../types/database";

interface TransferFormProps {
  artwork: Artwork;
  actorProfileId: string;
  controlsOwner: boolean;
  controlsCustodian: boolean;
  onComplete: () => void;
}

type Mode = "ownership" | "custody";

export function TransferForm({
  artwork,
  actorProfileId,
  controlsOwner,
  controlsCustodian,
  onComplete,
}: TransferFormProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(controlsOwner ? "ownership" : "custody");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [recipient, setRecipient] = useState<Profile | null>(null);
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [alsoTransferCustody, setAlsoTransferCustody] = useState(true);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSearch(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      setResults(await searchProfiles(query));
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!recipient) {
      setError("Pick a recipient first.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      if (mode === "ownership") {
        await transferOwnership(artwork, actorProfileId, {
          toPartyId: recipient.id,
          price: price ? Number(price) : undefined,
          currency,
          notes: notes || undefined,
          alsoTransferCustody,
        });
      } else {
        await changeCustody(artwork, actorProfileId, {
          toPartyId: recipient.id,
          notes: notes || undefined,
        });
      }
      setOpen(false);
      setRecipient(null);
      setQuery("");
      setResults([]);
      setPrice("");
      setNotes("");
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
        Record a transfer
      </button>
    );
  }

  return (
    <div className="transfer-form">
      {controlsOwner && controlsCustodian && (
        <div className="mode-row">
          <label>
            <input
              type="radio"
              name="transferMode"
              checked={mode === "ownership"}
              onChange={() => setMode("ownership")}
            />{" "}
            Ownership transfer (sale/gift)
          </label>
          <label>
            <input
              type="radio"
              name="transferMode"
              checked={mode === "custody"}
              onChange={() => setMode("custody")}
            />{" "}
            Custody change (loan/consignment)
          </label>
        </div>
      )}

      {!recipient ? (
        <form onSubmit={handleSearch}>
          <label htmlFor="recipientSearch">Recipient</label>
          <input
            id="recipientSearch"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search profiles by name…"
          />
          <button type="submit">Search</button>
          <ul className="results">
            {results.map((p) => (
              <li key={p.id}>
                <span>
                  {p.display_name} ({p.type})
                </span>
                <button type="button" onClick={() => setRecipient(p)}>
                  Select
                </button>
              </li>
            ))}
          </ul>
        </form>
      ) : (
        <form onSubmit={handleSubmit}>
          <p className="muted">
            {mode === "ownership" ? "Transferring ownership to" : "Transferring custody to"}{" "}
            <strong>{recipient.display_name}</strong>.{" "}
            <button type="button" className="secondary" onClick={() => setRecipient(null)}>
              Change
            </button>
          </p>

          {mode === "ownership" && (
            <>
              <label htmlFor="price">Price (optional — leave blank for a gift)</label>
              <div className="dimension-row">
                <input
                  id="price"
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                />
                <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>

              <label htmlFor="alsoCustody">
                <input
                  id="alsoCustody"
                  type="checkbox"
                  checked={alsoTransferCustody}
                  onChange={(e) => setAlsoTransferCustody(e.target.checked)}
                />{" "}
                Also transfer custody to this recipient
              </label>
              <p className="muted">
                Uncheck this if you're selling on behalf of the owner but keeping physical
                possession yourself (e.g. a consignment gallery).
              </p>
            </>
          )}

          <label htmlFor="transferNotes">Notes</label>
          <textarea id="transferNotes" value={notes} onChange={(e) => setNotes(e.target.value)} />

          <button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Confirm transfer"}
          </button>
          <button type="button" className="secondary" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </form>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
