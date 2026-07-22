import { useEffect, useState } from "react";
import { ArrowLeft, FileDown, ShieldCheck, ShieldX } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { AppHeader } from "../components/AppHeader";
import { CertificateDocument } from "../components/CertificateDocument";
import { getCertificateByVerificationCode } from "../lib/certificates";
import { getErrorMessage } from "../lib/errors";
import { artworkPathFromParts } from "../lib/recordRoutes";
import type { AuthenticityCertificate } from "../types/database";

export function CertificateVerificationPage() {
  const { code } = useParams<{ code: string }>();
  const [certificate, setCertificate] = useState<AuthenticityCertificate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!code) return;
    setLoading(true);
    getCertificateByVerificationCode(code)
      .then(setCertificate)
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [code]);

  if (loading) return <p className="record-message muted">Verifying certificate…</p>;
  if (error) return <p className="record-message error">{error}</p>;
  if (!certificate) {
    return (
      <div className="page-wide coa-page">
        <AppHeader publicActions={false} />
        <main className="coa-verification-missing">
          <ShieldX size={32} />
          <h1>Certificate not found</h1>
          <p>This verification code does not match an Archive Atlas certificate.</p>
          <Link to="/">Return to Archive Atlas</Link>
        </main>
      </div>
    );
  }

  const verificationUrl = `${window.location.origin}/verify/${certificate.verification_code}`;

  return (
    <div className="page-wide coa-page">
      <div className="no-print">
        <AppHeader publicActions={false} />
      </div>
      <main>
        <div className="coa-toolbar no-print">
          <Link
            to={artworkPathFromParts(
              certificate.artwork_id,
              certificate.artwork_snapshot.title
            )}
            className="record-back-link"
          >
            <ArrowLeft size={16} />
            View artwork record
          </Link>
          <button type="button" onClick={() => window.print()}>
            <FileDown size={16} />
            Print or save PDF
          </button>
        </div>

        <div
          className={`coa-verification-status no-print${certificate.revoked_at ? " revoked" : ""}`}
        >
          {certificate.revoked_at ? <ShieldX size={22} /> : <ShieldCheck size={22} />}
          <div>
            <strong>{certificate.revoked_at ? "Certificate revoked" : "Certificate verified"}</strong>
            <p>
              {certificate.revoked_at
                ? certificate.revocation_reason ?? "This certificate is no longer active."
                : "This certificate matches an immutable record issued by Archive Atlas."}
            </p>
          </div>
        </div>

        <div className="coa-public-preview">
          <CertificateDocument certificate={certificate} verificationUrl={verificationUrl} />
        </div>
      </main>
    </div>
  );
}
