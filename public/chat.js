import { addMessage, clearMessages, setMessageHtml, fetchChats, renderChatList, fetchMessages, renderMessages } from "./utils/chat_utils.js";

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
    const token = await window.getAccessToken?.();
    if (!token) return;

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

window.addEventListener("DOMContentLoaded", async () => {
  try {
    await refreshChats();
  } catch (err) {
    console.error(err);
  }
});

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const text = promptEl.value.trim();
  if (!text) return;

  addMessage(messagesEl, text, "user");
  promptEl.value = "";

  const assistantBubble = addMessage(messagesEl, "Thinking...", "assistant");

  try {
    const token = await window.getAccessToken?.();
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

    setMessageHtml(assistantBubble, data.reply || "(No reply returned)");
    await refreshChats();
  } catch (err) {
    assistantBubble.textContent = "Error: " + err.message;
  }
});

window.refreshChats = refreshChats;
