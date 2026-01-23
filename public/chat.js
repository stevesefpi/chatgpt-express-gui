import {
  getDOMElements,
  addMessage,
  clearMessages,
  setMessageHtml,
  renderChatList,
  fetchChats,
  fetchMessages,
  renderMessages,
  getCurrentTime,
  initializeModelMenu,
  deleteChat,
  openDeleteModal,
} from "./utils/chat_utils.js";

const {chatForm, promptEl, messagesEl, imagePreviewContainer, imagePreview, previewImage, removeImageBtn,chatListEl, newChatBtn, attachBtn, attachMenu, attachImageBtn, imageInput } = getDOMElements();

let currentChatId = null;
let selectedModel = localStorage.getItem("selectedModel") || "gpt-5.2";
let pendingImages = [];

initializeModelMenu(selectedModel);

async function refreshChats() {
  const chats = await fetchChats();
  renderChatList(chatListEl, chats, currentChatId, selectChat, handleDeleteChat);
}

async function selectChat(chatId) {
  currentChatId = chatId;

  const msgs = await fetchMessages(chatId);
  renderMessages(messagesEl, msgs);

  await refreshChats();
}

function handleDeleteChat(chatId) {
  openDeleteModal(async () => {
    try {
      await deleteChat(chatId);

      if (currentChatId === chatId) {
        currentChatId = null;
        clearMessages(messagesEl);
      }

      await refreshChats();
    } catch (err) {
      console.error("Delete error:", err);
      alert("Failed to delete chat: " + err.message);
    }
  });
}

function openAttachMenu() {
  if (!attachMenu) return;
  attachMenu.classList.add("open");
  attachBtn?.setAttribute("aria-expanded", "true");
  attachMenu.setAttribute("aria-hidden", "false");
}

function closeAttachMenu() {
  if (!attachMenu) return;

  if (attachMenu.contains(document.activeElement)) {
    attachBtn?.focus();
  }

  attachMenu.classList.remove("open");
  attachBtn?.setAttribute("aria-expanded", "false");
  attachMenu.setAttribute("aria-hidden", "true");
}

attachBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  if (attachMenu?.classList.contains("open")) closeAttachMenu();
  else openAttachMenu();
});

attachImageBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();

  closeAttachMenu();

  if (imageInput) {
    imageInput.value = "";
    setTimeout(() => {
      imageInput.click();
    }, 100);
  }
});

imageInput?.addEventListener("change", (e) => {
  const files = Array.from(imageInput.files || []);
  
  if (files.length === 0) return;
  
  // Add new files to pending images
  pendingImages.push(...files);
  
  // Render all previews
  renderImagePreviews();
  
  closeAttachMenu();
  
  // Clear input for next selection
  if (imageInput) imageInput.value = "";
});

function renderImagePreviews() {
  imagePreviewContainer.innerHTML = "";
  
  pendingImages.forEach((file, index) => {
    const imageUrl = URL.createObjectURL(file);
    
    const item = document.createElement("div");
    item.className = "image-preview-item";
    
    const img = document.createElement("img");
    img.src = imageUrl;
    img.alt = file.name;
    
    const removeBtn = document.createElement("button");
    removeBtn.className = "remove-btn";
    removeBtn.textContent = "×";
    removeBtn.type = "button";
    removeBtn.onclick = () => {
      pendingImages.splice(index, 1);
      URL.revokeObjectURL(imageUrl);
      renderImagePreviews();
    };
    
    item.appendChild(img);
    item.appendChild(removeBtn);
    imagePreviewContainer.appendChild(item);
  });
}

removeImageBtn?.addEventListener("click", () => {
  pendingImages = null;
  imagePreview.style.display = "none";
  previewImage.src = "";
  if (imageInput) imageInput.value = "";
});

// close when clicking elsewhere / escape
document.addEventListener("click", () => closeAttachMenu());
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeAttachMenu();
});

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
  
  if (!text && pendingImages.length === 0) {
    alert("Please enter a message or select an image");
    return;
  }

  const now = getCurrentTime();

  // Show user message with images
  if (pendingImages.length > 0) {
    const userBubble = addMessage(messagesEl, "", "user", now);
    const contentEl = userBubble.querySelector(".msg-content");
    
    const imagesHtml = pendingImages.map(file => {
      const url = URL.createObjectURL(file);
      return `<img class="chat-image" src="${url}" alt="Uploaded" style="max-width: 200px; border-radius: 8px; margin: 4px;" />`;
    }).join('');
    
    contentEl.innerHTML = `
      <div style="display: flex; flex-wrap: wrap; gap: 8px;">
        ${imagesHtml}
      </div>
      ${text ? `<p style="margin-top: 8px;">${text}</p>` : ''}
    `;
  } else {
    addMessage(messagesEl, text, "user", now);
  }

  promptEl.value = "";

  const assistantBubble = addMessage(messagesEl, "Thinking...", "assistant", now);

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

    // Convert all images to base64
    const imagesBase64 = await Promise.all(
      pendingImages.map(file => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result.split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      })
    );

    const response = await fetch("/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        message: text || "What's in these images?",
        chatId: currentChatId,
        model: localStorage.getItem("selectedModel") || "gpt-5.2",
        images: imagesBase64, // Send array of images
      }),
    });

    // Clear pending images
    pendingImages = [];
    imagePreviewContainer.innerHTML = "";

    const data = await response.json();

    if (!response.ok) throw new Error(data.error || "Request failed");

    if (data.type === "image") {
      const contentEl = assistantBubble.querySelector(".msg-content");
      contentEl.innerHTML = `<img class="chat-image" src="${data.url}" alt="Generated image" />`;
    } else {
      setMessageHtml(assistantBubble, data.reply || "(No reply returned)");
    }

    await refreshChats();
  } catch (err) {
    assistantBubble.textContent = "Error: " + err.message;
  }
});

window.refreshChats = refreshChats;
