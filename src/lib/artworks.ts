import { supabase } from "./supabaseClient";
import type { Artwork, ArtworkEvent, Profile } from "../types/database";

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

export async function uploadArtworkImage(artworkId: string, file: File): Promise<string> {
  const path = `${artworkId}/${Date.now()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from("artwork-images")
    .upload(path, file);
  if (uploadError) throw uploadError;

  const {
    data: { publicUrl },
  } = supabase.storage.from("artwork-images").getPublicUrl(path);

  const { error: updateError } = await supabase
    .from("artworks")
    .update({ image_url: publicUrl })
    .eq("id", artworkId);
  if (updateError) throw updateError;

  return publicUrl;
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
