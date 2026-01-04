const chatForm = document.getElementById("chatForm");
const promptEl = document.getElementById("prompt");
const messagesEl = document.getElementById("messages");

function addMessage(text, role) {
  const div = document.createElement("div");
  div.className = `message ${role}`;
  div.textContent = text;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return div;
}

let currentChatId = null;

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
      assistantBubble.textContent =
        "Session expired, please log in again.";
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
  } catch (err) {
    assistantBubble.textContent = "Error: " + err.message;
  }
});
