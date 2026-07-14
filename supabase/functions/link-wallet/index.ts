// Verifies that the caller genuinely controls a Stellar public key, then
// links it to their profile and bumps trust_tier to wallet_linked.
//
// Proof of ownership uses SEP-53 message signing (a plain off-chain ed25519
// signature over a fixed-format string) rather than a real Stellar
// transaction — linking itself isn't recorded on-chain, so there's no need
// for the artist's testnet account to even exist yet, let alone be funded.
// That's deliberately different from anchor-event's wallet-signed mode,
// which DOES need a funded account, because that one really does submit a
// transaction to the ledger.
//
// This function never receives the artist's secret key — only their public
// key and a signature Freighter produced client-side. It re-derives the
// exact message that should have been signed from (profileId, timestamp)
// rather than trusting a client-supplied message string, so a captured
// signature can't be replayed against a different profile.
//
// Deploy via the Supabase Dashboard's Edge Functions editor (paste this
// file's contents in). No new function secrets needed — SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are already provided automatically.

import { createClient } from "npm:@supabase/supabase-js@2";
import { Keypair } from "npm:@stellar/stellar-sdk@13";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MAX_TIMESTAMP_SKEW_MS = 5 * 60 * 1000;

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

function linkMessage(profileId: string, timestamp: string): string {
  return `Link Archive Atlas profile ${profileId} at ${timestamp}`;
}

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
}

function base64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { profileId, publicKey, timestamp, signedMessage } = await req.json();
    if (!profileId || !publicKey || !timestamp || !signedMessage) {
      return jsonResponse({ error: "profileId, publicKey, timestamp, and signedMessage are required" }, 400);
    }

    const skew = Math.abs(Date.now() - Date.parse(timestamp));
    if (!Number.isFinite(skew) || skew > MAX_TIMESTAMP_SKEW_MS) {
      return jsonResponse({ error: "Timestamp is missing, malformed, or too old — try again" }, 400);
    }

    // Confirm the caller actually controls this profile, using the exact
    // same auth_controls_profile check every other write path relies on —
    // evaluated under the caller's own JWT, not the service role.
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseAsCaller = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: controls, error: authError } = await supabaseAsCaller.rpc(
      "auth_controls_profile",
      { p_profile_id: profileId }
    );
    if (authError || !controls) {
      return jsonResponse({ error: "Not authorized to link a wallet to this profile" }, 403);
    }

    // Reconstruct the expected message ourselves — never trust a
    // client-supplied message string paired with a signature.
    const message = linkMessage(profileId, timestamp);
    const payload = new TextEncoder().encode(`Stellar Signed Message:\n${message}`);
    const messageHash = await sha256(payload);

    let verified = false;
    try {
      verified = Keypair.fromPublicKey(publicKey).verify(messageHash, base64ToBytes(signedMessage));
    } catch {
      verified = false;
    }
    if (!verified) {
      return jsonResponse({ error: "Signature verification failed" }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ linked_wallet: publicKey, trust_tier: "wallet_linked" })
      .eq("id", profileId);
    if (updateError) return jsonResponse({ error: updateError.message }, 500);

    return jsonResponse({ success: true, linkedWallet: publicKey });
  } catch (err) {
    console.error("link-wallet failed", err);
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
