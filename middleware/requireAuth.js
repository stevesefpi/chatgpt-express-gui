import { createClient } from "@supabase/supabase-js";

let supabase;

function getSupabase() {
  if (!supabase) {
    if (!process.env.SUPABASE_URL)
      throw new Error("SUPABASE_URL missing in env");
    if (!process.env.SUPABASE_ANON_KEY)
      throw new Error("SUPABASE_ANON_KEY missing in env");

    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
  }
  return supabase;
}

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : null;

    if (!token) {
      return res
        .status(401)
        .json({ error: "Missing Authorization Bearer token" });
    }

    const { data, error } = await getSupabase().auth.getUser(token);

    if (error || !data?.user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    req.user = data.user;
    next();
  } catch (err) {
    res.status(500).json({ error: "Auth check failed" });
  }
}
