export type ProfileType =
  | "artist"
  | "collective"
  | "gallery"
  | "curator"
  | "collector"
  | "institution";

export type TrustTier = "unclaimed" | "claimed" | "wallet_linked" | "entity";

export type ConsignmentStatus = "active" | "sold" | "returned";

export type InsuranceResponsibility = "not_recorded" | "consignor" | "consignee" | "other";

export type SaleChannel = "private" | "exhibition" | "gallery" | "auction" | "other";

export type DeliveryStatus = "awaiting_delivery" | "delivered";

export type EventType =
  | "genesis"
  | "ownership_transfer"
  | "custody_change"
  | "exhibition"
  | "claim"
  | "condition_report"
  | "dispute"
  | "succession";

export interface Profile {
  id: string;
  type: ProfileType;
  secondary_roles: ProfileType[] | null;
  trust_tier: TrustTier;
  display_name: string;
  legal_name: string | null;
  linked_wallet: string | null;
  is_public: boolean;
  auth_user_id: string | null;
  created_by: string | null;
  claimed_at: string | null;
  avatar_url: string | null;
  bio: string | null;
  website_url: string | null;
  cv_url: string | null;
  headline: string | null;
  location: string | null;
  specialties: string[];
  public_email: string | null;
  created_at: string;
}

export interface ProfileController {
  profile_id: string;
  controller_profile_id: string;
  added_at: string;
}

export interface ProfileFollow {
  follower_profile_id: string;
  followed_profile_id: string;
  created_at: string;
}

export interface Artwork {
  id: string;
  title: string;
  medium: string | null;
  dimensions: string | null;
  height: number | null;
  width: number | null;
  depth: number | null;
  year: number | null;
  is_circa: boolean;
  date_display_override: string | null;
  edition_number: number | null;
  edition_total: number | null;
  classification: string | null;
  sold_at: string | null;
  description: string | null;
  tags: string[] | null;
  subject_matter: string | null;
  art_type: string | null;
  is_signed: boolean;
  signature_notes: string | null;
  condition: string | null;
  royalty_percentage: number | null;
  artwork_value: number | null;
  value_currency: string;
  root_artist_id: string;
  current_owner_id: string | null;
  current_custodian_id: string | null;
  created_at: string;
}

export interface ArtworkCollaborator {
  artwork_id: string;
  profile_id: string;
  role: string | null;
  added_at: string;
}

export interface ArtworkPrivateNotes {
  artwork_id: string;
  notes: string;
  updated_at: string;
}

export interface ArtworkImage {
  id: string;
  artwork_id: string;
  url: string;
  is_primary: boolean;
  image_kind: "record" | "installation";
  caption: string | null;
  created_at: string;
}

export interface AuthenticityCertificateSnapshot {
  schema_version: number;
  artwork_id: string;
  title: string;
  artist_profile_id: string;
  artist_name: string;
  artist_trust_tier: TrustTier;
  artist_linked_wallet: string | null;
  issued_by_name: string;
  medium: string | null;
  dimensions: string | null;
  height: number | null;
  width: number | null;
  depth: number | null;
  year: number | null;
  is_circa: boolean;
  date_display_override: string | null;
  edition_number: number | null;
  edition_total: number | null;
  classification: string | null;
  is_signed: boolean;
  signature_notes: string | null;
  primary_image_url: string | null;
  primary_image_storage_path: string | null;
}

export interface AuthenticityCertificate {
  id: string;
  artwork_id: string;
  root_artist_id: string;
  issued_by: string;
  certificate_number: string;
  verification_code: string;
  version: number;
  artwork_snapshot: AuthenticityCertificateSnapshot;
  certificate_hash: string;
  issued_at: string;
  revoked_at: string | null;
  revoked_by: string | null;
  revocation_reason: string | null;
  created_at: string;
}

export interface Collection {
  id: string;
  artist_id: string;
  title: string;
  description: string | null;
  start_year: number | null;
  end_year: number | null;
  cover_artwork_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CollectionArtwork {
  collection_id: string;
  artwork_id: string;
  sort_order: number;
  added_at: string;
}

export interface Consignment {
  id: string;
  artwork_id: string;
  consignor_id: string;
  consignee_id: string;
  actor_id: string;
  status: ConsignmentStatus;
  asking_price: number | null;
  currency: string;
  commission_percentage: number | null;
  start_date: string;
  end_date: string | null;
  insurance_responsibility: InsuranceResponsibility;
  insurance_value: number | null;
  insurance_currency: string;
  insurance_notes: string | null;
  agreement_path: string | null;
  agreement_file_name: string | null;
  notes: string | null;
  outcome_date: string | null;
  sale_price: number | null;
  outcome_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ArtworkSale {
  id: string;
  artwork_id: string;
  ownership_event_id: string;
  transaction_group_id: string;
  seller_id: string;
  buyer_id: string;
  actor_id: string;
  consignment_id: string | null;
  sale_channel: SaleChannel;
  seller_type: ProfileType;
  sale_price: number | null;
  currency: string;
  share_sale_price: boolean;
  share_buyer_identity: boolean;
  sale_date: string;
  private_notes: string | null;
  delivery_status: DeliveryStatus;
  delivered_at: string | null;
  delivery_confirmed_by: string | null;
  delivery_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ArtworkEvent {
  id: string;
  type: EventType;
  actor_id: string;
  artwork_id: string | null;
  target_profile_id: string | null;
  from_party_id: string | null;
  to_party_id: string | null;
  disputed_event_id: string | null;
  transaction_group_id: string | null;
  occurred_at: string;
  on_chain_anchor_hash: string | null;
  /** Which Stellar network the anchor lives on ("testnet" | "mainnet");
   * null on pre-migration rows, which are all testnet. */
  anchor_network: string | null;
  price: number | null;
  currency: string | null;
  sale_channel: SaleChannel | null;
  seller_type: ProfileType | null;
  buyer_identity_public: boolean;
  buyer_display_name_public: string | null;
  notes: string | null;
  exhibition_title: string | null;
  exhibition_venue: string | null;
  exhibition_location: string | null;
  exhibition_end_date: string | null;
  corroborated_by: string | null;
  corroborated_at: string | null;
  condition_rating: string | null;
  wallet_signed: boolean;
  updated_at: string;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
  created_at: string;
}
