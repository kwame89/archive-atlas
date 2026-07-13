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
