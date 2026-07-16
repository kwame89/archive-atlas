import { useState } from "react";
import { Send } from "lucide-react";
import { pushArtworkToJga, type JgaPushItemResult } from "../lib/pushToJga";
import { getErrorMessage } from "../lib/errors";

/**
 * "Push to JGA Studio" — sends this artwork's identity record and images to
 * the JGA Studio storefront (jga-studio repo, docs/09). Shown only to
 * controllers of Jay's JGA-enabled root artist profile. The Edge Function
 * independently enforces that private integration allowlist. Re-pushing is
 * safe: JGA upserts by this artwork's id and skips unchanged images, and it
 * never overwrites pricing or publication status set in JGA.
 */
export function PushToJgaButton({ artworkId }: { artworkId: string }) {
  const [pushing, setPushing] = useState(false);
  const [result, setResult] = useState<JgaPushItemResult | null>(null);
  const [error, setError] = useState("");

  async function handlePush() {
    setPushing(true);
    setError("");
    setResult(null);
    try {
      setResult(await pushArtworkToJga(artworkId));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setPushing(false);
    }
  }

  function summarize(r: JgaPushItemResult): string {
    const images = r.images ?? [];
    const copied = images.filter((i) => i.status === "copied").length;
    const unchanged = images.filter((i) => i.status === "unchanged").length;
    const rejected = images.filter((i) => i.status === "rejected").length;
    const parts = [r.status === "created" ? "Listed in JGA Studio as a new draft" : "JGA Studio record updated"];
    if (copied) parts.push(`${copied} image${copied === 1 ? "" : "s"} copied`);
    if (unchanged) parts.push(`${unchanged} unchanged`);
    if (rejected) parts.push(`${rejected} rejected (see below)`);
    if (r.skipped_fields?.length) {
      parts.push(`fields locked in JGA and left alone: ${r.skipped_fields.join(", ")}`);
    }
    return parts.join(" · ");
  }

  return (
    <div className="push-to-jga">
      <p>
        Send this record and its images to the JGA Studio storefront. Pricing and availability are
        set in JGA Studio afterward — pushing again later updates details without touching them.
      </p>
      <button type="button" onClick={handlePush} disabled={pushing}>
        <Send size={16} aria-hidden="true" />
        {pushing ? "Pushing…" : result ? "Push again" : "Push to JGA Studio"}
      </button>
      {result && (
        <div role="status">
          <p>{summarize(result)}</p>
          {(result.images ?? [])
            .filter((i) => i.status === "rejected")
            .map((i) => (
              <p key={i.source_url} className="error">
                Image rejected: {i.reason ?? "unknown reason"}
              </p>
            ))}
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
