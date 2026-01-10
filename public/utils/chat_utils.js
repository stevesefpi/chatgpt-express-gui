export function addMessage(messagesEl, text, role) {
  const div = document.createElement("div");
  div.className = `message ${role}`;

  const html = window.DOMPurify.sanitize(window.marked.parse(text));
  div.innerHTML = html;

  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return div;
}

export function clearMessages(messagesEl) {
  messagesEl.innerHTML = "";
}

export async function fetchChats() {
  const token = await window.getAccessToken?.();
  if (!token) throw new Error("Not logged in");

  const res = await fetch("/chats", {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to load chats");
  return data.chats || [];
}

export function renderChatList(chatListEl, chats, currentChatId, onSelectChat) {
  chatListEl.innerHTML = "";

  for (const chat of chats) {
    const item = document.createElement("div");
    item.className = "chat-item";
    item.textContent = chat.title || "Untitled chat";
    item.dataset.chatId = chat.id;

    if (chat.id === currentChatId) item.classList.add("active");

    item.addEventListener("click", () => onSelectChat(chat.id));
    chatListEl.appendChild(item);
  }
}

export async function fetchMessages(chatId) {
  const token = await window.getAccessToken?.();
  if (!token) throw new Error("Not logged in");

  const res = await fetch(`/chats/${chatId}/messages`, {
    headers: { Authorization: `Bearer ${token}` }, // ✅ no trailing space
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to load messages");
  return data.messages || [];
}

export function renderMessages(messagesEl, messages) {
  clearMessages(messagesEl);
  for (const m of messages) {
    addMessage(messagesEl, m.content, m.role);
  }
}
