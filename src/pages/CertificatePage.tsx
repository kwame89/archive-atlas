import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  Copy,
  FileDown,
  History,
  RefreshCw,
  ShieldCheck,
  ShieldX,
} from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { AppHeader } from "../components/AppHeader";
import { CertificateDocument } from "../components/CertificateDocument";
import {
  issueAuthenticityCertificate,
  listArtworkCertificates,
  revokeAuthenticityCertificate,
} from "../lib/certificates";
import { getErrorMessage } from "../lib/errors";
import { artworkPath, recordIdFromRoute } from "../lib/recordRoutes";
import { getArtwork, getArtworkImages } from "../lib/artworks";
import { canActFor } from "../lib/profiles";
import type { Artwork, AuthenticityCertificate, Profile } from "../types/database";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function CertificatePage({ profile }: { profile: Profile }) {
  const { id: artworkRef } = useParams<{ id: string }>();
  const id = recordIdFromRoute(artworkRef);
  const location = useLocation();
  const navigate = useNavigate();
  const [artwork, setArtwork] = useState<Artwork | null>(null);
  const [certificates, setCertificates] = useState<AuthenticityCertificate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [canIssue, setCanIssue] = useState(false);
  const [hasPrimaryImage, setHasPrimaryImage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [showRevoke, setShowRevoke] = useState(false);
  const [revocationReason, setRevocationReason] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const [artworkResult, certificateResults, images] = await Promise.all([
        getArtwork(id),
        listArtworkCertificates(id),
        getArtworkImages(id),
      ]);
      setArtwork(artworkResult);
      setCertificates(certificateResults);
      setHasPrimaryImage(images.some((image) => image.is_primary) || images.length > 0);
      setSelectedId((current) =>
        current && certificateResults.some((certificate) => certificate.id === current)
          ? current
          : certificateResults[0]?.id ?? null
      );
      if (artworkResult) {
        setCanIssue(await canActFor(artworkResult.root_artist_id, profile.id));
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id, profile.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!artwork) return;
    const canonicalPath = artworkPath(artwork, "certificate");
    if (location.pathname !== canonicalPath) {
      navigate(canonicalPath, { replace: true });
    }
  }, [artwork, location.pathname, navigate]);

  const selectedCertificate = useMemo(
    () => certificates.find((certificate) => certificate.id === selectedId) ?? certificates[0] ?? null,
    [certificates, selectedId]
  );

  const activeCertificate = certificates.find((certificate) => !certificate.revoked_at) ?? null;
  const verificationUrl = selectedCertificate
    ? `${window.location.origin}/verify/${selectedCertificate.verification_code}`
    : "";

  async function handleIssue() {
    if (!id || !canIssue) return;
    if (
      activeCertificate &&
      !window.confirm(
        "Issue an updated certificate? The current certificate will remain verifiable but will be marked as superseded."
      )
    ) {
      return;
    }

    setIssuing(true);
    setError("");
    try {
      const issued = await issueAuthenticityCertificate(id);
      await load();
      setSelectedId(issued.id);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIssuing(false);
    }
  }

  async function handleRevoke() {
    if (!selectedCertificate || selectedCertificate.revoked_at) return;
    if (!revocationReason.trim()) {
      setError("Enter a reason before revoking this certificate.");
      return;
    }

    setRevoking(true);
    setError("");
    try {
      await revokeAuthenticityCertificate(selectedCertificate.id, revocationReason.trim());
      setShowRevoke(false);
      setRevocationReason("");
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setRevoking(false);
    }
  }

  async function handleCopy() {
    if (!verificationUrl) return;
    try {
      await navigator.clipboard.writeText(verificationUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError(
        "The verification link could not be copied. Open it and copy it from the address bar."
      );
    }
  }

  if (loading) return <p className="record-message muted">Loading certificate record…</p>;
  if (!artwork) return <p className="record-message muted">Artwork not found.</p>;

  return (
    <div className="page-wide coa-page">
      <div className="no-print">
        <AppHeader profile={profile} publicActions={false} />
      </div>

      <main>
        <div className="coa-toolbar no-print">
          <Link to={artworkPath(artwork)} className="record-back-link">
            <ArrowLeft size={16} aria-hidden="true" />
            Back to artwork
          </Link>
          {selectedCertificate && (
            <div className="coa-toolbar-actions">
              <button type="button" className="secondary" onClick={handleCopy}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? "Copied" : "Copy verification link"}
              </button>
              <button type="button" onClick={() => window.print()}>
                <FileDown size={16} />
                Print or save PDF
              </button>
            </div>
          )}
        </div>

        <header className="coa-page-header no-print">
          <div>
            <p className="eyebrow">Authenticity documents</p>
            <h1>{artwork.title}</h1>
            <p>
              Issue a numbered, immutable certificate from this artwork’s canonical record.
            </p>
          </div>
          {canIssue && (
            <button type="button" onClick={handleIssue} disabled={issuing}>
              <ShieldCheck size={18} />
              {issuing
                ? "Issuing…"
                : activeCertificate
                  ? "Issue updated version"
                  : "Issue certificate"}
            </button>
          )}
        </header>

        {!canIssue && (
          <p className="coa-access-message no-print">
            Only a controller of the root artist profile can issue or revoke this certificate.
          </p>
        )}
        {!hasPrimaryImage && (
          <p className="coa-access-message no-print">
            Add an artwork image before issuing if you want the work pictured on the certificate.
          </p>
        )}
        {error && <p className="error no-print">{error}</p>}

        {selectedCertificate ? (
          <div className="coa-workspace">
            <div className="coa-preview">
              <CertificateDocument
                certificate={selectedCertificate}
                verificationUrl={verificationUrl}
              />
            </div>

            <aside className="coa-history no-print">
              <div className="coa-history-heading">
                <History size={18} aria-hidden="true" />
                <div>
                  <h2>Certificate history</h2>
                  <p>Every version remains auditable.</p>
                </div>
              </div>
              <ol>
                {certificates.map((certificate) => (
                  <li key={certificate.id}>
                    <button
                      type="button"
                      className={certificate.id === selectedCertificate.id ? "active" : ""}
                      onClick={() => {
                        setSelectedId(certificate.id);
                        setShowRevoke(false);
                      }}
                    >
                      <span>Version {certificate.version}</span>
                      <strong>{certificate.certificate_number}</strong>
                      <small>{formatDate(certificate.issued_at)}</small>
                      <em className={certificate.revoked_at ? "revoked" : "active"}>
                        {certificate.revoked_at ? "Revoked" : "Active"}
                      </em>
                    </button>
                  </li>
                ))}
              </ol>

              {canIssue && !selectedCertificate.revoked_at && !showRevoke && (
                <button type="button" className="coa-revoke-trigger" onClick={() => setShowRevoke(true)}>
                  <ShieldX size={16} />
                  Revoke this certificate
                </button>
              )}
              {showRevoke && (
                <div className="coa-revoke-panel">
                  <label htmlFor="revocationReason">Reason for revocation</label>
                  <textarea
                    id="revocationReason"
                    value={revocationReason}
                    onChange={(event) => setRevocationReason(event.target.value)}
                    placeholder="For example: incorrect edition details"
                  />
                  <div>
                    <button type="button" className="danger" onClick={handleRevoke} disabled={revoking}>
                      {revoking ? "Revoking…" : "Confirm revocation"}
                    </button>
                    <button type="button" className="secondary" onClick={() => setShowRevoke(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </aside>
          </div>
        ) : (
          <section className="coa-empty no-print">
            <ShieldCheck size={30} strokeWidth={1.4} aria-hidden="true" />
            <h2>No certificate issued yet</h2>
            <p>
              Review the artwork record first. The issued certificate becomes an immutable
              snapshot and cannot be edited in place.
            </p>
            {canIssue && (
              <button type="button" onClick={handleIssue} disabled={issuing}>
                <RefreshCw size={17} />
                {issuing ? "Issuing…" : "Issue first certificate"}
              </button>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
