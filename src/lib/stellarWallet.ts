import {
  BASE_FEE,
  Horizon,
  Networks,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit";
import { FreighterModule } from "@creit.tech/stellar-wallets-kit/modules/freighter";
import { AlbedoModule } from "@creit.tech/stellar-wallets-kit/modules/albedo";
import { RabetModule } from "@creit.tech/stellar-wallets-kit/modules/rabet";
import { LobstrModule } from "@creit.tech/stellar-wallets-kit/modules/lobstr";
import { HanaModule } from "@creit.tech/stellar-wallets-kit/modules/hana";
import { supabase } from "./supabaseClient";
import { getErrorMessage } from "./errors";

const HORIZON_URL = "https://horizon-testnet.stellar.org";
const NETWORK_PASSPHRASE = Networks.TESTNET;
const FRIENDBOT_URL = "https://friendbot.stellar.org";

// Initialize wallet kit once at module load
StellarWalletsKit.init({
  modules: [
    new FreighterModule(),
    new AlbedoModule(),
    new RabetModule(),
    new LobstrModule(),
    new HanaModule(),
  ],
  network: NETWORK_PASSPHRASE,
});

export async function isWalletAvailable(): Promise<boolean> {
  // Wallet-kit doesn't expose direct availability check — authModal will handle unavailability.
  // This is a stub for backwards compatibility; always returns true since we'll show the modal.
  return true;
}

async function connectWallet(): Promise<string> {
  try {
    const result = await StellarWalletsKit.authModal();
    if (!result?.address) throw new Error("Wallet selection was cancelled");
    return result.address;
  } catch (err) {
    // authModal throws with code -1 if user closes the modal without selecting
    if ((err as { code?: number })?.code === -1) {
      throw new Error("Wallet selection was cancelled");
    }
    throw new Error(
      (err as { message?: string })?.message ?? "Could not connect to a wallet"
    );
  }
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
 *
 * stellar-wallets-kit's message signing support varies by wallet:
 * Freighter, Albedo, and Hana support it; LOBSTR and Rabet may not.
 * Gracefully falls back to Freighter's direct API if kit's signing fails.
 */
export async function linkWallet(profileId: string): Promise<string> {
  const publicKey = await connectWallet();
  const timestamp = new Date().toISOString();
  const message = `Link Archive Atlas profile ${profileId} at ${timestamp}`;

  let signedMessage: string | undefined;

  // Try wallet-kit's signing first (some wallets support message signing)
  try {
    const result = await StellarWalletsKit.signMessage(message, { address: publicKey });
    signedMessage = result.signedMessage;
  } catch {
    // Wallet-kit doesn't support signing, or method unavailable — try Freighter fallback
    try {
      const { signMessage: freighterSign } = await import("@stellar/freighter-api");
      const { signedMessage: fResult, error } = await freighterSign(message, { address: publicKey });
      if (error) throw new Error(error.message ?? "Wallet signature was declined");
      signedMessage =
        typeof fResult === "string" ? fResult : fResult?.toString("base64");
    } catch (freightErr) {
      throw new Error(
        freightErr instanceof Error
          ? freightErr.message
          : "This wallet does not support message signing"
      );
    }
  }

  if (!signedMessage) throw new Error("Wallet did not return a signature");

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
 * events (see SCOPE.md's Phase 2 notes). Works with any wallet in the kit
 * (Freighter, Albedo, Rabet, LOBSTR, Hana); throws on any failure so the
 * caller can show an error or fall back to leaving the event platform-anchored.
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

  const { signedTxXdr } = await StellarWalletsKit.signTransaction(
    transaction.toXDR(),
    {
      networkPassphrase: NETWORK_PASSPHRASE,
      address: actorPublicKey,
    }
  );
  if (!signedTxXdr) throw new Error("Wallet did not return a signed transaction");

  const signedTx = TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE);

  let result;
  try {
    result = await server.submitTransaction(signedTx);
  } catch (submitErr) {
    // Horizon rejects some failures (bad sequence, can't cover the fee, etc.)
    // before the transaction ever lands in a ledger — stellar-sdk throws for
    // these, with the actual reason in the response body's extras, not in
    // the exception's own message.
    const resultCodes = (submitErr as { response?: { data?: { extras?: { result_codes?: unknown } } } })
      ?.response?.data?.extras?.result_codes;
    const reason = resultCodes ? JSON.stringify(resultCodes) : getErrorMessage(submitErr);
    throw new Error(`Transaction rejected before reaching the ledger: ${reason}`);
  }

  if (!result.successful) {
    // Unlike a rejection above, this transaction WAS included in a ledger —
    // it consumed the sequence number and fee, but the operation itself
    // failed. stellar-sdk doesn't throw for this case. Point at Stellar
    // Expert rather than guessing at the XDR-encoded reason ourselves.
    throw new Error(
      `Transaction was not successful on-chain. Inspect it at https://stellar.expert/explorer/testnet/tx/${result.hash}`
    );
  }

  const { data, error: fnError } = await supabase.functions.invoke("anchor-event", {
    body: { eventId: event.id, txHash: result.hash },
  });
  if (fnError) throw new Error(await unwrapFunctionError(fnError));
  if (data?.error) throw new Error(data.error);

  return result.hash;
}

/** Disconnects the wallet locally and removes the verified link from the
 * controlled profile. The server performs its own authorization check. */
export async function disconnectWallet(profileId: string): Promise<void> {
  const { data, error: fnError } = await supabase.functions.invoke("link-wallet", {
    body: { action: "disconnect", profileId },
  });
  if (fnError) throw new Error(await unwrapFunctionError(fnError));
  if (data?.error) throw new Error(data.error);

  await StellarWalletsKit.disconnect();
}
