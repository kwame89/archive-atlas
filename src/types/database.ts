export type ProfileType = "artist" | "collective" | "gallery" | "curator" | "collector";

export type TrustTier = "unclaimed" | "claimed" | "wallet_linked" | "entity";

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
  year: number | null;
  edition_number: number | null;
  edition_total: number | null;
  root_artist_id: string;
  current_owner_id: string | null;
  current_custodian_id: string | null;
  image_url: string | null;
  created_at: string;
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
  notes: string | null;
  created_at: string;
}

