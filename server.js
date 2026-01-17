import { createClient } from "@supabase/supabase-js";
import express from "express";
import crypto from "crypto";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

import { requireAuth } from "./middleware/requireAuth.js";
import {
  generateChatTitle,
  base64ToBuffer,
  makeFileName,
} from "./utils/utils.js";
import { measureMemory } from "vm";

const MESSAGES_LIMIT = 10;

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.get("/config", (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  });
});

app.get("/chats", requireAuth, async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : null;

    if (!token) {
      return res.status(401).json({ error: "Missing Authorization token." });
    }

    const supabaseUser = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      },
    );

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

app.post("/chats", requireAuth, async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : null;

    if (!token) {
      return res.status(401).json({ error: "Missing Authorization token" });
    }

    // Create a per-request Supabase client that includes the user's JWT
    const supabaseUser = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      },
    );

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

app.post("/chat", requireAuth, async (req, res) => {
  try {
    const { message, chatId } = req.body;

    if (!message) {
      return res.status(400).json({ error: "A prompt message is required." });
    }

    if (!chatId) {
      return res.status(400).json({ error: "chatId is required." });
    }

    // Get bearer token
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : null;

    if (!token) {
      return res.status(401).json({ error: "Missing authorization token." });
    }

    const supabaseUser = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      {
        global: {
          headers: { Authorization: `Bearer ${token}` },
        },
      },
    );

    // Saving user message into the database
    const { error: userInsertError } = await supabaseUser
      .from("messages")
      .insert({
        chat_id: chatId,
        user_id: req.user.id,
        role: "user",
        content: message,
      });

    if (userInsertError) {
      console.error("User message insert error:", userInsertError);
      return res.status(500).json({ error: "failed to save user message" });
    }

    // If this is the first chat message, this code generates a new title for the chat
    const { data: chatRow, error: chatErr } = await supabaseUser
      .from("chats")
      .select("title")
      .eq("id", chatId)
      .single();

    if (!chatErr && chatRow?.title === "New chat") {
      try {
        const title = await generateChatTitle(client, message);

        const { error: updateErr } = await supabaseUser
          .from("chats")
          .update({ title })
          .eq("id", chatId);

        if (updateErr) console.error("Title update error:", updateErr);
      } catch (e) {
        console.error("title generation error: ", e);
      }
    }

    // Load chat summary
    const { data: chatSummary, error: chatSummaryError } = await supabaseUser
      .from("chats")
      .select("summary")
      .eq("id", chatId)
      .single();

    if (chatSummaryError) {
      console.error("Error loading chat summary: ", chatSummaryError);
      return res.status(500).json({ error: "Failed to load chat meta" });
    }
    // Getting message history from the database,
    // but only the last 5 user messages and 5 assistant messages
    const { data: recentHistory, error: recentHistoryErr } = await supabaseUser
      .from("messages")
      .select("role, content, created_at")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: false })
      .limit(MESSAGES_LIMIT);

    if (recentHistoryErr) {
      console.error("History load error:", recentHistoryErr);
      return res.status(500).json({ error: "Failed to load chat history" });
    }

    recentHistory.reverse();

    const inputMessages = [
      {
        role: "system",
        content:
          "You are a helpful assistant. Use the conversation summary as background context. If it conflicts with the latest messages, prefer the latest messages.",
      },
    ];

    const summaryText = String(chatSummary?.summary || "").trim();
    if (summaryText) {
      inputMessages.push({
        role: "system",
        content: `Conversation summary:\n${summaryText}`,
      });
    }

    // Convert DB rows into OpenAI format 
    for (const message of recentHistory) {
      const stringifiedMessage = String(message.content || "").trim();
      if (stringifiedMessage.startsWith("{")) {
        try {
          const obj = JSON.parse(stringifiedMessage);
          if (obj.type === "image") {
            inputMessages.push({ role: message.role, content: "[Image]" });
            continue;
          }
        } catch {}
      }

      inputMessages.push({ role: message.role, content: message.content });
    }

    // Calling OpenAI with context
    const response = await client.responses.create({
      model: "gpt-5.2",
      tools: [{ type: "web_search" }, { type: "image_generation" }],
      input: inputMessages,
    });

    const imageCall = (response.output || []).find(
      (o) => o.type === "image_generation_call",
    );
    const imageBase64 = imageCall?.result || null;

    const assistantText = response.output_text || "";

    if (imageBase64) {
      const bytes = base64ToBuffer(imageBase64);
      const path = makeFileName(req.user.id, crypto);

      const { data: uploadData, error: uploadErr } = await supabaseUser.storage
        .from("chat-images")
        .upload(path, bytes, {
          contentType: "image/png",
          upsert: false,
        });

      if (uploadErr) {
        console.error("Storage upload error:", uploadErr);
        return res.status(500).json({ error: "Failed to upload image" });
      }

      // Get public URL
      const { data: pub } = supabaseUser.storage
        .from("chat-images")
        .getPublicUrl(uploadData.path);

      const imageUrl = pub.publicUrl;

      const payload = {
        type: "image",
        url: imageUrl,
        caption: assistantText || "",
      };

      await supabaseUser.from("messages").insert({
        chat_id: chatId,
        user_id: req.user.id,
        role: "assistant",
        content: JSON.stringify(payload),
      });

      // Return URL to browser
      return res.json({
        type: "image",
        url: imageUrl,
        caption: assistantText || "",
      });
    }

    console.log(response);

    // Saving the assistant TEXT reply into the database
    const { error: assistantInsertError } = await supabaseUser
      .from("messages")
      .insert({
        chat_id: chatId,
        user_id: req.user.id,
        role: "assistant",
        content: assistantText,
      });

    if (assistantInsertError) {
      console.error("Assistant message insert error:", assistantInsertError);
      return res.status(500).json({ error: "Failed to save assistant reply" });
    }

    return res.json({ type: "text", reply: assistantText });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "OpenAI request failed" });
  }
});

app.get("/chats/:chatId/messages", requireAuth, async (req, res) => {
  try {
    const { chatId } = req.params;

    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : null;

    if (!token) {
      return res.status(401).json({ error: "Missing Authorization token" });
    }

    const supabaseUser = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      },
    );

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

const PORT = 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
