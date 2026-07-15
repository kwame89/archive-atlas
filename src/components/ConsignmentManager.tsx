import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  CalendarRange,
  FileCheck2,
  HandCoins,
  PackageCheck,
  Pencil,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import {
  completeConsignment,
  createConsignment,
  getArtworkConsignments,
  getConsignmentAgreementUrl,
  updateConsignmentTerms,
  uploadConsignmentAgreement,
  type ConsignmentTermsInput,
} from "../lib/consignments";
import { getProfileNames } from "../lib/artworks";
import { getErrorMessage } from "../lib/errors";
import { ProfileSearchAdd } from "./ProfileSearchAdd";
import type {
  Artwork,
  Consignment,
  ConsignmentStatus,
  InsuranceResponsibility,
  Profile,
} from "../types/database";

const CURRENCIES = ["USD", "EUR", "GBP", "JMD"];
const AGREEMENT_ACCEPT = ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_AGREEMENT_BYTES = 20 * 1024 * 1024;

const INSURANCE_LABELS: Record<InsuranceResponsibility, string> = {
  not_recorded: "Not recorded",
  consignor: "Consignor is responsible",
  consignee: "Consignee is responsible",
  other: "Other arrangement",
};

interface TermsFormProps {
  consignment?: Consignment;
  consigneeName?: string;
  excludeProfileIds: string[];
  onSave: (input: ConsignmentTermsInput, agreement: File | null) => Promise<void>;
  onCancel: () => void;
}

function optionalNumber(value: string): number | null {
  return value.trim() ? Number(value) : null;
}

function optionalText(value: string): string | null {
  return value.trim() || null;
}

function formatMoney(value: number | null, currency: string): string {
  if (value == null) return "Not recorded";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

function formatDate(value: string | null): string {
  if (!value) return "Open-ended";
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ConsignmentTermsForm({
  consignment,
  consigneeName,
  excludeProfileIds,
  onSave,
  onCancel,
}: TermsFormProps) {
  const [consignee, setConsignee] = useState<Profile | null>(null);
  const [askingPrice, setAskingPrice] = useState(consignment?.asking_price?.toString() ?? "");
  const [currency, setCurrency] = useState(consignment?.currency ?? "USD");
  const [commission, setCommission] = useState(
    consignment?.commission_percentage?.toString() ?? ""
  );
  const [startDate, setStartDate] = useState(
    consignment?.start_date ?? new Date().toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState(consignment?.end_date ?? "");
  const [insuranceResponsibility, setInsuranceResponsibility] =
    useState<InsuranceResponsibility>(consignment?.insurance_responsibility ?? "not_recorded");
  const [insuranceValue, setInsuranceValue] = useState(
    consignment?.insurance_value?.toString() ?? ""
  );
  const [insuranceCurrency, setInsuranceCurrency] = useState(
    consignment?.insurance_currency ?? "USD"
  );
  const [insuranceNotes, setInsuranceNotes] = useState(consignment?.insurance_notes ?? "");
  const [notes, setNotes] = useState(consignment?.notes ?? "");
  const [agreement, setAgreement] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!consignment && !consignee) {
    return (
      <div className="consignment-form consignment-party-picker">
        <section>
          <h4>Consignee</h4>
          <ProfileSearchAdd
            excludeIds={excludeProfileIds}
            onAdd={setConsignee}
            placeholder="Search galleries or other profiles…"
          />
        </section>
        <div className="consignment-form-actions">
          <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const consigneeId = consignment?.consignee_id ?? consignee?.id;
    if (!consigneeId) {
      setError("Select a consignee.");
      return;
    }
    if (endDate && endDate < startDate) {
      setError("The end date cannot be earlier than the start date.");
      return;
    }
    const commissionPercentage = optionalNumber(commission);
    if (commissionPercentage != null && (commissionPercentage < 0 || commissionPercentage > 100)) {
      setError("Commission must be between 0 and 100 percent.");
      return;
    }
    if (agreement && agreement.size > MAX_AGREEMENT_BYTES) {
      setError("Agreement files must be 20 MB or smaller.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await onSave(
        {
          consigneeId,
          askingPrice: optionalNumber(askingPrice),
          currency,
          commissionPercentage,
          startDate,
          endDate: endDate || null,
          insuranceResponsibility,
          insuranceValue: optionalNumber(insuranceValue),
          insuranceCurrency,
          insuranceNotes: optionalText(insuranceNotes),
          notes: optionalText(notes),
        },
        agreement
      );
    } catch (saveError) {
      setError(getErrorMessage(saveError));
      setSubmitting(false);
    }
  }

  return (
    <form className="consignment-form" onSubmit={handleSubmit}>
      <div className="consignment-form-grid">
        <section>
          <h4>Consignee</h4>
          {consignment ? (
            <p className="consignment-fixed-party">{consigneeName ?? "Unknown profile"}</p>
          ) : consignee ? (
            <div className="consignment-selected-party">
              <strong>{consignee.display_name}</strong>
              <button type="button" className="secondary" onClick={() => setConsignee(null)}>
                Change
              </button>
            </div>
          ) : null}
        </section>

        <section>
          <h4>Commercial terms</h4>
          <div className="consignment-paired-fields">
            <label>
              <span>Asking price</span>
              <input type="number" min="0" step="0.01" value={askingPrice} onChange={(event) => setAskingPrice(event.target.value)} />
            </label>
            <label>
              <span>Currency</span>
              <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
                {CURRENCIES.map((code) => <option key={code}>{code}</option>)}
              </select>
            </label>
          </div>
          <label>
            <span>Commission (%)</span>
            <input type="number" min="0" max="100" step="0.1" value={commission} onChange={(event) => setCommission(event.target.value)} />
          </label>
        </section>

        <section>
          <h4>Term</h4>
          <div className="consignment-paired-fields">
            <label>
              <span>Start date</span>
              <input required type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </label>
            <label>
              <span>End date</span>
              <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </label>
          </div>
        </section>

        <section>
          <h4>Insurance</h4>
          <label>
            <span>Responsibility</span>
            <select value={insuranceResponsibility} onChange={(event) => setInsuranceResponsibility(event.target.value as InsuranceResponsibility)}>
              {Object.entries(INSURANCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <div className="consignment-paired-fields">
            <label>
              <span>Insured value</span>
              <input type="number" min="0" step="0.01" value={insuranceValue} onChange={(event) => setInsuranceValue(event.target.value)} />
            </label>
            <label>
              <span>Currency</span>
              <select value={insuranceCurrency} onChange={(event) => setInsuranceCurrency(event.target.value)}>
                {CURRENCIES.map((code) => <option key={code}>{code}</option>)}
              </select>
            </label>
          </div>
          <label>
            <span>Insurance notes</span>
            <textarea value={insuranceNotes} onChange={(event) => setInsuranceNotes(event.target.value)} />
          </label>
        </section>

        <section>
          <h4>Agreement and notes</h4>
          <label>
            <span>{consignment?.agreement_path ? "Replace agreement file" : "Agreement file"}</span>
            <input type="file" accept={AGREEMENT_ACCEPT} onChange={(event) => setAgreement(event.target.files?.[0] ?? null)} />
          </label>
          <label>
            <span>Internal notes</span>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
        </section>
      </div>

      <div className="consignment-form-actions">
        <button type="submit" disabled={submitting}>{submitting ? "Saving…" : consignment ? "Save terms" : "Start consignment"}</button>
        <button type="button" className="secondary" onClick={onCancel} disabled={submitting}>Cancel</button>
      </div>
      {error && <p className="error">{error}</p>}
    </form>
  );
}

interface ConsignmentManagerProps {
  artwork: Artwork;
  actorProfileId: string;
  canCreate: boolean;
  canEdit: boolean;
  onComplete: () => void;
}

export function ConsignmentManager({
  artwork,
  actorProfileId,
  canCreate,
  canEdit,
  onComplete,
}: ConsignmentManagerProps) {
  const [consignments, setConsignments] = useState<Consignment[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [outcomeMode, setOutcomeMode] = useState<"sold" | "returned" | null>(null);
  const [outcomeDate, setOutcomeDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [salePrice, setSalePrice] = useState("");
  const [outcomeNotes, setOutcomeNotes] = useState("");
  const [savingOutcome, setSavingOutcome] = useState(false);
  const [openingAgreementId, setOpeningAgreementId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const next = await getArtworkConsignments(artwork.id);
    setConsignments(next);
    setNames(await getProfileNames(next.flatMap((item) => [item.consignor_id, item.consignee_id])));
  }, [artwork.id]);

  useEffect(() => {
    setLoading(true);
    reload()
      .catch((loadError) => setError(getErrorMessage(loadError)))
      .finally(() => setLoading(false));
  }, [reload]);

  const active = consignments.find((consignment) => consignment.status === "active");

  async function handleCreate(input: ConsignmentTermsInput, agreement: File | null) {
    const created = await createConsignment(artwork, actorProfileId, input);
    setCreating(false);
    if (agreement) {
      try {
        await uploadConsignmentAgreement(created, agreement);
      } catch (agreementError) {
        setError(`Consignment created, but the agreement did not upload: ${getErrorMessage(agreementError)}`);
      }
    }
    await reload();
    onComplete();
  }

  async function handleUpdate(
    consignment: Consignment,
    input: ConsignmentTermsInput,
    agreement: File | null
  ) {
    const updated = await updateConsignmentTerms(consignment.id, input);
    setEditingId(null);
    if (agreement) {
      try {
        await uploadConsignmentAgreement(updated, agreement);
      } catch (agreementError) {
        setError(`Terms saved, but the agreement did not upload: ${getErrorMessage(agreementError)}`);
      }
    }
    await reload();
  }

  async function handleOutcome(consignment: Consignment) {
    if (!outcomeMode) return;
    setSavingOutcome(true);
    setError("");
    try {
      await completeConsignment(artwork, consignment, actorProfileId, {
        status: outcomeMode,
        outcomeDate,
        salePrice: outcomeMode === "sold" ? optionalNumber(salePrice) : null,
        outcomeNotes: optionalText(outcomeNotes),
      });
      setOutcomeMode(null);
      setSalePrice("");
      setOutcomeNotes("");
      await reload();
      onComplete();
    } catch (outcomeError) {
      setError(getErrorMessage(outcomeError));
    } finally {
      setSavingOutcome(false);
    }
  }

  async function handleOpenAgreement(consignment: Consignment) {
    if (!consignment.agreement_path) return;
    setOpeningAgreementId(consignment.id);
    setError("");
    try {
      const url = await getConsignmentAgreementUrl(consignment.agreement_path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (agreementError) {
      setError(getErrorMessage(agreementError));
    } finally {
      setOpeningAgreementId(null);
    }
  }

  function statusLabel(status: ConsignmentStatus) {
    return status === "active" ? "Active" : status === "sold" ? "Sold" : "Returned";
  }

  if (loading) return <p className="muted">Loading consignments…</p>;

  return (
    <div className="consignment-manager">
      <div className="consignment-manager-heading">
        <div>
          <h3>Consignment</h3>
          <p>Private terms and agreement records linked to custody.</p>
        </div>
        {!active && canCreate && !creating && (
          <button type="button" onClick={() => setCreating(true)}>
            <HandCoins size={16} aria-hidden="true" />
            Create consignment
          </button>
        )}
      </div>

      {creating && (
        <ConsignmentTermsForm
          excludeProfileIds={[artwork.current_owner_id, artwork.root_artist_id].filter(Boolean) as string[]}
          onSave={handleCreate}
          onCancel={() => setCreating(false)}
        />
      )}

      {active && editingId === active.id ? (
        <ConsignmentTermsForm
          consignment={active}
          consigneeName={names[active.consignee_id]}
          excludeProfileIds={[]}
          onSave={(input, agreement) => handleUpdate(active, input, agreement)}
          onCancel={() => setEditingId(null)}
        />
      ) : active ? (
        <article className="active-consignment">
          <header>
            <div>
              <span className="consignment-status active">Active</span>
              <h4>{names[active.consignee_id] ?? "Unknown consignee"}</h4>
              <p>Consigned by {names[active.consignor_id] ?? "Unknown owner"}</p>
            </div>
            {canEdit && (
              <button type="button" className="secondary" onClick={() => setEditingId(active.id)}>
                <Pencil size={15} aria-hidden="true" />
                Edit terms
              </button>
            )}
          </header>

          <dl className="consignment-facts">
            <div><dt><HandCoins size={15} aria-hidden="true" /> Asking price</dt><dd>{formatMoney(active.asking_price, active.currency)}</dd></div>
            <div><dt>Commission</dt><dd>{active.commission_percentage != null ? `${active.commission_percentage}%` : "Not recorded"}</dd></div>
            <div><dt><CalendarRange size={15} aria-hidden="true" /> Term</dt><dd>{formatDate(active.start_date)} - {formatDate(active.end_date)}</dd></div>
            <div><dt><ShieldCheck size={15} aria-hidden="true" /> Insurance</dt><dd>{INSURANCE_LABELS[active.insurance_responsibility]}{active.insurance_value != null ? ` · ${formatMoney(active.insurance_value, active.insurance_currency)}` : ""}</dd></div>
          </dl>

          {(active.insurance_notes || active.notes) && (
            <div className="consignment-notes">
              {active.insurance_notes && <p><strong>Insurance:</strong> {active.insurance_notes}</p>}
              {active.notes && <p><strong>Notes:</strong> {active.notes}</p>}
            </div>
          )}

          {active.agreement_path && (
            <button type="button" className="secondary consignment-agreement-button" disabled={openingAgreementId === active.id} onClick={() => handleOpenAgreement(active)}>
              <FileCheck2 size={16} aria-hidden="true" />
              {openingAgreementId === active.id ? "Opening…" : active.agreement_file_name ?? "Open agreement"}
              <ArrowUpRight size={14} aria-hidden="true" />
            </button>
          )}

          {canEdit && (
            <div className="consignment-outcome-actions">
              <button type="button" onClick={() => setOutcomeMode("sold")}>
                <PackageCheck size={16} aria-hidden="true" />
                Mark sold
              </button>
              <button type="button" className="secondary" onClick={() => setOutcomeMode("returned")}>
                <RotateCcw size={16} aria-hidden="true" />
                Mark returned
              </button>
            </div>
          )}

          {outcomeMode && (
            <div className="consignment-outcome-form">
              <h4>Mark as {outcomeMode}</h4>
              <label><span>{outcomeMode === "sold" ? "Sale date" : "Return date"}</span><input type="date" value={outcomeDate} onChange={(event) => setOutcomeDate(event.target.value)} /></label>
              {outcomeMode === "sold" && <label><span>Sale price</span><input type="number" min="0" step="0.01" value={salePrice} onChange={(event) => setSalePrice(event.target.value)} /></label>}
              <label><span>Outcome notes</span><textarea value={outcomeNotes} onChange={(event) => setOutcomeNotes(event.target.value)} /></label>
              {outcomeMode === "sold" && <p>Ownership remains unchanged until an ownership transfer is recorded.</p>}
              <div>
                <button type="button" disabled={savingOutcome} onClick={() => handleOutcome(active)}>{savingOutcome ? "Saving…" : `Confirm ${outcomeMode}`}</button>
                <button type="button" className="secondary" disabled={savingOutcome} onClick={() => setOutcomeMode(null)}>Cancel</button>
              </div>
            </div>
          )}
        </article>
      ) : !creating ? (
        <div className="consignment-empty">
          <HandCoins size={22} strokeWidth={1.5} aria-hidden="true" />
          <p>No active consignment.</p>
        </div>
      ) : null}

      {consignments.some((item) => item.status !== "active") && (
        <div className="consignment-history">
          <h4>History</h4>
          <ul>
            {consignments.filter((item) => item.status !== "active").map((item) => (
              <li key={item.id}>
                <div>
                  <span className={`consignment-status ${item.status}`}>{statusLabel(item.status)}</span>
                  <strong>{names[item.consignee_id] ?? "Unknown consignee"}</strong>
                  <small>{formatDate(item.start_date)} - {formatDate(item.outcome_date ?? item.end_date)}</small>
                </div>
                <div>
                  {item.status === "sold" && <span>{formatMoney(item.sale_price, item.currency)}</span>}
                  {item.agreement_path && <button type="button" className="secondary" onClick={() => handleOpenAgreement(item)} disabled={openingAgreementId === item.id}><FileCheck2 size={14} aria-hidden="true" /> Agreement</button>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  );
}
