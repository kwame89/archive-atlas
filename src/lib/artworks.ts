import { supabase } from "./supabaseClient";
import type { Artwork, ArtworkEvent, ArtworkImage, Profile } from "../types/database";

export interface CreateArtworkInput {
  title: string;
  medium?: string;
  dimensions?: string;
  year?: number;
  editionNumber?: number;
  editionTotal?: number;
}

/**
 * Logs the genesis event for a new artwork: the creating profile is both
 * initial owner and custodian. Two sequential requests, same non-atomicity
 * note as profiles.ts — a dropped connection between them leaves an artwork
 * with no genesis event logged, which is visible (empty provenance) rather
 * than silently wrong, and safe to retry by re-inserting the event.
 */
export async function createArtwork(
  rootArtistId: string,
  input: CreateArtworkInput
): Promise<Artwork> {
  const { data: artwork, error: insertError } = await supabase
    .from("artworks")
    .insert({
      title: input.title,
      medium: input.medium || null,
      dimensions: input.dimensions || null,
      year: input.year ?? null,
      edition_number: input.editionNumber ?? null,
      edition_total: input.editionTotal ?? null,
      root_artist_id: rootArtistId,
      current_owner_id: rootArtistId,
      current_custodian_id: rootArtistId,
    })
    .select()
    .single();

  if (insertError) throw insertError;

  const { error: eventError } = await supabase.from("events").insert({
    type: "genesis",
    actor_id: rootArtistId,
    artwork_id: artwork.id,
    to_party_id: rootArtistId,
  });

  if (eventError) throw eventError;

  return artwork;
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
