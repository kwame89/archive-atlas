import type { Artwork, Profile } from "../types/database";

const UUID_AT_END =
  /(?:^|--)([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;

export type ArtworkRouteAction = "edit" | "print" | "certificate";

export function slugifyRecordLabel(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");

  return slug || "record";
}

/** Accepts both legacy UUID-only references and the current readable slug--UUID format. */
export function recordIdFromRoute(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.match(UUID_AT_END)?.[1] ?? value;
}

export function artworkPath(
  artwork: Pick<Artwork, "id" | "title">,
  action?: ArtworkRouteAction
): string {
  const base = `/artworks/${slugifyRecordLabel(artwork.title)}--${artwork.id}`;
  return action ? `${base}/${action}` : base;
}

export function artworkPathFromParts(
  id: string,
  title: string,
  action?: ArtworkRouteAction
): string {
  return artworkPath({ id, title }, action);
}

export function profilePath(profile: Pick<Profile, "id" | "display_name">): string {
  return `/profiles/${slugifyRecordLabel(profile.display_name)}--${profile.id}`;
}

export function profilePathFromParts(id: string, displayName: string): string {
  return profilePath({ id, display_name: displayName });
}
