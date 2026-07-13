import { supabase } from "./supabaseClient";
import type { Artwork, ArtworkEvent, ArtworkImage, Profile } from "../types/database";

export interface CreateArtworkInput {
  title: string;
  medium?: string;
  dimensions?: string;
  height?: number;
  width?: number;
  depth?: number;
  year?: number;
  isCirca?: boolean;
  dateDisplayOverride?: string;
  editionNumber?: number;
  editionTotal?: number;
  description?: string;
  tags?: string[];
  subjectMatter?: string;
  artType?: string;
  isSigned?: boolean;
  signatureNotes?: string;
  condition?: string;
  /** When the work was actually created, if different from today (e.g.
   * archiving an older piece) — becomes the genesis event's occurred_at. */
  dateCreated?: string;
  /** Co-creators beyond the root artist, for collaborative pieces. */
  collaboratorIds?: string[];
}

/**
 * Logs the genesis event for a new artwork: rootArtistId is credited as
 * creator/initial owner/custodian. actorId (who is actually performing this
 * action) defaults to rootArtistId — the normal self-creation case — but
 * differs when a collective logs historical work on behalf of an unclaimed
 * artist profile it created, matching the actor/party split used elsewhere
 * (see transferOwnership). Two sequential requests, same non-atomicity note
 * as profiles.ts — a dropped connection between them leaves an artwork with
 * no genesis event logged, which is visible (empty provenance) rather than
 * silently wrong, and safe to retry by re-inserting the event.
 */
export async function createArtwork(
  rootArtistId: string,
  input: CreateArtworkInput,
  actorId: string = rootArtistId
): Promise<Artwork> {
  const { data: artwork, error: insertError } = await supabase
    .from("artworks")
    .insert({
      title: input.title,
      medium: input.medium || null,
      dimensions: input.dimensions || null,
      height: input.height ?? null,
      width: input.width ?? null,
      depth: input.depth ?? null,
      year: input.year ?? null,
      is_circa: input.isCirca ?? false,
      date_display_override: input.dateDisplayOverride || null,
      edition_number: input.editionNumber ?? null,
      edition_total: input.editionTotal ?? null,
      description: input.description || null,
      tags: input.tags && input.tags.length > 0 ? input.tags : null,
      subject_matter: input.subjectMatter || null,
      art_type: input.artType || null,
      is_signed: input.isSigned ?? false,
      signature_notes: input.signatureNotes || null,
      condition: input.condition || null,
      root_artist_id: rootArtistId,
      current_owner_id: rootArtistId,
      current_custodian_id: rootArtistId,
    })
    .select()
    .single();

  if (insertError) throw insertError;

  const { error: eventError } = await supabase.from("events").insert({
    type: "genesis",
    actor_id: actorId,
    artwork_id: artwork.id,
    to_party_id: rootArtistId,
    occurred_at: input.dateCreated
      ? new Date(input.dateCreated).toISOString()
      : new Date().toISOString(),
  });

  if (eventError) throw eventError;

  if (input.collaboratorIds && input.collaboratorIds.length > 0) {
    await addCollaborators(artwork.id, input.collaboratorIds);
  }

  return artwork;
}

export async function getArtworkCollaborators(artworkId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("artwork_collaborators")
    .select("profile_id, profiles(*)")
    .eq("artwork_id", artworkId);
  if (error) throw error;
  return (data ?? []).map((row) => (row as unknown as { profiles: Profile }).profiles);
}

export async function addCollaborators(artworkId: string, profileIds: string[]): Promise<void> {
  const { error } = await supabase
    .from("artwork_collaborators")
    .insert(profileIds.map((profile_id) => ({ artwork_id: artworkId, profile_id })));
  if (error) throw error;
}

export async function removeCollaborator(artworkId: string, profileId: string): Promise<void> {
  const { error } = await supabase
    .from("artwork_collaborators")
    .delete()
    .eq("artwork_id", artworkId)
    .eq("profile_id", profileId);
  if (error) throw error;
}

/**
 * Corrects a genesis event's recorded creation date. Treated as a metadata
 * fix rather than a provenance-changing edit — it doesn't touch who created
 * the work or that they did, only when.
 */
export async function updateGenesisDate(eventId: string, dateCreated: string): Promise<void> {
  const { error } = await supabase
    .from("events")
    .update({ occurred_at: new Date(dateCreated).toISOString() })
    .eq("id", eventId)
    .eq("type", "genesis");
  if (error) throw error;
}

export interface TransferOwnershipInput {
  toPartyId: string;
  price?: number;
  currency?: string;
  notes?: string;
  /** The common direct-sale case: custody moves with ownership. Left off
   * for the consignment-agent case, where the seller keeps custody of
   * other consigned pieces but this one's title changes hands. */
  alsoTransferCustody?: boolean;
}

/**
 * Logs an ownership_transfer (sale/gift/inheritance), optionally paired with
 * a custody_change sharing a transaction_group_id — see SCOPE.md's
 * consignment-sale worked example for why these are sometimes two events,
 * not one. `actorId` may be the current owner (selling directly) or the
 * current custodian acting as an agent (e.g. a consignment gallery) — this
 * matches the RLS policy, which only checks that actorId is controlled by
 * the caller, not that they're specifically the owner.
 */
export async function transferOwnership(
  artwork: Artwork,
  actorId: string,
  input: TransferOwnershipInput
): Promise<void> {
  const transactionGroupId = input.alsoTransferCustody ? crypto.randomUUID() : null;

  const { error: transferError } = await supabase.from("events").insert({
    type: "ownership_transfer",
    actor_id: actorId,
    artwork_id: artwork.id,
    from_party_id: artwork.current_owner_id,
    to_party_id: input.toPartyId,
    price: input.price ?? null,
    currency: input.currency || "USD",
    notes: input.notes || null,
    transaction_group_id: transactionGroupId,
  });
  if (transferError) throw transferError;

  const artworkUpdates: Partial<Artwork> = { current_owner_id: input.toPartyId };

  if (input.alsoTransferCustody) {
    const { error: custodyError } = await supabase.from("events").insert({
      type: "custody_change",
      actor_id: actorId,
      artwork_id: artwork.id,
      from_party_id: artwork.current_custodian_id,
      to_party_id: input.toPartyId,
      transaction_group_id: transactionGroupId,
    });
    if (custodyError) throw custodyError;
    artworkUpdates.current_custodian_id = input.toPartyId;
  }

  const { error: updateError } = await supabase
    .from("artworks")
    .update(artworkUpdates)
    .eq("id", artwork.id);
  if (updateError) throw updateError;
}

export interface ChangeCustodyInput {
  toPartyId: string;
  notes?: string;
}

/** Logs a custody_change (loan/consignment) — ownership is untouched. */
export async function changeCustody(
  artwork: Artwork,
  actorId: string,
  input: ChangeCustodyInput
): Promise<void> {
  const { error: eventError } = await supabase.from("events").insert({
    type: "custody_change",
    actor_id: actorId,
    artwork_id: artwork.id,
    from_party_id: artwork.current_custodian_id,
    to_party_id: input.toPartyId,
    notes: input.notes || null,
  });
  if (eventError) throw eventError;

  const { error: updateError } = await supabase
    .from("artworks")
    .update({ current_custodian_id: input.toPartyId })
    .eq("id", artwork.id);
  if (updateError) throw updateError;
}

export async function getArtworkImages(artworkId: string): Promise<ArtworkImage[]> {
  const { data, error } = await supabase
    .from("artwork_images")
    .select("*")
    .eq("artwork_id", artworkId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/**
 * Uploads one or more images for an artwork. If the artwork has no primary
 * image yet, `primaryIndex` (into `files`) becomes primary — defaulting to
 * the first file if not given. If the artwork already has a primary image,
 * none of the newly uploaded files are marked primary; use setPrimaryImage
 * to change it. Uploads happen sequentially (not in parallel) specifically
 * so the "is there already a primary" check stays correct across the batch.
 */
export async function uploadArtworkImages(
  artworkId: string,
  files: File[],
  primaryIndex = 0
): Promise<ArtworkImage[]> {
  const existing = await getArtworkImages(artworkId);
  let hasPrimary = existing.some((img) => img.is_primary);

  const uploaded: ArtworkImage[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const path = `${artworkId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("artwork-images").upload(path, file);
    if (uploadError) throw uploadError;

    const {
      data: { publicUrl },
    } = supabase.storage.from("artwork-images").getPublicUrl(path);

    const makePrimary = !hasPrimary && i === primaryIndex;
    const { data: row, error: insertError } = await supabase
      .from("artwork_images")
      .insert({ artwork_id: artworkId, url: publicUrl, is_primary: makePrimary })
      .select()
      .single();
    if (insertError) throw insertError;

    if (makePrimary) hasPrimary = true;
    uploaded.push(row);
  }
  return uploaded;
}

/** Unsets the current primary (if any) and sets the given image as primary. */
export async function setPrimaryImage(artworkId: string, imageId: string): Promise<void> {
  const { error: unsetError } = await supabase
    .from("artwork_images")
    .update({ is_primary: false })
    .eq("artwork_id", artworkId)
    .eq("is_primary", true);
  if (unsetError) throw unsetError;

  const { error: setError } = await supabase
    .from("artwork_images")
    .update({ is_primary: true })
    .eq("id", imageId);
  if (setError) throw setError;
}

export async function getArtworkPrivateNotes(artworkId: string): Promise<string> {
  const { data, error } = await supabase
    .from("artwork_private_notes")
    .select("notes")
    .eq("artwork_id", artworkId)
    .maybeSingle();
  if (error) throw error;
  return data?.notes ?? "";
}

export async function saveArtworkPrivateNotes(artworkId: string, notes: string): Promise<void> {
  const { error } = await supabase
    .from("artwork_private_notes")
    .upsert({ artwork_id: artworkId, notes, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function isController(profileId: string, controllerProfileId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("profile_controllers")
    .select("profile_id")
    .eq("profile_id", profileId)
    .eq("controller_profile_id", controllerProfileId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function getArtwork(id: string): Promise<Artwork | null> {
  const { data, error } = await supabase.from("artworks").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listArtworksByArtist(rootArtistId: string): Promise<Artwork[]> {
  const { data, error } = await supabase
    .from("artworks")
    .select("*")
    .eq("root_artist_id", rootArtistId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getArtworkEvents(artworkId: string): Promise<ArtworkEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("artwork_id", artworkId)
    .order("occurred_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Looks up display names for a set of profile ids, e.g. to label events. */
export async function getProfileNames(ids: string[]): Promise<Record<string, string>> {
  const uniqueIds = [...new Set(ids)].filter(Boolean);
  if (uniqueIds.length === 0) return {};

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", uniqueIds);
  if (error) throw error;

  const map: Record<string, string> = {};
  for (const row of (data ?? []) as Pick<Profile, "id" | "display_name">[]) {
    map[row.id] = row.display_name;
  }
  return map;
}
