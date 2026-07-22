import type { ProfileType } from "../types/database";

export const PROFILE_TYPE_LABELS: Record<ProfileType, string> = {
  artist: "Artist",
  collective: "Collective / Studio",
  gallery: "Gallery",
  curator: "Curator",
  collector: "Collector",
  institution: "Institution",
};

export const PROFILE_TYPE_OPTIONS = (Object.entries(PROFILE_TYPE_LABELS) as [
  ProfileType,
  string,
][]).map(([value, label]) => ({ value, label }));

export function normalizeSpecialties(value: string): string[] {
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))].slice(0, 12);
}

