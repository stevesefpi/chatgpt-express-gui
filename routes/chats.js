import express from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { createSupabaseUserClient } from "../lib/supabaseUser.js";

const router = express.Router();

router.get("/chats", requireAuth, async (req, res) => {
  try {
    const supabaseUser = createSupabaseUserClient(req.token);
    if (!supabaseUser) {
        return res.status(401).json({ error: "Invalid authorization token." });
    }

    const { data, error } = await supabaseUser
      .from("chats")
      .select("id, title, updated_at")
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Chats list error: ", error);
      return res.status(500).json({ error: "Failed to load chats" });
    }

    res.json({ chats: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/chats", requireAuth, async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : null;

    if (!token) {
      return res.status(401).json({ error: "Missing Authorization token" });
    }

    // Create a per-request Supabase client that includes the user's JWT
    const supabaseUser = createSupabaseUserClient(token);
    if (!supabaseUser) {
      return res.status(401).json({ error: "Invalid authorization token." });
    }

    const { data, error } = await supabaseUser
      .from("chats")
      .insert({ user_id: req.user.id, title: "New chat" })
      .select("id")
      .single();

    if (error) {
      console.error(error);
      return res.status(500).json({ error: "Failed to create chat" });
    }

    res.json({ chatId: data.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
