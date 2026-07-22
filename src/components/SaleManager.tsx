import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, HandCoins, PackageCheck, ShieldCheck } from "lucide-react";
import { getProfileNames } from "../lib/artworks";
import { getErrorMessage } from "../lib/errors";
import {
  confirmArtworkSaleDelivery,
  getArtworkSales,
  recordArtworkSale,
} from "../lib/sales";
import type { Artwork, ArtworkSale, Profile, SaleChannel } from "../types/database";
import { ProfileSearchAdd } from "./ProfileSearchAdd";

const CURRENCIES = ["USD", "EUR", "GBP", "JMD"];

const CHANNEL_LABELS: Record<SaleChannel, string> = {
  private: "Private sale",
  exhibition: "Exhibition",
  gallery: "Gallery",
  auction: "Auction",
  other: "Other",
};

function optionalNumber(value: string): number | null {
  return value.trim() ? Number(value) : null;
}

function formatMoney(value: number | null, currency: string): string {
  if (value == null) return "Not recorded";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface SaleManagerProps {
  artwork: Artwork;
  actorProfileId: string;
  controlsOwner: boolean;
  controlsCustodian: boolean;
  onComplete: () => void;
}

export function SaleManager({
  artwork,
  actorProfileId,
  controlsOwner,
  controlsCustodian,
  onComplete,
}: SaleManagerProps) {
  const [sales, setSales] = useState<ArtworkSale[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [buyer, setBuyer] = useState<Profile | null>(null);
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saleChannel, setSaleChannel] = useState<SaleChannel>("private");
  const [salePrice, setSalePrice] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [privateNotes, setPrivateNotes] = useState("");
  const [shareBuyerIdentity, setShareBuyerIdentity] = useState(false);
  const [shareSalePrice, setShareSalePrice] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deliverySaleId, setDeliverySaleId] = useState<string | null>(null);
  const [deliveryDate, setDeliveryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [confirmingDelivery, setConfirmingDelivery] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    const next = await getArtworkSales(artwork.id);
    setSales(next);
    setNames(
      await getProfileNames(
        next.flatMap((sale) => [sale.seller_id, sale.buyer_id, sale.actor_id])
      )
    );
  }, [artwork.id]);

  useEffect(() => {
    setLoading(true);
    reload()
      .catch((loadError) => setError(getErrorMessage(loadError)))
      .finally(() => setLoading(false));
  }, [reload]);

  async function handleRecordSale() {
    if (!buyer) {
      setError("Select the buyer before completing the sale.");
      return;
    }
    const numericPrice = optionalNumber(salePrice);
    if (numericPrice != null && numericPrice < 0) {
      setError("Sale price cannot be negative.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await recordArtworkSale({
        artworkId: artwork.id,
        actorId: actorProfileId,
        buyerId: buyer.id,
        saleDate,
        saleChannel,
        salePrice: numericPrice,
        currency,
        privateNotes: privateNotes.trim() || null,
        shareBuyerIdentity,
        shareSalePrice,
      });
      setShowForm(false);
      setBuyer(null);
      setSalePrice("");
      setPrivateNotes("");
      setShareBuyerIdentity(false);
      setShareSalePrice(false);
      await reload();
      onComplete();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmDelivery(sale: ArtworkSale) {
    setConfirmingDelivery(true);
    setError("");
    try {
      await confirmArtworkSaleDelivery(
        sale.id,
        actorProfileId,
        deliveryDate,
        deliveryNotes.trim() || null
      );
      setDeliverySaleId(null);
      setDeliveryNotes("");
      await reload();
      onComplete();
    } catch (deliveryError) {
      setError(getErrorMessage(deliveryError));
    } finally {
      setConfirmingDelivery(false);
    }
  }

  if (loading) return <p className="muted">Loading sale records…</p>;

  return (
    <div className="sale-manager">
      <div className="sale-manager-heading">
        <div>
          <h3>Sales &amp; delivery</h3>
          <p>Commercial terms stay private. Provenance records only the facts you choose to share.</p>
        </div>
        {controlsOwner && !showForm && (
          <button type="button" onClick={() => setShowForm(true)}>
            <HandCoins size={16} aria-hidden="true" />
            Log private sale
          </button>
        )}
      </div>

      {showForm && (
        <div className="sale-form">
          <section>
            <h4>Buyer</h4>
            {buyer ? (
              <div className="consignment-selected-party">
                <span>{buyer.display_name} ({buyer.type})</span>
                <button type="button" className="secondary" onClick={() => setBuyer(null)}>
                  Change
                </button>
              </div>
            ) : (
              <ProfileSearchAdd
                excludeIds={[artwork.current_owner_id].filter(Boolean) as string[]}
                onAdd={setBuyer}
                placeholder="Search for the collector or buyer…"
              />
            )}
          </section>

          <section className="sale-form-grid">
            <label>
              <span>Sale date</span>
              <input type="date" value={saleDate} onChange={(event) => setSaleDate(event.target.value)} />
            </label>
            <label>
              <span>Channel</span>
              <select value={saleChannel} onChange={(event) => setSaleChannel(event.target.value as SaleChannel)}>
                {Object.entries(CHANNEL_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Sale price</span>
              <input type="number" min="0" step="0.01" value={salePrice} onChange={(event) => setSalePrice(event.target.value)} />
            </label>
            <label>
              <span>Currency</span>
              <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
                {CURRENCIES.map((code) => <option key={code} value={code}>{code}</option>)}
              </select>
            </label>
          </section>

          <label className="sale-notes-field">
            <span>Private sale notes</span>
            <textarea value={privateNotes} onChange={(event) => setPrivateNotes(event.target.value)} />
          </label>

          <div className="sale-privacy-options">
            <label>
              <input type="checkbox" checked={shareBuyerIdentity} onChange={(event) => setShareBuyerIdentity(event.target.checked)} />
              Show the buyer name in public provenance
            </label>
            <label>
              <input type="checkbox" checked={shareSalePrice} onChange={(event) => setShareSalePrice(event.target.checked)} />
              Show the sale price in public provenance
            </label>
          </div>

          <p className="sale-custody-note">
            Ownership transfers when this sale is completed. Custody remains with the current holder until delivery is confirmed.
          </p>
          <div className="sale-form-actions">
            <button type="button" disabled={saving || !buyer} onClick={handleRecordSale}>
              {saving ? "Recording…" : "Complete sale & transfer ownership"}
            </button>
            <button type="button" className="secondary" disabled={saving} onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {sales.length === 0 ? (
        !showForm && <p className="muted">No sales recorded for this artwork.</p>
      ) : (
        <ul className="sale-history">
          {sales.map((sale) => (
            <li key={sale.id}>
              <div className="sale-history-summary">
                <span className={`delivery-status ${sale.delivery_status}`}>
                  {sale.delivery_status === "delivered" ? <CheckCircle2 size={14} /> : <PackageCheck size={14} />}
                  {sale.delivery_status === "delivered" ? "Delivered" : "Awaiting delivery"}
                </span>
                <strong>{CHANNEL_LABELS[sale.sale_channel]}</strong>
                <span>{formatDate(sale.sale_date)}</span>
                <span>{names[sale.seller_id] ?? "Private seller"} to {names[sale.buyer_id] ?? "Private buyer"}</span>
                <span>{formatMoney(sale.sale_price, sale.currency)} · private</span>
              </div>

              {sale.delivery_status === "awaiting_delivery" && (controlsOwner || controlsCustodian) && (
                deliverySaleId === sale.id ? (
                  <div className="delivery-form">
                    <label><span>Delivery date</span><input type="date" value={deliveryDate} onChange={(event) => setDeliveryDate(event.target.value)} /></label>
                    <label><span>Private delivery notes</span><textarea value={deliveryNotes} onChange={(event) => setDeliveryNotes(event.target.value)} /></label>
                    <div>
                      <button type="button" disabled={confirmingDelivery} onClick={() => handleConfirmDelivery(sale)}>
                        {confirmingDelivery ? "Confirming…" : "Confirm delivery & transfer custody"}
                      </button>
                      <button type="button" className="secondary" disabled={confirmingDelivery} onClick={() => setDeliverySaleId(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className="secondary confirm-delivery-button" onClick={() => setDeliverySaleId(sale.id)}>
                    <PackageCheck size={15} aria-hidden="true" />
                    Confirm delivery
                  </button>
                )
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="sale-privacy-reminder">
        <ShieldCheck size={16} aria-hidden="true" />
        <span>Buyer identity, price, notes, and delivery details are restricted to authorized parties.</span>
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
