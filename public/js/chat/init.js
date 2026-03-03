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
    refs.mobileOptionsBtn = document.getElementById('mobileOptionsBtn');
    refs.mobileOptionsPanel = document.getElementById('mobileOptionsPanel');

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
    wireMobileOptionsMenu();
  } catch (e) {
    console.error("[initCore] failed:", e);
  }
}

function wireMobileOptionsMenu() {
  const btn = refs.mobileOptionsBtn;
  const panel = refs.mobileOptionsPanel;
  if (!btn || !panel) return;

  const open = () => {
    panel.classList.remove("hidden");
    btn.setAttribute("aria-expanded", "true");
  };

  const close = () => {
    panel.classList.add("hidden");
    btn.setAttribute("aria-expanded", "false");
  };

  const toggle = () => {
    if (panel.classList.contains("hidden")) open();
    else close();
  };

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    toggle();
  });

  document.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof Node)) return;
    if (panel.classList.contains("hidden")) return;
    if (panel.contains(target) || btn.contains(target)) return;
    close();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  panel.addEventListener("click", (e) => {
    const el = e.target instanceof Element ? e.target.closest("button,a") : null;
    if (!el) return;
    if (el.id === "mobileOptionsBtn" || el.id === "modelSelect") return;
    if (window.matchMedia("(max-width: 767px)").matches) close();
  });

  refs.modelSelect?.addEventListener("change", () => {
    if (window.matchMedia("(max-width: 767px)").matches) close();
  });
}

async function initModelPicker() {
  if (!refs.modelSelect) return;
  try {
    const res = await fetch("/chat-models");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const models = Array.isArray(data?.models) ? data.models : [];
    const defaultModel = typeof data?.defaultModel === "string" ? data.defaultModel : "";
    if (!models.length) throw new Error("No models configured");

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
  } catch {
    if (!refs.modelSelect.options.length) {
      const fallback = getSelectedModel() || "llama-3.1-8b-instant";
      refs.modelSelect.innerHTML = "";
      const opt = document.createElement("option");
      opt.value = fallback;
      opt.textContent = fallback;
      refs.modelSelect.appendChild(opt);
      refs.modelSelect.value = fallback;
      saveSelectedModel(fallback);
    }
  }
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
