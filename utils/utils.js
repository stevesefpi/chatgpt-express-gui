export async function generateChatTitle(openaiClient, firstUserMessage) {
  const response = await openaiClient.responses.create({
    model: "gpt-5.2",
    input: [
      {
        role: "system",
        content:
          "Create a short chat title. It must have 2 to 6 words maximum. No quotes. No punctuation at the end. Title case. Do not include emojis. Do not include extra symbols. Do not try to make it bold. Just simple text. Just the 2 to 6 word title and nothing else at all.",
      },
      { role: "user", content: firstUserMessage },
    ],
    max_output_tokens: 20,
  });

  return (response.output_text || "New chat").trim();
}

export function base64ToBuffer(b64) {
  return Buffer.from(b64, "base64");
}

export function makeFileName(userId, crypto) {
  const id = crypto.randomUUID();
  return `${userId}/${Date.now()}-${id}.png`;
}

export function normalizeForModel(content) {
  const s = String(content || "").trim();
  if (s.startsWith("{")) {
    try {
      const obj = JSON.parse(s);
      if (obj?.type === "image") return "[Image]";
    } catch {}
  }
  return s;
}

export async function updateChatSummary({
  supabaseUser,
  openai,
  chatId,
  messages_limit,
  model,
  maxTokens
}) {
  // Load summary + checkpoint
  const { data: chatRow, error: metaError } = await supabaseUser
    .from("chats")
    .select("summary, summary_until_message_id")
    .eq("id", chatId)
    .single();

  if (metaError) {
    console.error("Error loading chat summary: ", metaError);
    return;
  }

  const oldSummary = String(chatRow?.summary || "").trim();
  const checkpointId = chatRow?.summary_until_message_id || null;

  // Fetch unsummarized messages
  let unsummarized = [];

  if (!checkpointId) {
    // First summarization
    const { data, error } = await supabaseUser
      .from("messages")
      .select("id, role, content, created_at")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true })
      .limit(messages_limit);

    if (error) {
      console.error("Error loading initial summary: ", error);
      return;
    }

    unsummarized = data || [];
  } else {
    // Finding pivot timestamp for checkpoint message
    const { data: pivot, error: pivotErr } = await supabaseUser
      .from("messages")
      .select("created_at")
      .eq("id", checkpointId)
      .single();

    if (pivotErr || !pivot?.created_at) {
      console.error("Checkpoint pivot load error: ", pivotErr);
      return;
    }

    const { data, error } = await supabaseUser
      .from("messages")
      .select("id, role, content, created_at")
      .eq("chat_id", chatId)
      .gt("created_at", pivot.created_at)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Unsummarized load error:", error);
      return;
    }

    unsummarized = data || [];
  }

  // Summarize only when enough new messages accumulated

  if (unsummarized.length < messages_limit) return;

  const formatted = unsummarized
    .map(
      (m) =>
        `${String(m.role || "").toUpperCase()}: ${normalizeForModel(m.content)}`,
    )
    .join("\n");

    const response = await openai.responses.create({
    model: model,
    input: [
      {
        role: "system",
        content:
          "Update a running conversation summary. Keep it concise and useful: user goals, constraints, decisions, preferences, key facts, open tasks. No fluff.",
      },
      {
        role: "user",
        content:
          `CURRENT SUMMARY:\n${oldSummary || "(empty)"}\n\n` +
          `NEW MESSAGES:\n${formatted}\n\n` +
          "Return ONLY the updated summary text.",
      },
    ],
    max_output_tokens: maxTokens,
  });

  const newSummary = String(response.output_text || "").trim();
  if (!newSummary) return;

  const lastSummarizedId = unsummarized[unsummarized.length - 1].id;

  // Save summary
  const {error: uploadError} = await supabaseUser
  .from("chats")
  .update({
    summary: newSummary,
    summary_until_message_id: lastSummarizedId,
    updated_at: new Date().toISOString(),
  })
  .eq("id", chatId);

  if (uploadError) console.error("Summary update error: ", uploadError);
}

// Rate limiting

export function setLimiter(rateLimit) {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: "Too many requests, please try again later."},
  });
  return limiter;
}
  
export function formatImageForOpenAI(base64Image, mime = "image/jpeg") {
  return {
    type: "input_image",
    image_url: `data:${mime};base64,${base64Image}`,
  };
}