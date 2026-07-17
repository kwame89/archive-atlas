import type { AuthenticityCertificate } from "../types/database";
import { supabase } from "./supabaseClient";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function listArtworkCertificates(
  artworkId: string
): Promise<AuthenticityCertificate[]> {
  if (!UUID_PATTERN.test(artworkId)) return [];

  const { data, error } = await supabase
    .from("authenticity_certificates")
    .select("*")
    .eq("artwork_id", artworkId)
    .order("version", { ascending: false });
  if (error) throw error;
  return (data ?? []) as AuthenticityCertificate[];
}

export async function getCertificateByVerificationCode(
  verificationCode: string
): Promise<AuthenticityCertificate | null> {
  if (!UUID_PATTERN.test(verificationCode)) return null;

  const { data, error } = await supabase.rpc("get_authenticity_certificate", {
    p_verification_code: verificationCode,
  });
  if (error) throw error;
  return (Array.isArray(data) ? data[0] : data) as AuthenticityCertificate | null;
}

export async function issueAuthenticityCertificate(
  artworkId: string
): Promise<AuthenticityCertificate> {
  const { data, error } = await supabase.rpc("issue_authenticity_certificate", {
    p_artwork_id: artworkId,
  });
  if (error) throw error;
  const certificate = (Array.isArray(data) ? data[0] : data) as AuthenticityCertificate | null;
  if (!certificate) throw new Error("Certificate issuance returned no record.");
  return certificate;
}

export async function revokeAuthenticityCertificate(
  certificateId: string,
  reason: string
): Promise<AuthenticityCertificate> {
  const { data, error } = await supabase.rpc("revoke_authenticity_certificate", {
    p_certificate_id: certificateId,
    p_reason: reason,
  });
  if (error) throw error;
  const certificate = (Array.isArray(data) ? data[0] : data) as AuthenticityCertificate | null;
  if (!certificate) throw new Error("Certificate revocation returned no record.");
  return certificate;
}
