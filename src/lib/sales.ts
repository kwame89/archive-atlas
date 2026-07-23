import { anchorEvent } from "./artworks";
import { supabase } from "./supabaseClient";
import type { ProfileType } from "../types/database";
import type { ArtworkSale, SaleChannel } from "../types/database";

export interface RecordSaleInput {
  artworkId: string;
  actorId: string;
  buyerId: string;
  saleDate: string;
  saleChannel: SaleChannel;
  salePrice: number | null;
  currency: string;
  privateNotes: string | null;
  consignmentId?: string | null;
  shareBuyerIdentity: boolean;
  shareSalePrice: boolean;
  /** Capacity the seller acted in. Omit to use their primary profile type;
   * only meaningful for profiles holding secondary roles (0032/0033). */
  sellerRole?: ProfileType | null;
}

interface RecordSaleResult {
  sale_id: string;
  ownership_event_id: string;
  artwork_id: string;
  delivery_status: "awaiting_delivery";
}

interface ConfirmDeliveryResult {
  sale_id: string;
  custody_event_id: string | null;
  delivery_status: "delivered";
}

export async function getArtworkSales(artworkId: string): Promise<ArtworkSale[]> {
  const { data, error } = await supabase
    .from("artwork_sales")
    .select("*")
    .eq("artwork_id", artworkId)
    .order("sale_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function recordArtworkSale(input: RecordSaleInput): Promise<RecordSaleResult> {
  const { data, error } = await supabase.rpc("record_artwork_sale", {
    p_artwork_id: input.artworkId,
    p_actor_id: input.actorId,
    p_buyer_id: input.buyerId,
    p_sale_date: new Date(`${input.saleDate}T12:00:00`).toISOString(),
    p_sale_channel: input.saleChannel,
    p_sale_price: input.salePrice,
    p_currency: input.currency,
    p_private_notes: input.privateNotes,
    p_consignment_id: input.consignmentId ?? null,
    p_share_buyer_identity: input.shareBuyerIdentity,
    p_share_sale_price: input.shareSalePrice,
    p_seller_role: input.sellerRole ?? null,
  });
  if (error) throw error;

  const result = data as RecordSaleResult;
  anchorEvent(result.ownership_event_id);
  return result;
}

export async function confirmArtworkSaleDelivery(
  saleId: string,
  actorId: string,
  deliveredAt: string,
  deliveryNotes: string | null
): Promise<ConfirmDeliveryResult> {
  const { data, error } = await supabase.rpc("confirm_artwork_sale_delivery", {
    p_sale_id: saleId,
    p_actor_id: actorId,
    p_delivered_at: new Date(`${deliveredAt}T12:00:00`).toISOString(),
    p_delivery_notes: deliveryNotes,
  });
  if (error) throw error;

  const result = data as ConfirmDeliveryResult;
  if (result.custody_event_id) anchorEvent(result.custody_event_id);
  return result;
}
