/**
 * The gallery red dot: this work is spoken for.
 *
 * Public on purpose. artwork_sales stays private (price, buyer, channel and
 * notes are readable only by the parties and the root artist) — this reads
 * artworks.sold_at, which carries only the fact of a sale and discloses
 * nothing the public ownership_transfer event doesn't already show.
 */
export function SoldDot({ soldAt }: { soldAt?: string | null }) {
  if (!soldAt) return null;
  return (
    <span className="sold-dot" title="Sold" aria-label="Sold">
      <span className="sold-dot-mark" aria-hidden="true" />
      Sold
    </span>
  );
}
