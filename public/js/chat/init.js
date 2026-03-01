// public/js/chat/init.js
import { refs } from "./state.js";
import { hasPrivacyAck, loadDraft } from "./storage.js";
import { renderSavedChats, renderMobileSavedChats } from "./savedChats.js";
import { renderEmptyState } from "./ui.js";
import { wireDrawer } from "./drawer.js";
import { wireComposer, autoresize, refreshSendState } from "./chat.js";
import { initPrivacy } from "./privacy.js";

export function initCore() {
  try {
    refs.chatbox  = document.getElementById('chatbox');
    refs.typingEl = document.getElementById('typing');
    refs.tray     = document.getElementById('previewTray');
    refs.input    = document.getElementById('input');
    refs.sendBtn  = document.getElementById('sendBtn');
    refs.newChatBtn = document.getElementById('newChatBtn');
    refs.saveBtn  = document.getElementById('saveBtn');
    refs.refreshSavedBtn = document.getElementById('refreshSavedBtn');

    refs.newChatBtn?.addEventListener('click', window.newChat);
    refs.sendBtn?.addEventListener('click', window.send);
    refs.saveBtn?.addEventListener('click', window.saveChat);
    refs.refreshSavedBtn?.addEventListener('click', () => {
      renderSavedChats();
      renderMobileSavedChats();
    });

    if (hasPrivacyAck()) {
      refs.input.value = loadDraft();
    }
    if (refs.saveBtn && !hasPrivacyAck()) {
      refs.saveBtn.disabled = true;
      refs.saveBtn.title = "Acknowledge the privacy notice to enable saving.";
      refs.saveBtn.classList.add("opacity-50", "cursor-not-allowed");
    }

    wireComposer();
    renderSavedChats();
    renderMobileSavedChats();
    renderEmptyState();
    autoresize();
    refreshSendState();
  } catch (e) {
    console.error("[initCore] failed:", e);
  }
}

export function boot() {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initCore();
      initPrivacy();
      wireDrawer();
    }, { once: true });
  } else {
    initCore();
    initPrivacy();
    wireDrawer();
  }
}
