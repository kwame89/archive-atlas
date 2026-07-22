// Anchors an event's hash on the configured Stellar network via a
// reserve-safe manage_data write/delete pair.
//
// Two modes, both ending in the same on_chain_anchor_hash column:
//
// 1. { eventId } — platform-signed (the original, still the default for
//    every actor without a linked wallet, and for lower-stakes event types
//    even when the actor IS wallet-linked — see SCOPE.md's Phase 2 friction
//    decision). Signs with the platform's own keypair (STELLAR_ANCHOR_SECRET,
//    never shipped to the browser). Proves an event's content existed and
//    was unaltered at a given time, not that a specific artist personally
//    signed it.
//
// 2. { eventId, txHash } — wallet-signed. The browser already built, signed
//    (via the artist's own Freighter wallet), and submitted the anchor
//    transaction directly to Horizon — this function never sees the
//    artist's key. It only re-fetches that transaction from Horizon and
//    independently verifies it actually anchors this event (right
//    manage_data name/value, right source account) before trusting it and
//    recording wallet_signed = true. This mirrors the same
//    "server re-verifies, never just trusts a client claim" pattern as
//    every other write path in this app.
//
// Deploy via the Supabase Dashboard's Edge Functions editor (paste this
// file's contents in), then set two function secrets:
//   STELLAR_ANCHOR_SECRET  — the platform Stellar secret key for the
//                            selected network
//   (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are already provided
//   automatically in the Edge Function runtime — no need to set those)

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  BASE_FEE,
  Horizon,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
} from "npm:@stellar/stellar-sdk@13";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STELLAR_ANCHOR_SECRET = Deno.env.get("STELLAR_ANCHOR_SECRET")!;
// Network selection: set the STELLAR_NETWORK function secret to "mainnet"
// to anchor on the public network (STELLAR_ANCHOR_SECRET must then be a
// funded MAINNET account). Defaults to testnet. Must be flipped together
// with the site's VITE_STELLAR_NETWORK (see README > Mainnet cutover).
const STELLAR_NETWORK = Deno.env.get("STELLAR_NETWORK") === "mainnet" ? "mainnet" : "testnet";
const HORIZON_URL =
  STELLAR_NETWORK === "mainnet"
    ? "https://horizon.stellar.org"
    : "https://horizon-testnet.stellar.org";
const NETWORK_PASSPHRASE = STELLAR_NETWORK === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;

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

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Same canonical subset of fields on both the platform-signed and
// wallet-signed paths, so a wallet-signed anchor is verifiable against the
// exact same hash the platform path would have produced for that event.
function canonicalEventJson(event: Record<string, unknown>): string {
  return JSON.stringify({
    id: event.id,
    type: event.type,
    actor_id: event.actor_id,
    artwork_id: event.artwork_id,
    target_profile_id: event.target_profile_id,
    from_party_id: event.from_party_id,
    to_party_id: event.to_party_id,
    transaction_group_id: event.transaction_group_id,
    occurred_at: event.occurred_at,
    price: event.price,
    currency: event.currency,
    notes: event.notes,
    exhibition_title: event.exhibition_title,
    exhibition_venue: event.exhibition_venue,
    exhibition_location: event.exhibition_location,
    exhibition_end_date: event.exhibition_end_date,
    condition_rating: event.condition_rating,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { eventId, txHash } = await req.json();
    if (!eventId) return jsonResponse({ error: "eventId is required" }, 400);

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return jsonResponse({ error: "Authentication required" }, 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: event, error: fetchError } = await supabase
      .from("events")
      .select("*")
      .eq("id", eventId)
      .single();
    if (fetchError || !event) {
      return jsonResponse({ error: fetchError?.message ?? "Event not found" }, 404);
    }

    const supabaseAsCaller = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: controlsActor, error: authError } = await supabaseAsCaller.rpc(
      "auth_controls_profile",
      { p_profile_id: event.actor_id }
    );
    if (authError) {
      return jsonResponse({ error: "Could not verify event authority" }, 500);
    }

    let canAnchor = Boolean(controlsActor);
    if (!canAnchor && event.type === "exhibition" && event.artwork_id) {
      const { data: artwork } = await supabase
        .from("artworks")
        .select("root_artist_id")
        .eq("id", event.artwork_id)
        .single();
      if (artwork?.root_artist_id) {
        const { data: controlsRootArtist } = await supabaseAsCaller.rpc(
          "auth_controls_or_created_unclaimed",
          { p_profile_id: artwork.root_artist_id }
        );
        canAnchor = Boolean(controlsRootArtist);
      }
    }

    if (!canAnchor) {
      return jsonResponse({ error: "Not authorized to anchor this event" }, 403);
    }

    const contentHash = await sha256Hex(canonicalEventJson(event));

    // Retries are common on mobile networks. Never spend another fee or
    // overwrite a confirmed proof when this event already has an anchor.
    if (event.on_chain_anchor_hash) {
      if (txHash && txHash !== event.on_chain_anchor_hash) {
        return jsonResponse({ error: "Event is already anchored by a different transaction" }, 409);
      }
      return jsonResponse({
        success: true,
        alreadyAnchored: true,
        stellarTxHash: event.on_chain_anchor_hash,
      });
    }

    const server = new Horizon.Server(HORIZON_URL);
    const { data: actor, error: actorError } = await supabase
      .from("profiles")
      .select("linked_wallet, trust_tier")
      .eq("id", event.actor_id)
      .single();
    if (actorError || !actor) {
      return jsonResponse({ error: actorError?.message ?? "Actor profile not found" }, 404);
    }

    // Mode 2: wallet-signed. The browser already built, signed, and
    // submitted this transaction with the artist's own key — verify it
    // actually anchors this event before trusting it.
    if (txHash) {
      if (!actor.linked_wallet) {
        return jsonResponse({ error: "Actor has no linked wallet" }, 400);
      }

      const txRecord = await server.transactions().transaction(txHash).call();
      if (!txRecord.successful) {
        return jsonResponse({ error: "Transaction was not successful on-chain" }, 400);
      }
      if (txRecord.source_account !== actor.linked_wallet) {
        return jsonResponse(
          { error: "Transaction source account does not match actor's linked wallet" },
          400
        );
      }

      const tx = TransactionBuilder.fromXDR(txRecord.envelope_xdr, NETWORK_PASSPHRASE);
      const expectedName = `event:${event.id}`.slice(0, 64);
      const operations = "operations" in tx ? tx.operations : [];
      const manageDataOps = operations.filter(
        (op) => op.type === "manageData" && op.name === expectedName
      ) as Array<{ name: string; value?: Uint8Array | null }>;
      const [anchorOp, cleanupOp] = manageDataOps;

      if (
        manageDataOps.length !== 2 ||
        !anchorOp?.value ||
        cleanupOp?.value != null
      ) {
        return jsonResponse(
          { error: "Transaction must write and then remove the matching manage_data proof" },
          400
        );
      }
      const hasUnsafeOperation = operations.some((op) => {
        if (op.type !== "manageData") return true;
        if (op.name === expectedName) return false;
        return !op.name.startsWith("event:") || op.value != null;
      });
      if (hasUnsafeOperation) {
        return jsonResponse({ error: "Anchor transaction contains an unrelated operation" }, 400);
      }

      const actualValue = new TextDecoder().decode(anchorOp.value);
      if (actualValue !== contentHash) {
        return jsonResponse({ error: "Anchored value does not match event content hash" }, 400);
      }

      const { error: updateError } = await supabase
        .from("events")
        .update({ on_chain_anchor_hash: txHash, wallet_signed: true, anchor_network: STELLAR_NETWORK })
        .eq("id", eventId);
      if (updateError) return jsonResponse({ error: updateError.message }, 500);

      return jsonResponse({ success: true, stellarTxHash: txHash, contentHash });
    }

    // Mode 1: platform-signed (default).
    if (
      actor.linked_wallet &&
      (event.type === "genesis" || event.type === "ownership_transfer")
    ) {
      return jsonResponse(
        { error: "This event requires a signature from the actor's linked wallet" },
        409
      );
    }

    const keypair = Keypair.fromSecret(STELLAR_ANCHOR_SECRET);
    const account = await server.loadAccount(keypair.publicKey());
    const anchorName = `event:${event.id}`.slice(0, 64);
    const staleAnchorNames = Object.keys(account.data_attr ?? {})
      .filter((name) => name.startsWith("event:") && name !== anchorName)
      .slice(0, 98);

    const transactionBuilder = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    });

    for (const staleName of staleAnchorNames) {
      transactionBuilder.addOperation(
        Operation.manageData({ name: staleName, value: null })
      );
    }

    const transaction = transactionBuilder
      .addOperation(
        Operation.manageData({
          name: anchorName,
          value: contentHash, // 64 hex chars = 64 bytes, exactly the manage_data limit
        })
      )
      .addOperation(Operation.manageData({ name: anchorName, value: null }))
      .setTimeout(180)
      .build();

    transaction.sign(keypair);
    const result = await server.submitTransaction(transaction);

    const { error: updateError } = await supabase
      .from("events")
      .update({ on_chain_anchor_hash: result.hash, anchor_network: STELLAR_NETWORK })
      .eq("id", eventId);
    if (updateError) return jsonResponse({ error: updateError.message }, 500);

    return jsonResponse({ success: true, stellarTxHash: result.hash, contentHash });
  } catch (err) {
    console.error("anchor-event failed", err);
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
