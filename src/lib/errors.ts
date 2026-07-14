const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A malformed (non-UUID) id in a URL should behave like "not found", not
 * like a raw Postgres "invalid input syntax for type uuid" error. */
export function isValidUuid(id: string): boolean {
  return UUID_RE.test(id);
}

/**
 * Supabase/Postgrest errors are plain objects with a `message` property,
 * not JS Error instances — `err instanceof Error` misses them, which was
 * silently swallowing real error messages behind a generic fallback.
 */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    const message = (err as { message: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return "Something went wrong.";
}
