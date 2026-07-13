// Anchors an event's hash on Stellar testnet via a manage_data operation.
//
// This runs server-side specifically because it signs with the platform's
// own Stellar keypair (STELLAR_ANCHOR_SECRET) — that secret must never be
// shipped to the browser, which is why this can't just be done from the
// frontend the way the course payment dApp signed with the user's own
// Freighter wallet. No artist has a linked wallet yet (that's Phase 2), so
// anchoring is platform-signed for now: it proves an event's content
// existed and was unaltered at a given time, not that a specific artist
// personally signed it.
//
// Deploy via the Supabase Dashboard's Edge Functions editor (paste this
// file's contents in), then set two function secrets:
//   STELLAR_ANCHOR_SECRET  — the platform Stellar testnet secret key
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
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STELLAR_ANCHOR_SECRET = Deno.env.get("STELLAR_ANCHOR_SECRET")!;
const HORIZON_URL = "https://horizon-testnet.stellar.org";
const NETWORK_PASSPHRASE = Networks.TESTNET;

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { eventId } = await req.json();
    if (!eventId) return jsonResponse({ error: "eventId is required" }, 400);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: event, error: fetchError } = await supabase
      .from("events")
      .select("*")
      .eq("id", eventId)
      .single();
    if (fetchError || !event) {
      return jsonResponse({ error: fetchError?.message ?? "Event not found" }, 404);
    }

    // A canonical, deterministic subset of fields — not the whole row, since
    // created_at/on_chain_anchor_hash itself would make the hash unstable
    // across the very update this function makes.
    const canonical = JSON.stringify({
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
    });
    const contentHash = await sha256Hex(canonical);

    const server = new Horizon.Server(HORIZON_URL);
    const keypair = Keypair.fromSecret(STELLAR_ANCHOR_SECRET);
    const account = await server.loadAccount(keypair.publicKey());

    const transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        Operation.manageData({
          name: `event:${event.id}`.slice(0, 64),
          value: contentHash, // 64 hex chars = 64 bytes, exactly the manage_data limit
        })
      )
      .setTimeout(180)
      .build();

    transaction.sign(keypair);
    const result = await server.submitTransaction(transaction);

    const { error: updateError } = await supabase
      .from("events")
      .update({ on_chain_anchor_hash: result.hash })
      .eq("id", eventId);
    if (updateError) return jsonResponse({ error: updateError.message }, 500);

    return jsonResponse({ success: true, stellarTxHash: result.hash, contentHash });
  } catch (err) {
    console.error("anchor-event failed", err);
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
