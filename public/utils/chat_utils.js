export function addMessage(messagesEl, text, role, date) {
  // Create a wrapper for message content (div) and timestamp (span)
  const wrapper = document.createElement("div");
  wrapper.className = `message ${role}`;

  const content = document.createElement("div");
  content.className = "msg-content";

  const timestamp = document.createElement("span");
  timestamp.className = "timestamp";

  const html = window.DOMPurify.sanitize(window.marked.parse(text || ""));
  content.innerHTML = html;

  // Change date into readable format

  let timeText = "";

  // If the date already looks like "hh:mm", no change is needed
  if (typeof date === "string" && /^\d{2}:\d{2}$/.test(date)) {
    timeText = date;
  } else if (date) {
    // Otherwise parse Supabase timestamp into the hh:mm format
    const iso_format = String(date).replace(" ", "T");
    const d = new Date(iso_format);

    if (!Number.isNaN(d.getTime())) {
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      timeText = `${hh}:${mm}`;
    }
  }

  timestamp.textContent = timeText;

  wrapper.appendChild(content);
  wrapper.appendChild(timestamp);

  messagesEl.appendChild(wrapper);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  return wrapper;
}

export function setMessageHtml(el, text) {
  const contentEl = el.querySelector(".msg-content");
  if (!contentEl) return;

  const html = window.DOMPurify.sanitize(window.marked.parse(text || ""));
  contentEl.innerHTML = html;
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

  for (const message of messages) {
    const content = message.content;

    // Detect stored JSON payload (image)
    if (typeof content === "string") {
      const s = content.trim();
      if (s.startsWith("{")) {
        try {
          const obj = JSON.parse(s);

          // ✅ NEW: render by URL (no base64)
          if (obj?.type === "image" && obj?.url) {
            const wrapper = addMessage(
              messagesEl,
              "",
              message.role,
              message.created_at
            );
            const contentEl = wrapper.querySelector(".msg-content");

            const captionHtml = obj.caption
              ? window.DOMPurify.sanitize(window.marked.parse(obj.caption))
              : "";

            contentEl.innerHTML = `
              <img class="chat-image" src="${obj.url}" alt="Generated image" />
              ${
                captionHtml
                  ? `<div class="img-caption">${captionHtml}</div>`
                  : ""
              }
            `;
            continue;
          }
        } catch (err) {
          console.log(err);
        }
      }
    }

    // Normal text message
    addMessage(messagesEl, content, message.role, message.created_at);
  }
}

export function getCurrentTime() {
  const date = new Date();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

// Model selection utils

export function setSelectedModel(model) {
  localStorage.setItem("selectedModel", model);

  const label = document.getElementById("modelLabel");
  if (label) label.textContent = model.toUpperCase().replace("GPT-", "GPT-");

  const items = document.querySelectorAll(".model-item");
  items.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.model === model);
  });
}

export function initializeModelMenu(selectedModel) {
  const modelButton = document.getElementById("modelButton");
  const menu = document.getElementById("model-menu");

  if (!modelButton || !menu) return;

  setSelectedModel(selectedModel);

  function openMenu() {
    menu.classList.add("open");
    modelButton.setAttribute("aria-expanded", "true");
    menu.setAttribute("aria-hidden", "false");
  }

  function closeMenu() {
    menu.classList.remove("open");
    modelButton.setAttribute("aria-expanded", "false");
    menu.setAttribute("aria-hidden", "true");
  }

  modelButton.addEventListener("click", (event) => {
    event.stopPropagation();
    if (menu.classList.contains("open")) closeMenu();
    else openMenu();
  });

  menu.addEventListener("click", (event) => {
    const item = event.target.closest(".model-item");
    if (!item) return;
    setSelectedModel(item.dataset.model);
    closeMenu();
  });

  document.addEventListener("click", () => closeMenu());

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  })
}