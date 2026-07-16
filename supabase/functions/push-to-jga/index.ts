// Pushes an artwork's canonical record (identity fields + image manifest +
// public provenance URL) to JGA Studio's atlas-import Edge Function, per the
// integration spec in the jga-studio repo (docs/09-archive-atlas-integration.md).
//
// Archive Atlas stays the system of record for artwork identity and
// provenance; JGA Studio owns commerce (price, availability, auctions).
// This function only ever sends identity fields — it knows nothing about
// prices, and the receiving side refuses to touch commerce columns.
//
// Auth: JGA Studio is a private integration. The artwork's root artist must
// have the server-managed jga_studio integration enabled, and the caller must
// be signed in and control that root profile. Both rules are re-checked here;
// hiding the browser button is only a convenience, never the security layer.
//
// Transport auth to JGA Studio is an HMAC-SHA256 signature over
// `${timestamp}.${body}` with a shared secret — no user tokens cross the
// project boundary.
//
// Deploy via the Supabase Dashboard's Edge Functions editor, then set three
// function secrets:
//   JGA_IMPORT_URL          — e.g. https://<jga-project>.supabase.co/functions/v1/atlas-import
//   JGA_PUSH_SHARED_SECRET  — same value as ATLAS_SHARED_SECRET on the JGA side
//   ATLAS_PUBLIC_URL        — public site origin used to build provenance links,
//                             e.g. https://archiveatlas.example.com
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.)

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const JGA_IMPORT_URL = Deno.env.get("JGA_IMPORT_URL");
const JGA_PUSH_SHARED_SECRET = Deno.env.get("JGA_PUSH_SHARED_SECRET");
const ATLAS_PUBLIC_URL = (Deno.env.get("ATLAS_PUBLIC_URL") ?? "").replace(/\/+$/, "");

const MAX_ARTWORKS_PER_PUSH = 30;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }
  if (!JGA_IMPORT_URL || !JGA_PUSH_SHARED_SECRET || !ATLAS_PUBLIC_URL) {
    return jsonResponse(
      { error: "Push to JGA Studio is not configured on this deployment (missing function secrets)." },
      503
    );
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // --- Caller auth -------------------------------------------------------
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return jsonResponse({ error: "Missing auth token" }, 401);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);
    if (userError || !user) return jsonResponse({ error: "Invalid auth token" }, 401);

    // --- Input -------------------------------------------------------------
    const payload = await req.json().catch(() => null);
    const collectionId =
      typeof payload?.collectionId === "string" ? payload.collectionId : null;
    let artworkIds: string[] = Array.isArray(payload?.artworkIds)
      ? payload.artworkIds
      : payload?.artworkId
        ? [payload.artworkId]
        : [];

    let pushedCollection: {
      atlas_collection_id: string;
      root_artist_id: string;
      title: string;
      description: string | null;
      start_year: number | null;
      end_year: number | null;
      cover_artwork_id: string | null;
      artwork_ids: string[];
    } | null = null;

    if (collectionId) {
      const { data: collection, error: collectionError } = await supabase
        .from("collections")
        .select("*")
        .eq("id", collectionId)
        .maybeSingle();
      if (collectionError) {
        return jsonResponse({ error: collectionError.message }, 500);
      }
      if (!collection) {
        return jsonResponse({ error: "Collection not found" }, 404);
      }

      const { data: memberships, error: membershipError } = await supabase
        .from("collection_artworks")
        .select("artwork_id, sort_order")
        .eq("collection_id", collectionId)
        .order("sort_order", { ascending: true });
      if (membershipError) {
        return jsonResponse({ error: membershipError.message }, 500);
      }

      artworkIds = (memberships ?? []).map((membership) => membership.artwork_id);
      pushedCollection = {
        atlas_collection_id: collection.id,
        root_artist_id: collection.artist_id,
        title: collection.title,
        description: collection.description ?? null,
        start_year: collection.start_year ?? null,
        end_year: collection.end_year ?? null,
        cover_artwork_id: collection.cover_artwork_id ?? artworkIds[0] ?? null,
        artwork_ids: artworkIds,
      };
    }

    artworkIds = [...new Set(artworkIds)];
    if (artworkIds.length === 0) {
      return jsonResponse(
        { error: collectionId ? "Add at least one artwork to this collection" : "Provide artworkId or artworkIds" },
        400
      );
    }
    if (artworkIds.length > MAX_ARTWORKS_PER_PUSH) {
      return jsonResponse({ error: `At most ${MAX_ARTWORKS_PER_PUSH} artworks per push` }, 400);
    }

    // --- Load artworks and re-verify control of each root artist ------------
    const { data: artworks, error: artworksError } = await supabase
      .from("artworks")
      .select("*")
      .in("id", artworkIds);
    if (artworksError) return jsonResponse({ error: artworksError.message }, 500);
    if (!artworks || artworks.length === 0) {
      return jsonResponse({ error: "No matching artworks" }, 404);
    }
    if (artworks.length !== artworkIds.length) {
      return jsonResponse(
        { error: "One or more collection artworks could not be loaded" },
        404
      );
    }

    const { data: myProfiles } = await supabase
      .from("profiles")
      .select("id")
      .eq("auth_user_id", user.id);
    const myProfileIds = (myProfiles ?? []).map((p) => p.id);
    if (myProfileIds.length === 0) {
      return jsonResponse({ error: "No profile for this account" }, 403);
    }

    const rootArtistIds = [...new Set(artworks.map((a) => a.root_artist_id))];
    if (
      pushedCollection &&
      !rootArtistIds.includes(pushedCollection.root_artist_id)
    ) {
      return jsonResponse(
        { error: "Collection artworks must belong to the collection artist" },
        400
      );
    }
    const { data: integrationRows, error: integrationsError } = await supabase
      .from("profile_integrations")
      .select("profile_id")
      .eq("integration_key", "jga_studio")
      .eq("enabled", true)
      .in("profile_id", rootArtistIds);
    if (integrationsError) {
      return jsonResponse({ error: "Could not verify JGA Studio integration access" }, 500);
    }

    const integrationEnabled = new Set(
      (integrationRows ?? []).map((row) => row.profile_id)
    );
    const integrationDenied = artworks.filter(
      (artwork) => !integrationEnabled.has(artwork.root_artist_id)
    );
    if (integrationDenied.length > 0) {
      return jsonResponse(
        {
          error: "JGA Studio publishing is not enabled for this artist profile",
          denied_artwork_ids: integrationDenied.map((artwork) => artwork.id),
        },
        403
      );
    }

    const { data: controllerRows } = await supabase
      .from("profile_controllers")
      .select("profile_id")
      .in("profile_id", rootArtistIds)
      .in("controller_profile_id", myProfileIds);
    const controlled = new Set((controllerRows ?? []).map((r) => r.profile_id));

    const denied = artworks.filter((a) => !controlled.has(a.root_artist_id));
    if (denied.length > 0) {
      return jsonResponse(
        {
          error: "You can only push artworks whose root artist profile you control",
          denied_artwork_ids: denied.map((a) => a.id),
        },
        403
      );
    }

    // --- Build the canonical push payload -----------------------------------
    const { data: imageRows, error: imagesError } = await supabase
      .from("artwork_images")
      .select("artwork_id, url, is_primary, created_at")
      .in("artwork_id", artworkIds)
      .order("created_at", { ascending: true });
    if (imagesError) return jsonResponse({ error: imagesError.message }, 500);

    const items = artworks.map((a) => ({
      atlas_artwork_id: a.id,
      root_artist_id: a.root_artist_id,
      title: a.title,
      medium: a.medium ?? null,
      dimensions: a.dimensions ?? null,
      year: a.year ?? null,
      edition_number: a.edition_number ?? null,
      edition_total: a.edition_total ?? null,
      description: a.description ?? null,
      tags: Array.isArray(a.tags) ? a.tags : [],
      subject_matter: a.subject_matter ?? null,
      provenance_url: `${ATLAS_PUBLIC_URL}/artworks/${a.id}`,
      images: (imageRows ?? [])
        .filter((img) => img.artwork_id === a.id)
        .map((img, i) => ({
          url: img.url,
          is_primary: Boolean(img.is_primary),
          sort_order: i,
          // Atlas doesn't capture alt text yet; JGA falls back to the title.
          alt_text: null,
        })),
    }));

    // --- Sign and send -------------------------------------------------------
    const body = JSON.stringify({
      artworks: items,
      collections: pushedCollection ? [pushedCollection] : [],
    });
    const timestamp = Date.now().toString();
    const signature = await hmacSha256Hex(JGA_PUSH_SHARED_SECRET, `${timestamp}.${body}`);

    const response = await fetch(JGA_IMPORT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-atlas-timestamp": timestamp,
        "x-atlas-signature": signature,
      },
      body,
    });

    const result = await response.json().catch(() => ({ error: "Unreadable response from JGA Studio" }));
    if (!response.ok) {
      return jsonResponse(
        { error: result?.error ?? `JGA Studio responded ${response.status}`, jga_status: response.status },
        502
      );
    }
    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});
