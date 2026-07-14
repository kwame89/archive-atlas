import {
  BASE_FEE,
  Horizon,
  Networks,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { isConnected, requestAccess, signMessage, signTransaction } from "@stellar/freighter-api";
import { supabase } from "./supabaseClient";

const HORIZON_URL = "https://horizon-testnet.stellar.org";
const NETWORK_PASSPHRASE = Networks.TESTNET;
const FRIENDBOT_URL = "https://friendbot.stellar.org";

export async function isFreighterInstalled(): Promise<boolean> {
  const { isConnected: connected } = await isConnected();
  return Boolean(connected);
}

async function connectFreighter(): Promise<string> {
  const { address, error } = await requestAccess();
  if (error) throw new Error(error.message ?? "Freighter access was denied");
  if (!address) throw new Error("Freighter did not return a public key");
  return address;
}

/**
 * supabase.functions.invoke() wraps any non-2xx response in a generic
 * FunctionsHttpError without surfacing the actual JSON body the function
 * sent back — the real error message is on error.context, the raw Response.
 * Without this, every rejection from link-wallet/anchor-event (bad
 * signature, unauthorized, stale timestamp, etc.) shows up client-side as
 * the meaningless "Edge Function returned a non-2xx status code".
 */
async function unwrapFunctionError(error: unknown): Promise<string> {
  const context = (error as { context?: unknown } | null)?.context;
  if (context instanceof Response) {
    try {
      const body = await context.clone().json();
      if (body?.error) return body.error;
    } catch {
      // fall through to the generic message below
    }
  }
  return error instanceof Error ? error.message : "Request failed";
}

/**
 * Links a Stellar wallet to a profile. Proves key ownership via an
 * off-chain SEP-53 message signature (no transaction, no funding needed) —
 * see the link-wallet Edge Function for the server-side verification, which
 * never trusts this client's word alone.
 */
export async function linkWallet(profileId: string): Promise<string> {
  const publicKey = await connectFreighter();
  const timestamp = new Date().toISOString();
  const message = `Link Archive Atlas profile ${profileId} at ${timestamp}`;

  const { signedMessage, error } = await signMessage(message, { address: publicKey });
  if (error) throw new Error(error.message ?? "Wallet signature was declined");
  if (!signedMessage) throw new Error("Freighter did not return a signature");

  const { data, error: fnError } = await supabase.functions.invoke("link-wallet", {
    body: { profileId, publicKey, timestamp, signedMessage },
  });
  if (fnError) throw new Error(await unwrapFunctionError(fnError));
  if (data?.error) throw new Error(data.error);

  return publicKey;
}

async function ensureFunded(server: Horizon.Server, publicKey: string): Promise<void> {
  try {
    await server.loadAccount(publicKey);
  } catch {
    const res = await fetch(`${FRIENDBOT_URL}?addr=${encodeURIComponent(publicKey)}`);
    if (!res.ok) throw new Error("Could not fund your testnet wallet via Friendbot");
  }
}

export interface CanonicalEventFields {
  id: string;
  type: string;
  actor_id: string;
  artwork_id: string | null;
  target_profile_id: string | null;
  from_party_id: string | null;
  to_party_id: string | null;
  transaction_group_id: string | null;
  occurred_at: string;
  price: number | null;
  currency: string | null;
  notes: string | null;
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Same canonical field subset/order as the anchor-event Edge Function's
// canonicalEventJson — must match exactly, since the server independently
// recomputes this hash and compares it against what's anchored on-chain.
function canonicalEventJson(event: CanonicalEventFields): string {
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
  });
}

/**
 * Signs and anchors an event with the actor's own linked wallet instead of
 * the platform's key — the "high-stakes" path for genesis/ownership_transfer
 * events (see SCOPE.md's Phase 2 notes). Requires a live Freighter approval;
 * throws on any failure so the caller can show an error or fall back to
 * leaving the event platform-anchored, rather than silently doing nothing.
 */
export async function signAndAnchorEvent(
  actorPublicKey: string,
  event: CanonicalEventFields
): Promise<string> {
  const server = new Horizon.Server(HORIZON_URL);
  await ensureFunded(server, actorPublicKey);

  const contentHash = await sha256Hex(canonicalEventJson(event));
  const account = await server.loadAccount(actorPublicKey);

  const transaction = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.manageData({
        name: `event:${event.id}`.slice(0, 64),
        value: contentHash,
      })
    )
    .setTimeout(180)
    .build();

  const { signedTxXdr, error } = await signTransaction(transaction.toXDR(), {
    networkPassphrase: NETWORK_PASSPHRASE,
    address: actorPublicKey,
  });
  if (error) throw new Error(error.message ?? "Wallet signature was declined");
  if (!signedTxXdr) throw new Error("Freighter did not return a signed transaction");

  const signedTx = TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE);
  const result = await server.submitTransaction(signedTx);

  const { data, error: fnError } = await supabase.functions.invoke("anchor-event", {
    body: { eventId: event.id, txHash: result.hash },
  });
  if (fnError) throw new Error(await unwrapFunctionError(fnError));
  if (data?.error) throw new Error(data.error);

  return result.hash;
}
