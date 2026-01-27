import express from "express";
import crypto from "crypto";
import openai from "../lib/openai.js";

import { requireAuth } from "../middleware/requireAuth.js";
import { createSupabaseUserClient } from "../lib/supabaseUser.js";
import {
  generateChatTitle,
  base64ToBuffer,
  makeFileName,
  updateChatSummary,
  formatImageForOpenAI,
} from "../utils/utils.js";

const router = express.Router();

const MESSAGES_LIMIT = 10;
const SUMMARY_MODEL = "gpt-4.1-nano";
const SUMMARY_MAX_TOKENS = 500;
const ALLOWED_MODELS = new Set(["gpt-5.2", "gpt-4.1", "gpt-4.1-mini"]);

router.post("/chat", requireAuth, async (req, res) => {
  try {
    const { message, chatId, model, images, thinkingEffort } = req.body;

    if (
      (!message || typeof message !== "string") &&
      (!images || !Array.isArray(images) || images.length === 0)
    ) {
      return res
        .status(400)
        .json({ error: "A prompt message or image(s) are required." });
    }

    if (!chatId || typeof chatId !== "string") {
      return res.status(400).json({ error: "chatId is required." });
    }

    const supabaseUser = createSupabaseUserClient(req.token);
    if (!supabaseUser) {
      return res.status(401).json({ error: "Invalid authorization token." });
    }

    // Determine what to save in the database
    // If images are present, save as JSON with images metadata

    let contentToSave = message || "";

    if (images && images.length > 0) {
      contentToSave = JSON.stringify({
        type: "user_images",
        text: message || "",
        imageCount: images.length,
      });
    }

    // Save user message into the database
    const { error: userInsertError } = await supabaseUser
      .from("messages")
      .insert({
        chat_id: chatId,
        user_id: req.user.id,
        role: "user",
        content: contentToSave,
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
        const title = await generateChatTitle(openai, message);

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
      return res.status(500).json({ error: "Failed to load chat summary" });
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
            inputMessages.push({
              role: message.role,
              content: "[Generated Image]",
            });
            continue;
          }
          if (obj.type === "user_images") {
            inputMessages.push({
              role: message.role,
              content: obj.text || "[Images uploaded]",
            });
            continue;
          }
        } catch {}
      }

      inputMessages.push({ role: message.role, content: message.content });
    }

    const userMessageContent = [];

    // Add text if present
    if (message && message.trim()) {
      userMessageContent.push({
        type: "input_text",
        text: message,
      });
    }

    // Add images if present
    if (images && Array.isArray(images) && images.length > 0) {
      for (const b64 of images) {
        userMessageContent.push({
          type: "input_image",
          image_url: `data:image/jpeg;base64,${b64}`,
        });
      }
    }

    // Add the user's current message to inputMessages
    if (userMessageContent.length > 0) {
      inputMessages.push({
        role: "user",
        content:
          userMessageContent.length === 1 &&
          userMessageContent[0].type === "input_text"
            ? userMessageContent[0].text
            : userMessageContent,
      });
    }

    const ALLOWED_EFFORTS = new Set(["medium", "high"]);
    const chosenEffort = ALLOWED_EFFORTS.has(thinkingEffort)
      ? thinkingEffort
      : null;

    const chosenModel = ALLOWED_MODELS.has(model) ? model : "gpt-5.2";

    const payload = {
      model: chosenModel,
      tools: [{ type: "web_search" }, { type: "image_generation" }],
      input: inputMessages,
    };

    // Add reasoning only if the user selected the option from the model menu
    if (chosenEffort) {
      payload.reasoning = { effort: chosenEffort };
    }
    // Calling OpenAI with context
    const response = await openai.responses.create(payload);

    const imageCall = (response.output || []).find(
      (o) => o.type === "image_generation_call",
    );
    const generatedImageBase64 = imageCall?.result || null;

    const assistantText = response.output_text || "";

    if (generatedImageBase64) {
      const bytes = base64ToBuffer(generatedImageBase64);
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

    // Update chat summary (runs only every N messages)
    updateChatSummary({
      supabaseUser,
      openai: openai,
      chatId,
      messages_limit: MESSAGES_LIMIT,
      model: SUMMARY_MODEL,
      maxTokens: SUMMARY_MAX_TOKENS,
    }).catch((e) => console.error("Summary job failed:", e));

    return res.json({ type: "text", reply: assistantText });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "OpenAI request failed" });
  }
});

export default router;
