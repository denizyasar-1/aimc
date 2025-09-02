const chatBox = document.getElementById("chat-box");
const messageInput = document.getElementById("message-input");
const sendBtn = document.getElementById("send-btn");
const systemPromptInput = document.getElementById("system-prompt-input");
const updatePromptBtn = document.getElementById("update-prompt-btn");

function appendMessage(sender, text) {
  const msg = document.createElement("div");
  msg.classList.add("message", sender);
  msg.textContent = text;
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
}

sendBtn.addEventListener("click", async () => {
  const message = messageInput.value.trim();
  if (!message) return;

  appendMessage("user", message);
  messageInput.value = "";

  appendMessage("ai", "✍️ Düşünüyor...");

  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message })
  });

  const data = await response.json();
  chatBox.lastChild.remove();
  appendMessage("ai", data.response);
});

updatePromptBtn.addEventListener("click", async () => {
  const newPrompt = systemPromptInput.value.trim();
  if (!newPrompt) return;

  await fetch("/api/set-prompt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: newPrompt })
  });

  alert("✅ Sistem promptu güncellendi!");
});
