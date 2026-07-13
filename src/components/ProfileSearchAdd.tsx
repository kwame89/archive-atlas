import { useState, type FormEvent } from "react";
import { searchProfiles } from "../lib/profiles";
import { getErrorMessage } from "../lib/errors";
import type { Profile } from "../types/database";

interface ProfileSearchAddProps {
  excludeIds: string[];
  onAdd: (profile: Profile) => void;
  placeholder?: string;
}

export function ProfileSearchAdd({ excludeIds, onAdd, placeholder }: ProfileSearchAddProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [error, setError] = useState("");

  async function handleSearch(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      setResults(await searchProfiles(query));
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  const visibleResults = results.filter((p) => !excludeIds.includes(p.id));

  return (
    <div>
      <form onSubmit={handleSearch}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder ?? "Search profiles by name…"}
        />
        <button type="submit">Search</button>
      </form>
      {visibleResults.length > 0 && (
        <ul className="results">
          {visibleResults.map((p) => (
            <li key={p.id}>
              <span>
                {p.display_name} ({p.type})
              </span>
              <button
                type="button"
                onClick={() => {
                  onAdd(p);
                  setResults(results.filter((r) => r.id !== p.id));
                }}
              >
                Add
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
