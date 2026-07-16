import { supabase } from "./supabaseClient";

export const JGA_STUDIO_INTEGRATION = "jga_studio";

export async function profileHasIntegration(
  profileId: string,
  integrationKey: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("profile_integrations")
    .select("profile_id")
    .eq("profile_id", profileId)
    .eq("integration_key", integrationKey)
    .eq("enabled", true)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}
