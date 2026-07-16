import { supabase } from "./supabaseClient";

export interface JgaPushImageResult {
  source_url: string;
  status: "copied" | "unchanged" | "rejected";
  reason?: string;
}

export interface JgaPushItemResult {
  atlas_artwork_id: string;
  status: "created" | "updated" | "rejected";
  reason?: string;
  skipped_fields?: string[];
  images?: JgaPushImageResult[];
}

export interface JgaPushCollectionResult {
  atlas_collection_id: string;
  status: "created" | "updated" | "rejected";
  reason?: string;
  artwork_count?: number;
}

export interface JgaPushResponse {
  results: JgaPushItemResult[];
  collection_results?: JgaPushCollectionResult[];
}

/**
 * Pushes one artwork's identity record (title, medium, dimensions, images,
 * provenance link, …) to JGA Studio via the push-to-jga Edge Function.
 * Commerce fields (price, availability) are never sent — those live in JGA
 * Studio only. Safe to call repeatedly: the JGA side upserts by
 * atlas_artwork_id and diffs images by content hash.
 */
export async function pushArtworkToJga(artworkId: string): Promise<JgaPushItemResult> {
  const { data, error } = await supabase.functions.invoke("push-to-jga", {
    body: { artworkId },
  });

  if (error) {
    // supabase.functions.invoke() wraps any non-2xx response in a generic
    // error; the real message is on the response body (same pattern as
    // stellarWallet.ts).
    let message = error.message ?? "Push failed";
    const context = (error as { context?: Response }).context;
    if (context) {
      try {
        const body = await context.json();
        if (body?.error) message = body.error;
      } catch {
        // keep the generic message
      }
    }
    throw new Error(message);
  }

  if (data?.error) throw new Error(data.error);
  const result = (data as JgaPushResponse)?.results?.[0];
  if (!result) throw new Error("JGA Studio returned no result for this artwork");
  if (result.status === "rejected") {
    throw new Error(result.reason ?? "JGA Studio rejected this artwork");
  }
  return result;
}

/** Pushes a collection and its ordered artwork membership as one operation. */
export async function pushCollectionToJga(
  collectionId: string
): Promise<{
  collection: JgaPushCollectionResult;
  artworks: JgaPushItemResult[];
}> {
  const { data, error } = await supabase.functions.invoke("push-to-jga", {
    body: { collectionId },
  });

  if (error) {
    let message = error.message ?? "Push failed";
    const context = (error as { context?: Response }).context;
    if (context) {
      try {
        const body = await context.json();
        if (body?.error) message = body.error;
      } catch {
        // keep the generic message
      }
    }
    throw new Error(message);
  }

  if (data?.error) throw new Error(data.error);
  const response = data as JgaPushResponse;
  const collection = response.collection_results?.[0];
  if (!collection) {
    throw new Error("JGA Studio returned no result for this collection");
  }
  if (collection.status === "rejected") {
    throw new Error(collection.reason ?? "JGA Studio rejected this collection");
  }

  return {
    collection,
    artworks: response.results ?? [],
  };
}
