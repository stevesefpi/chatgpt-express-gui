import { createClient } from "@supabase/supabase-js";

export function createSupabaseUserClient(token) {
  if (!token) return null;

  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}