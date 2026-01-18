import express from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { createSupabaseUserClient } from "../lib/supabaseUser.js";

const router = express.Router();

router.get("/chats/:chatId/messages", requireAuth, async (req, res) => {
  try {
    const { chatId } = req.params;

    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : null;

    if (!token) {
      return res.status(401).json({ error: "Missing Authorization token" });
    }

    const supabaseUser = createSupabaseUserClient(token);
    if (!supabaseUser) {
      return res.status(401).json({ error: "Invalid authorization token." });
    }

    const { data, error } = await supabaseUser
      .from("messages")
      .select("id, role, content, created_at")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Messages load error:", error);
      return res.status(500).json({ error: "Failed to load messages" });
    }

    res.json({ messages: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
 