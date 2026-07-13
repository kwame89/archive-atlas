import { supabase } from "./supabaseClient";
import { isController } from "./artworks";
import type { Profile, ProfileType } from "../types/database";

export async function getProfile(id: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getMyProfile(authUserId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export interface CreateProfileInput {
  displayName: string;
  type: ProfileType;
  legalName?: string;
}

/**
 * Self-registration: creates a new, already-claimed profile owned by the
 * current auth user, then establishes them as its sole initial controller.
 * Not fully atomic (two sequential requests) — see 0002 migration notes.
 * A dropped connection between steps leaves a claimed profile with no
 * controller yet, but is self-healing: retrying the controller insert
 * succeeds under the same bootstrap policy, since auth_user_id is already set.
 */
export async function createProfile(
  authUserId: string,
  input: CreateProfileInput
): Promise<Profile> {
  const { data: profile, error: insertError } = await supabase
    .from("profiles")
    .insert({
      type: input.type,
      display_name: input.displayName,
      legal_name: input.legalName || null,
      trust_tier: "claimed",
      auth_user_id: authUserId,
      is_public: input.type !== "collector",
      claimed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertError) throw insertError;

  const { error: controllerError } = await supabase
    .from("profile_controllers")
    .insert({ profile_id: profile.id, controller_profile_id: profile.id });

  if (controllerError) throw controllerError;

  return profile;
}

export interface CreateUnclaimedProfileInput {
  displayName: string;
  type: ProfileType;
  legalName?: string;
}

/**
 * Creates a placeholder profile on behalf of an artist who isn't on the
 * platform yet — the cold-start mechanism from SCOPE.md. Unlike
 * createProfile, this is never auth_user_id-linked and has no controller
 * until claimed; creatorProfileId (recorded as created_by) is what lets the
 * creator act for it in the meantime, via auth_controls_or_created_unclaimed.
 */
export async function createUnclaimedProfile(
  creatorProfileId: string,
  input: CreateUnclaimedProfileInput
): Promise<Profile> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .insert({
      type: input.type,
      display_name: input.displayName,
      legal_name: input.legalName || null,
      trust_tier: "unclaimed",
      is_public: true,
      created_by: creatorProfileId,
    })
    .select()
    .single();
  if (error) throw error;
  return profile;
}

export async function listProfilesCreatedBy(creatorProfileId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("created_by", creatorProfileId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/**
 * Whether myProfileId can act for targetProfileId — either as a direct
 * controller, or as the creator of a still-unclaimed placeholder profile.
 * Use this in place of a bare isController check anywhere "can manage this
 * artwork" needs to account for the collective-created-it-on-their-behalf
 * case (canManage, controlsOwner, controlsCustodian on the artwork page).
 */
export async function canActFor(targetProfileId: string, myProfileId: string): Promise<boolean> {
  if (await isController(targetProfileId, myProfileId)) return true;

  const { data, error } = await supabase
    .from("profiles")
    .select("trust_tier, created_by")
    .eq("id", targetProfileId)
    .maybeSingle();
  if (error) throw error;

  if (data?.trust_tier === "unclaimed" && data.created_by) {
    return isController(data.created_by, myProfileId);
  }
  return false;
}

export async function searchUnclaimedProfiles(query: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("trust_tier", "unclaimed")
    .ilike("display_name", `%${query}%`)
    .limit(20);

  if (error) throw error;
  return data ?? [];
}

/** Searches all profiles regardless of trust tier — used to pick a transfer
 * recipient. RLS still blocks an unclaimed profile from being made a party
 * to an ownership_transfer, so an invalid pick surfaces as a clear error
 * rather than needing to be filtered out here. */
export async function searchProfiles(query: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .ilike("display_name", `%${query}%`)
    .limit(20);

  if (error) throw error;
  return data ?? [];
}

/**
 * Claims a pre-existing unclaimed profile (e.g. one a collective created on
 * an artist's behalf). Same non-atomicity note as createProfile applies.
 */
export async function claimProfile(authUserId: string, profileId: string): Promise<Profile> {
  const { data: profile, error: updateError } = await supabase
    .from("profiles")
    .update({
      auth_user_id: authUserId,
      trust_tier: "claimed",
      claimed_at: new Date().toISOString(),
    })
    .eq("id", profileId)
    .eq("trust_tier", "unclaimed")
    .is("auth_user_id", null)
    .select()
    .single();

  if (updateError) throw updateError;

  const { error: controllerError } = await supabase
    .from("profile_controllers")
    .insert({ profile_id: profile.id, controller_profile_id: profile.id });

  if (controllerError) throw controllerError;

  const { error: eventError } = await supabase.from("events").insert({
    type: "claim",
    actor_id: profile.id,
    target_profile_id: profile.id,
    notes: "Claimed via self-service email/social verification.",
  });

  if (eventError) throw eventError;

  return profile;
}
