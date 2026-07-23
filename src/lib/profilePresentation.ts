import type { Profile, ProfileType } from "../types/database";

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

/**
 * Every role a profile holds, primary first.
 *
 * profiles.type stays the canonical role (it is what a sale records as
 * seller_type); secondary_roles adds the rest. Single source of truth for
 * both the printed label and the directory filter, so the two cannot drift.
 */
export function getProfileRoles(
  profile: Pick<Profile, "type"> & { secondary_roles?: ProfileType[] | null },
): ProfileType[] {
  const secondary = profile.secondary_roles ?? [];
  return [profile.type, ...secondary.filter((role) => role !== profile.type)];
}

/** e.g. "Artist · Curator", or just "Artist" for a single-role profile. */
export function formatProfileRoles(
  profile: Pick<Profile, "type"> & { secondary_roles?: ProfileType[] | null },
): string {
  return getProfileRoles(profile)
    .map((role) => PROFILE_TYPE_LABELS[role])
    .join(" · ");
}

/** True when the profile holds this role in any position — the directory filter. */
export function profileHasRole(
  profile: Pick<Profile, "type"> & { secondary_roles?: ProfileType[] | null },
  role: ProfileType,
): boolean {
  return getProfileRoles(profile).includes(role);
}

export function normalizeSpecialties(value: string): string[] {
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))].slice(0, 12);
}

