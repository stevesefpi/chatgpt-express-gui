const form = document.getElementById("chatForm");
const prompt = document.getElementById("prompt");
const messages = document.getElementById("messages");

function addMessage(text, role) {
    const div = document.createElement("div");
    div.className = `message ${role}`;
    div.textContent = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    return div;
}

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const text = prompt.value.trim();
    if (!text) return;

    addMessage(text, "user");

    prompt.value = "";

    const assistantBubble = addMessage("Thinking...", "assistant");

    try {
      const response = await fetch("/chat", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: text }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Request failed");
      }

      assistantBubble.textContent = data.reply || "(No reply returned)";
    } catch (err) {
      assistantBubble.textContent = "Error: " + err.message;
    }
})