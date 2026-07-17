import { useEffect, useState } from "react";
import archiveAtlasMark from "../assets/archive-atlas-mark.png";
import type {
  AuthenticityCertificate,
  AuthenticityCertificateSnapshot,
} from "../types/database";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

function formatDimensions(snapshot: AuthenticityCertificateSnapshot): string | null {
  if (snapshot.height != null && snapshot.width != null) {
    return `${snapshot.height} x ${snapshot.width}${snapshot.depth != null ? ` x ${snapshot.depth}` : ""} in`;
  }
  return snapshot.dimensions;
}

function formatArtworkDate(snapshot: AuthenticityCertificateSnapshot): string | null {
  if (snapshot.date_display_override) return snapshot.date_display_override;
  if (snapshot.year == null) return null;
  return `${snapshot.is_circa ? "circa " : ""}${snapshot.year}`;
}

function compactWallet(wallet: string): string {
  if (wallet.length <= 18) return wallet;
  return `${wallet.slice(0, 9)}…${wallet.slice(-7)}`;
}

function formatTrustTier(value: string): string {
  return value.replaceAll("_", " ");
}

export function CertificateDocument({
  certificate,
  verificationUrl,
}: {
  certificate: AuthenticityCertificate;
  verificationUrl: string;
}) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const snapshot = certificate.artwork_snapshot;
  const dimensions = formatDimensions(snapshot);
  const artworkDate = formatArtworkDate(snapshot);
  const edition =
    snapshot.edition_number != null && snapshot.edition_total != null
      ? `${snapshot.edition_number} of ${snapshot.edition_total}`
      : null;

  useEffect(() => {
    let cancelled = false;
    import("qrcode")
      .then(({ default: QRCode }) =>
        QRCode.toDataURL(verificationUrl, {
          errorCorrectionLevel: "M",
          margin: 1,
          width: 220,
          color: { dark: "#090a08", light: "#ffffff" },
        })
      )
      .then((value) => {
        if (!cancelled) setQrDataUrl(value);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl("");
      });
    return () => {
      cancelled = true;
    };
  }, [verificationUrl]);

  return (
    <article className={`coa-document${certificate.revoked_at ? " revoked" : ""}`}>
      <div className="coa-document-rule" />
      <header className="coa-document-header">
        <div className="coa-document-brand">
          <img src={archiveAtlasMark} alt="" />
          <div>
            <strong>Archive Atlas</strong>
            <span>Preserve. Prove. Perpetuate.</span>
          </div>
        </div>
        <div className="coa-document-number">
          <span>Certificate no.</span>
          <strong>{certificate.certificate_number}</strong>
          <small>Version {certificate.version}</small>
        </div>
      </header>

      {certificate.revoked_at && (
        <div className="coa-revoked-banner">
          Revoked {formatDate(certificate.revoked_at)}
          {certificate.revocation_reason ? ` — ${certificate.revocation_reason}` : ""}
        </div>
      )}

      <div className="coa-document-title">
        <p>Certificate of Authenticity</p>
        <h1>{snapshot.title}</h1>
        <h2>{snapshot.artist_name}</h2>
      </div>

      <div className="coa-document-body">
        <div className="coa-artwork-panel">
          {snapshot.primary_image_url ? (
            <img src={snapshot.primary_image_url} alt={snapshot.title} />
          ) : (
            <div className="coa-image-placeholder">Image not included in this version</div>
          )}
        </div>

        <div className="coa-object-record">
          <p className="coa-statement">
            This document certifies that the work described here is an authentic work by the
            named artist and matches the immutable Archive Atlas record identified below.
          </p>
          <dl>
            <div><dt>Artist</dt><dd>{snapshot.artist_name}</dd></div>
            <div><dt>Title</dt><dd>{snapshot.title}</dd></div>
            {artworkDate && <div><dt>Date</dt><dd>{artworkDate}</dd></div>}
            {snapshot.medium && <div><dt>Medium</dt><dd>{snapshot.medium}</dd></div>}
            {dimensions && <div><dt>Dimensions</dt><dd>{dimensions}</dd></div>}
            {edition && <div><dt>Edition</dt><dd>{edition}</dd></div>}
            <div>
              <dt>Artwork signature</dt>
              <dd>
                {snapshot.is_signed
                  ? `Signed${snapshot.signature_notes ? ` — ${snapshot.signature_notes}` : ""}`
                  : "Not recorded as signed"}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="coa-assurance-grid">
        <section>
          <p className="coa-label">Issued by</p>
          <strong>{snapshot.issued_by_name}</strong>
          <span>{formatDate(certificate.issued_at)}</span>
          <span>Artist identity: {formatTrustTier(snapshot.artist_trust_tier)}</span>
          <span className="coa-signature-line">Digitally issued from a controlled artist profile</span>
          {snapshot.artist_linked_wallet && (
            <span>Linked wallet: {compactWallet(snapshot.artist_linked_wallet)}</span>
          )}
        </section>
        <section className="coa-verification-block">
          {qrDataUrl ? <img src={qrDataUrl} alt="QR code to verify this certificate" /> : null}
          <div>
            <p className="coa-label">Verify this certificate</p>
            <strong>{certificate.verification_code}</strong>
            <span>{verificationUrl}</span>
          </div>
        </section>
      </div>

      <footer className="coa-document-footer">
        <div>
          <span>SHA-256 record fingerprint</span>
          <code>{certificate.certificate_hash}</code>
        </div>
        <p>
          This certificate verifies the artwork record at the time of issue. It is not proof of
          ownership, legal title, market value, or appraisal.
        </p>
      </footer>
    </article>
  );
}
