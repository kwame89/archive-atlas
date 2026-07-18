// Artwork classification — whether a work is one of a kind or part of an
// edition run, following the taxonomy the wider market already uses.
//
// Before this existed, a work with no edition_number/edition_total was
// indistinguishable from a work whose edition was simply never recorded.
// That ambiguity reached collectors and got baked into authenticity
// certificate snapshots, so classification is recorded explicitly and null
// (unset) stays meaningfully distinct from "unique".

export type ArtworkClassification =
  | "unique"
  | "limited_edition"
  | "open_edition"
  | "unknown_edition";

export interface ClassificationOption {
  value: ArtworkClassification;
  label: string;
  description: string;
  /** Edition inputs this classification permits (mirrors the DB constraint). */
  allowsEditionNumber: boolean;
  allowsEditionTotal: boolean;
  /** A limited edition without a known run size is not a limited edition. */
  requiresEditionTotal: boolean;
}

export const CLASSIFICATION_OPTIONS: ClassificationOption[] = [
  {
    value: "unique",
    label: "Unique",
    description: "One-of-a-kind piece.",
    allowsEditionNumber: false,
    allowsEditionTotal: false,
    requiresEditionTotal: false,
  },
  {
    value: "limited_edition",
    label: "Limited edition",
    description:
      "The edition run has ended; the number of works produced is known and included in the listing.",
    allowsEditionNumber: true,
    allowsEditionTotal: true,
    requiresEditionTotal: true,
  },
  {
    value: "open_edition",
    label: "Open edition",
    description:
      "The edition run is ongoing. New works are still being produced, which may be numbered. This includes made-to-order works.",
    allowsEditionNumber: true,
    allowsEditionTotal: false,
    requiresEditionTotal: false,
  },
  {
    value: "unknown_edition",
    label: "Unknown edition",
    description:
      "The edition run has ended; it is unclear how many works were produced.",
    allowsEditionNumber: false,
    allowsEditionTotal: false,
    requiresEditionTotal: false,
  },
];

export function getClassificationOption(
  value: string | null | undefined,
): ClassificationOption | null {
  if (!value) return null;
  return CLASSIFICATION_OPTIONS.find((option) => option.value === value) ?? null;
}

/**
 * Validates a classification against its edition fields, mirroring the
 * artworks_classification_valid DB constraint so the form reports the
 * problem instead of surfacing a Postgres error.
 *
 * @returns an error message, or null when valid.
 */
export function validateClassification(
  classification: string | null | undefined,
  editionNumber: number | null,
  editionTotal: number | null,
): string | null {
  const option = getClassificationOption(classification);
  // Unset is allowed — existing works predate this field.
  if (!option) return null;

  if (option.requiresEditionTotal && editionTotal === null) {
    return "A limited edition needs an edition total — that is what makes the run limited.";
  }
  if (!option.allowsEditionTotal && editionTotal !== null) {
    return `${option.label} works cannot have an edition total.`;
  }
  if (!option.allowsEditionNumber && editionNumber !== null) {
    return `${option.label} works cannot have an edition number.`;
  }
  if (
    option.value === "limited_edition" &&
    editionNumber !== null &&
    editionTotal !== null &&
    editionNumber > editionTotal
  ) {
    return "The edition number cannot be higher than the edition total.";
  }
  return null;
}

/** Collector-facing label, e.g. "Edition 3 of 25" or "Unique". */
export function formatEditionLabel(
  classification: string | null | undefined,
  editionNumber: number | null,
  editionTotal: number | null,
): string | null {
  const option = getClassificationOption(classification);
  if (!option) {
    // Unclassified: fall back to whatever the edition fields alone support,
    // rather than asserting anything.
    return editionNumber && editionTotal
      ? `Edition ${editionNumber} of ${editionTotal}`
      : null;
  }
  switch (option.value) {
    case "unique":
      return "Unique";
    case "limited_edition":
      return editionNumber
        ? `Edition ${editionNumber} of ${editionTotal}`
        : `Limited edition of ${editionTotal}`;
    case "open_edition":
      return editionNumber ? `Open edition, no. ${editionNumber}` : "Open edition";
    case "unknown_edition":
      return "Edition size unknown";
  }
}
