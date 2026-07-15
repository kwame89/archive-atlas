import { changeCustody } from "./artworks";
import { supabase } from "./supabaseClient";
import type {
  Artwork,
  Consignment,
  ConsignmentStatus,
  InsuranceResponsibility,
} from "../types/database";

export interface ConsignmentTermsInput {
  consigneeId: string;
  askingPrice: number | null;
  currency: string;
  commissionPercentage: number | null;
  startDate: string;
  endDate: string | null;
  insuranceResponsibility: InsuranceResponsibility;
  insuranceValue: number | null;
  insuranceCurrency: string;
  insuranceNotes: string | null;
  notes: string | null;
}

export interface ConsignmentOutcomeInput {
  status: Exclude<ConsignmentStatus, "active">;
  outcomeDate: string;
  salePrice: number | null;
  outcomeNotes: string | null;
}

export async function getArtworkConsignments(artworkId: string): Promise<Consignment[]> {
  const { data, error } = await supabase
    .from("consignments")
    .select("*")
    .eq("artwork_id", artworkId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createConsignment(
  artwork: Artwork,
  actorProfileId: string,
  input: ConsignmentTermsInput
): Promise<Consignment> {
  if (!artwork.current_owner_id) throw new Error("Record an owner before creating a consignment.");

  const { data: consignment, error: insertError } = await supabase
    .from("consignments")
    .insert({
      artwork_id: artwork.id,
      consignor_id: artwork.current_owner_id,
      consignee_id: input.consigneeId,
      actor_id: actorProfileId,
      asking_price: input.askingPrice,
      currency: input.currency,
      commission_percentage: input.commissionPercentage,
      start_date: input.startDate,
      end_date: input.endDate,
      insurance_responsibility: input.insuranceResponsibility,
      insurance_value: input.insuranceValue,
      insurance_currency: input.insuranceCurrency,
      insurance_notes: input.insuranceNotes,
      notes: input.notes,
    })
    .select()
    .single();
  if (insertError) throw insertError;

  if (artwork.current_custodian_id !== input.consigneeId) {
    try {
      await changeCustody(artwork, actorProfileId, {
        toPartyId: input.consigneeId,
        notes: "Custody transferred under an active consignment agreement.",
      });
    } catch (error) {
      await supabase.from("consignments").delete().eq("id", consignment.id);
      throw error;
    }
  }

  return consignment;
}

export async function updateConsignmentTerms(
  consignmentId: string,
  input: ConsignmentTermsInput
): Promise<Consignment> {
  const { data, error } = await supabase
    .from("consignments")
    .update({
      asking_price: input.askingPrice,
      currency: input.currency,
      commission_percentage: input.commissionPercentage,
      start_date: input.startDate,
      end_date: input.endDate,
      insurance_responsibility: input.insuranceResponsibility,
      insurance_value: input.insuranceValue,
      insurance_currency: input.insuranceCurrency,
      insurance_notes: input.insuranceNotes,
      notes: input.notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", consignmentId)
    .eq("status", "active")
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function completeConsignment(
  artwork: Artwork,
  consignment: Consignment,
  actorProfileId: string,
  input: ConsignmentOutcomeInput
): Promise<void> {
  if (input.status === "returned" && artwork.current_custodian_id === consignment.consignee_id) {
    await changeCustody(artwork, actorProfileId, {
      toPartyId: consignment.consignor_id,
      notes: "Artwork returned at the close of its consignment term.",
    });
  }

  const { error } = await supabase
    .from("consignments")
    .update({
      status: input.status,
      outcome_date: input.outcomeDate,
      sale_price: input.status === "sold" ? input.salePrice : null,
      outcome_notes: input.outcomeNotes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", consignment.id)
    .eq("status", "active");
  if (error) throw error;
}

export async function uploadConsignmentAgreement(
  consignment: Consignment,
  file: File
): Promise<Consignment> {
  const path = `${consignment.id}/${crypto.randomUUID()}-${file.name}`;
  const bucket = supabase.storage.from("consignment-agreements");
  const { error: uploadError } = await bucket.upload(path, file);
  if (uploadError) throw uploadError;

  const { data: updated, error: updateError } = await supabase
    .from("consignments")
    .update({
      agreement_path: path,
      agreement_file_name: file.name,
      updated_at: new Date().toISOString(),
    })
    .eq("id", consignment.id)
    .select()
    .single();

  if (updateError) {
    await bucket.remove([path]).catch(() => undefined);
    throw updateError;
  }

  if (consignment.agreement_path) {
    await bucket.remove([consignment.agreement_path]).catch(() => undefined);
  }
  return updated;
}

export async function getConsignmentAgreementUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("consignment-agreements")
    .createSignedUrl(path, 60);
  if (error) throw error;
  return data.signedUrl;
}
