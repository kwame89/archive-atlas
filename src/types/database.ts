export type ProfileType = "artist" | "collective" | "gallery" | "curator" | "collector";

export type TrustTier = "unclaimed" | "claimed" | "wallet_linked" | "entity";

export type ConsignmentStatus = "active" | "sold" | "returned";

export type InsuranceResponsibility = "not_recorded" | "consignor" | "consignee" | "other";

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
  created_at: string;
}

export interface ProfileController {
  profile_id: string;
  controller_profile_id: string;
  added_at: string;
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
  description: string | null;
  tags: string[] | null;
  subject_matter: string | null;
  art_type: string | null;
  is_signed: boolean;
  signature_notes: string | null;
  condition: string | null;
  royalty_percentage: number | null;
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
  price: number | null;
  currency: string | null;
  notes: string | null;
  exhibition_title: string | null;
  exhibition_venue: string | null;
  exhibition_location: string | null;
  exhibition_end_date: string | null;
  corroborated_by: string | null;
  corroborated_at: string | null;
  condition_rating: string | null;
  wallet_signed: boolean;
  created_at: string;
}
