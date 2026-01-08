export function addMessage(message, text, role) {
  const div = document.createElement("div");
  div.className = `message ${role}`;

  const html = window.DOMPurify.sanitize(window.marked.parse(text));

  div.innerHTML = html;

  message.appendChild(div);
  message.scrollTop = message.scrollHeight;
  return div;
}

export function clearMessages(message) {
  message.innerHTML = "";
}

// export function renderChatList(currentChatId, listEl, chats) {
//   listEl.innerHTML = "";

//   for (const chat of chats) {
//     const item = document.createElement("div");
//     item.className = "chat-item";
//     item.textContent = chat.title || "Untitled chat";
//     item.dataset.chatId = chat.id;

//     if (chat.id === currentChatId) {
//       item.classList.add("active");
//     }

//     item.addEventListener("click", async () => {
//       await selectChat(chat.id);
//     });

//     listEl.appendChild(item);
//   }
// }