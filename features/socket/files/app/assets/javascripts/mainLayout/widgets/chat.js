document.addEventListener("DOMContentLoaded", () => {
  const chatButton = document.getElementById("chat-widget-button");
  const chatPopup = document.getElementById("chat-popup");
  const closeChatButton = document.getElementById("close-chat-popup");

  if (!chatButton || !chatPopup || !closeChatButton) return;

  chatButton.addEventListener("click", () => {
    chatPopup.style.display = "flex";
    chatButton.style.display = "none";
  });

  closeChatButton.addEventListener("click", () => {
    chatPopup.style.display = "none";
    chatButton.style.display = "flex";
  });

  if (typeof io === "undefined") {
    console.warn("[chat] socket.io client not loaded");
    return;
  }

  const socket = io();
  const messages = chatPopup.querySelector("#messages");
  const form = chatPopup.querySelector("#chat-form");
  const input = chatPopup.querySelector("#message-input");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    socket.emit("chat:message", { content: text });
    input.value = "";
  });

  socket.on("chat:message", (data) => {
    const item = document.createElement("div");
    item.className = "chat-msg";
    const name =
      data.user && typeof data.user === "object" && data.user.name
        ? data.user.name
        : "Someone";
    const time = data.timestamp
      ? new Date(data.timestamp).toLocaleTimeString()
      : "";
    item.innerHTML = `<div><strong>${escapeHtml(name)}:</strong> ${escapeHtml(data.content || "")}</div><div class="chat-msg__meta">${escapeHtml(time)}</div>`;
    messages.appendChild(item);
    messages.scrollTop = messages.scrollHeight;
  });

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
});
