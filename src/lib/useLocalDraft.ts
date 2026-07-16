import { useCallback, useEffect, useState } from "react";

interface StoredDraft<T> {
  version: 1;
  value: T;
}

function readDraft<T>(key: string): T | null {
  try {
    const stored = window.localStorage.getItem(key);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as StoredDraft<T>;
    return parsed.version === 1 ? parsed.value : null;
  } catch {
    return null;
  }
}

export function useLocalDraft<T>(key: string, createInitialValue: () => T) {
  const [draft, setDraft] = useState<T>(() => readDraft<T>(key) ?? createInitialValue());

  useEffect(() => {
    try {
      const stored: StoredDraft<T> = { version: 1, value: draft };
      window.localStorage.setItem(key, JSON.stringify(stored));
    } catch {
      // Keep the form usable if private browsing or storage limits block drafts.
    }
  }, [draft, key]);

  const clearDraft = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Clearing a draft should never block a successful submit or cancellation.
    }
  }, [key]);

  return [draft, setDraft, clearDraft] as const;
}
