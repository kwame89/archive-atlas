import { supabase } from "./supabaseClient";
import type { Artwork, Collection } from "../types/database";

export interface CollectionSummary extends Collection {
  artwork_count: number;
}

export interface CollectionMember {
  artwork: Artwork;
  sort_order: number;
}

export interface SaveCollectionInput {
  title: string;
  description: string | null;
  startYear: number | null;
  endYear: number | null;
  coverArtworkId: string | null;
  artworkIds: string[];
}

export async function listCollectionsByArtist(
  artistId: string
): Promise<CollectionSummary[]> {
  const { data: collections, error } = await supabase
    .from("collections")
    .select("*")
    .eq("artist_id", artistId)
    .order("updated_at", { ascending: false });
  if (error) throw error;

  const collectionIds = (collections ?? []).map((collection) => collection.id);
  if (collectionIds.length === 0) return [];

  const { data: memberships, error: membershipError } = await supabase
    .from("collection_artworks")
    .select("collection_id")
    .in("collection_id", collectionIds);
  if (membershipError) throw membershipError;

  const counts = new Map<string, number>();
  for (const membership of memberships ?? []) {
    counts.set(
      membership.collection_id,
      (counts.get(membership.collection_id) ?? 0) + 1
    );
  }

  return (collections ?? []).map((collection) => ({
    ...collection,
    artwork_count: counts.get(collection.id) ?? 0,
  }));
}

export async function getCollectionMembers(
  collectionId: string
): Promise<CollectionMember[]> {
  const { data: memberships, error } = await supabase
    .from("collection_artworks")
    .select("artwork_id, sort_order")
    .eq("collection_id", collectionId)
    .order("sort_order", { ascending: true });
  if (error) throw error;

  const artworkIds = (memberships ?? []).map((membership) => membership.artwork_id);
  if (artworkIds.length === 0) return [];

  const { data: artworks, error: artworksError } = await supabase
    .from("artworks")
    .select("*")
    .in("id", artworkIds);
  if (artworksError) throw artworksError;

  const artworkById = new Map(
    (artworks ?? []).map((artwork) => [artwork.id, artwork as Artwork])
  );

  return (memberships ?? [])
    .map((membership) => {
      const artwork = artworkById.get(membership.artwork_id);
      return artwork
        ? { artwork, sort_order: membership.sort_order }
        : null;
    })
    .filter((member): member is CollectionMember => Boolean(member));
}

async function replaceCollectionArtworks(
  collectionId: string,
  artworkIds: string[]
): Promise<void> {
  const { error } = await supabase.rpc("replace_collection_artworks", {
    p_collection_id: collectionId,
    p_artwork_ids: artworkIds,
  });
  if (error) throw error;
}

export async function createCollection(
  artistId: string,
  input: SaveCollectionInput
): Promise<Collection> {
  const coverArtworkId =
    input.coverArtworkId && input.artworkIds.includes(input.coverArtworkId)
      ? input.coverArtworkId
      : input.artworkIds[0] ?? null;

  const { data: collection, error } = await supabase
    .from("collections")
    .insert({
      artist_id: artistId,
      title: input.title.trim(),
      description: input.description,
      start_year: input.startYear,
      end_year: input.endYear,
      cover_artwork_id: null,
    })
    .select()
    .single();
  if (error) throw error;

  try {
    await replaceCollectionArtworks(collection.id, input.artworkIds);
    const { data: updated, error: updateError } = await supabase
      .from("collections")
      .update({
        cover_artwork_id: coverArtworkId,
      })
      .eq("id", collection.id)
      .select()
      .single();
    if (updateError) throw updateError;
    return updated;
  } catch (saveError) {
    await supabase.from("collections").delete().eq("id", collection.id);
    throw saveError;
  }
}

export async function updateCollection(
  collectionId: string,
  input: SaveCollectionInput
): Promise<Collection> {
  await replaceCollectionArtworks(collectionId, input.artworkIds);

  const coverArtworkId =
    input.coverArtworkId && input.artworkIds.includes(input.coverArtworkId)
      ? input.coverArtworkId
      : input.artworkIds[0] ?? null;

  const { data, error } = await supabase
    .from("collections")
    .update({
      title: input.title.trim(),
      description: input.description,
      start_year: input.startYear,
      end_year: input.endYear,
      cover_artwork_id: coverArtworkId,
    })
    .eq("id", collectionId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCollection(collectionId: string): Promise<void> {
  const { error } = await supabase
    .from("collections")
    .delete()
    .eq("id", collectionId);
  if (error) throw error;
}
