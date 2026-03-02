// public/js/chat/chat.js
import { refs, state } from "./state.js";
import { appendMessage, appendMarkdown, showTyping, hideTyping, renderEmptyState, onFiles } from "./ui.js";
import { postJSON } from "./network.js";
import { saveDraft, clearDraft, saveSelectedModel } from "./storage.js";
import { uploadAll } from "./uploads.js";

export function refreshSendState() {
  refs.sendBtn.disabled = refs.input.value.trim().length === 0;
}

export function autoresize() {
  refs.input.style.height = "0px";
  const next = Math.min(refs.input.scrollHeight, 224);
  refs.input.style.height = next + "px";
}

export async function send(){
  const message = refs.input.value.trim();
  if (!message) return;
  const model = refs.modelSelect?.value || undefined;

  refs.sendBtn.disabled = true;

  const lowerMsg = message.toLowerCase();

  appendMessage("You", message);
  state.chatHistory.push({ role: "user", content: message });

  refs.input.value = "";
  clearDraft();
  autoresize();
  refreshSendState();

  const greetings = ["hi","hello","hey","greetings"];
  if (greetings.includes(lowerMsg)) {
    appendMessage("Chef", "Hey! Tell me what you're craving or what you have on hand.");
    refs.input.focus();
    return;
  }

  let attachments = [];
  try { attachments = await uploadAll(); }
  catch (e) { appendMessage("Error", "Attachment upload failed: " + e.message); }

  showTyping();
  try {
    const data = await postJSON("/chat", { message, attachments, model });
    const md = data?.markdown ?? data?.reply ?? "";
    if (data?.modelUsed && refs.modelSelect && refs.modelSelect.value !== data.modelUsed) {
      refs.modelSelect.value = data.modelUsed;
      saveSelectedModel(data.modelUsed);
    }
    if (md) {
      appendMarkdown("Chef", md);
      state.chatHistory.push({ role: "assistant", content: md });
    } else {
      appendMessage("Chef", "Hmm, I didn't get a response. Try again?");
    }
  } catch (err) {
    appendMessage("Error", err.message);
  } finally {
    hideTyping();
    refs.input.focus();
  }
}

export function newChat(){
  refs.chatbox.innerHTML = "";
  state.chatHistory = [];
  refs.input.value = "";
  clearDraft();
  autoresize();
  refreshSendState();
  renderEmptyState();
  refs.input.focus();
  postJSON("/chat", { message: "Let's start a new chat!", newChat: true, model: refs.modelSelect?.value || undefined }).catch(() => {});
}

export function wireComposer(){
  let composing = false;
  refs.input.addEventListener("compositionstart", () => composing = true);
  refs.input.addEventListener("compositionend",   () => composing = false);
  refs.input.addEventListener("input", () => {
    autoresize();
    refreshSendState();
    saveDraft(refs.input.value);
  });
  refs.input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !composing) {
      e.preventDefault();
      send();
    }
  });

  document.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if ((e.metaKey || e.ctrlKey) && k === "s") { e.preventDefault(); window.saveChat?.(); }
    if ((e.metaKey || e.ctrlKey) && k === "n") { e.preventDefault(); newChat(); }
  });

  document.addEventListener('paste', (e) => {
    const files = [...(e.clipboardData?.files || [])].filter(f => f.type.startsWith('image/'));
    if (files.length) onFiles(files);
  });

  refs.chatbox.addEventListener('dragover', e => e.preventDefault());
  refs.chatbox.addEventListener('drop', e => { e.preventDefault(); onFiles(e.dataTransfer?.files || []); });
}
