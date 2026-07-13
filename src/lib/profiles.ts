import { supabase } from "./supabaseClient";
import type { Profile, ProfileType } from "../types/database";

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
