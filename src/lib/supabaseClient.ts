import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill in your Supabase project values."
  );
}

// Not using createClient<Database>(...): a column literally named `type`
// (profiles.type, events.type) trips an internal quirk in postgrest-js's
// generic type resolution that collapses insert/update argument types to
// `never`, unrelated to our schema design. Our own types in
// src/types/database.ts are applied manually at each call site instead —
// the standard alternative being `supabase gen types typescript` via the
// Supabase CLI, deferred for now to avoid an extra local CLI/auth setup step.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
