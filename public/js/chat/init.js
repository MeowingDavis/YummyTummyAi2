// public/js/chat/init.js
import { refs } from "./state.js";
import { getSelectedModel, loadDraft, saveSelectedModel } from "./storage.js";
import { renderSavedChats, renderMobileSavedChats } from "./savedChats.js";
import { renderEmptyState } from "./ui.js";
import { wireDrawer } from "./drawer.js";
import { wireComposer, autoresize, refreshSendState } from "./chat.js";
import { initPrivacy } from "./privacy.js";
import { initAuth } from "./auth.js";

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
    refs.modelSelect = document.getElementById('modelSelect');

    refs.newChatBtn?.addEventListener('click', window.newChat);
    refs.sendBtn?.addEventListener('click', window.send);
    refs.saveBtn?.addEventListener('click', window.saveChat);
    refs.refreshSavedBtn?.addEventListener('click', async () => {
      await renderSavedChats();
      await renderMobileSavedChats();
    });
    refs.modelSelect?.addEventListener("change", () => {
      saveSelectedModel(refs.modelSelect.value);
    });

    refs.input.value = loadDraft();

    wireComposer();
    initModelPicker();
    renderSavedChats();
    renderMobileSavedChats();
    renderEmptyState();
    autoresize();
    refreshSendState();
  } catch (e) {
    console.error("[initCore] failed:", e);
  }
}

async function initModelPicker() {
  if (!refs.modelSelect) return;
  try {
    const res = await fetch("/chat-models");
    if (!res.ok) return;
    const data = await res.json();
    const models = Array.isArray(data?.models) ? data.models : [];
    const defaultModel = typeof data?.defaultModel === "string" ? data.defaultModel : "";
    if (!models.length) return;

    refs.modelSelect.innerHTML = "";
    for (const model of models) {
      const opt = document.createElement("option");
      opt.value = model;
      opt.textContent = model;
      refs.modelSelect.appendChild(opt);
    }

    const saved = getSelectedModel();
    const selected = models.includes(saved) ? saved : (models.includes(defaultModel) ? defaultModel : models[0]);
    refs.modelSelect.value = selected;
    saveSelectedModel(selected);
  } catch {}
}

export function boot() {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initCore();
      initPrivacy();
      initAuth();
      wireDrawer();
    }, { once: true });
  } else {
    initCore();
    initPrivacy();
    initAuth();
    wireDrawer();
  }
}
