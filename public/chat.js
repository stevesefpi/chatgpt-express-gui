const chatForm = document.getElementById("chatForm");
const promptEl = document.getElementById("prompt");
const messagesEl = document.getElementById("messages");

const chatListEl = document.getElementById("chatList");
const newChatBtn = document.getElementById("newChatBtn");

function addMessage(text, role) {
  const div = document.createElement("div");
  div.className = `message ${role}`;

  const html = window.DOMPurify.sanitize(
    window.marked.parse(text)
  );

  div.innerHTML = html;

  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return div;
}

function clearMessages() {
  messagesEl.innerHTML = "";
}

let currentChatId = null;

function renderChatList(chats) {
  chatListEl.innerHTML = "";

  for (const chat of chats) {
    const item = document.createElement("div");
    item.className = "chat-item";
    item.textContent = chat.title || "Untitled chat";
    item.dataset.chatId = chat.id;

    if (chat.id === currentChatId) {
      item.classList.add("active");
    }

    item.addEventListener("click", async () => {
      await selectChat(chat.id);
    });

    chatListEl.appendChild(item);
  }
}

async function loadChats() {
  const token = await window.getAccessToken?.();
  if (!token) return;

  const res = await fetch("/chats", {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to load chats");

  renderChatList(data.chats || []);
}

async function loadMessages(chatId) {
  const token = await window.getAccessToken?.();
  if (!token) throw new Error("Session expired, please log in again");

  const res = await fetch(`/chats/${chatId}/messages`, {
    headers: { Authorization: `Bearer ${token} ` },
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to load messages");

  clearMessages();

  for (const m of data.messages || []) {
    addMessage(m.content, m.role);
  }
}

async function selectChat(chatId) {
  currentChatId = chatId;
  await loadMessages(chatId);
  await loadChats();
}

// Create a new chat when clicking the NEW button

newChatBtn?.addEventListener("click", async () => {
  try {
    const token = await window.getAccessToken?.();
    if (!token) return;

    const res = await fetch("/chats", {
      method: "POST",
      headers: {
        "Content-Type": "application.json",
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to create chat");

    currentChatId = data.chatId;

    clearMessages();
    await loadChats();
  } catch (err) {
    console.error(err);
  }
});

window.addEventListener("DOMContentLoaded", async () => {
  try {
    await loadChats();
  } catch (err) {
    console.err(err);
  }
});

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const text = promptEl.value.trim();
  if (!text) return;

  addMessage(text, "user");
  promptEl.value = "";

  const assistantBubble = addMessage("Thinking...", "assistant");

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
      await loadChats();
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

    assistantBubble.textContent = data.reply || "(No reply returned)";
    await loadChats();
  } catch (err) {
    assistantBubble.textContent = "Error: " + err.message;
  }
});

window.refreshChats = loadChats;
