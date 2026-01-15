import {
  addMessage,
  clearMessages,
  setMessageHtml,
  fetchChats,
  renderChatList,
  fetchMessages,
  renderMessages,
  getCurrentTime,
} from "./utils/chat_utils.js";

window.addEventListener("error", (e) => {
  console.error("GLOBAL ERROR:", e.message, e.error);
});

window.addEventListener("unhandledrejection", (e) => {
  console.error("UNHANDLED PROMISE REJECTION:", e.reason);
});

const chatForm = document.getElementById("chatForm");
const promptEl = document.getElementById("prompt");
const messagesEl = document.getElementById("messages");

const chatListEl = document.getElementById("chatList");
const newChatBtn = document.getElementById("newChatBtn");

let currentChatId = null;

async function refreshChats() {
  const chats = await fetchChats();
  renderChatList(chatListEl, chats, currentChatId, selectChat);
}

async function selectChat(chatId) {
  currentChatId = chatId;

  const msgs = await fetchMessages(chatId);
  renderMessages(messagesEl, msgs);

  await refreshChats();
}

// Create a new chat when clicking the NEW button

newChatBtn?.addEventListener("click", async () => {
  try {
    console.log("[chat] getting token...");
    const token = await window.getAccessToken?.();
    console.log("[chat] token:", token ? token.slice(0, 20) + "..." : token);

    const res = await fetch("/chats", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to create chat");

    currentChatId = data.chatId;

    clearMessages(messagesEl);
    await refreshChats();
  } catch (err) {
    console.error(err);
  }
});

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const text = promptEl.value.trim();
  if (!text) return;

  const now = getCurrentTime();

  addMessage(messagesEl, text, "user", now);
  promptEl.value = "";

  const assistantBubble = addMessage(
    messagesEl,
    "Thinking...",
    "assistant",
    now
  );

  try {
    console.log("[chat] getting token...");
    const token = await window.getAccessToken?.();
    console.log("[chat] token:", token ? token.slice(0, 20) + "..." : token);

    if (!token) {
      assistantBubble.textContent = "Session expired, please log in again.";
      return;
    }

    if (!currentChatId) {
      const chatRes = await fetch("/chats", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const chatData = await chatRes.json();
      if (!chatRes.ok) {
        assistantBubble.textContent = chatData.error || "Failed to create chat";
        return;
      }

      currentChatId = chatData.chatId;
      await refreshChats();
    }

    const response = await fetch("/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message: text, chatId: currentChatId }),
    });

    const data = await response.json();

    if (!response.ok) throw new Error(data.error || "Request failed");

    if (data.type === "image") {
      const src = `data:${data.mime || "image/png"};base64,${data.b64}`;
      const contentEl = assistantBubble.querySelector(".msg-content");
      contentEl.innerHTML = `<img class="chat-image" src="${src}" alt="Generated image" />`;
    } else {
      setMessageHtml(assistantBubble, data.reply || "(No reply returned)");
    }

    await refreshChats();
  } catch (err) {
    assistantBubble.textContent = "Error: " + err.message;
  }
});

window.refreshChats = refreshChats;
