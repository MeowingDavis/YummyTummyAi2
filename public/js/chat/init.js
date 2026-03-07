// public/js/chat/init.js
import { refs } from "./state.js";
import { getSelectedModel, loadDraft, saveSelectedModel } from "./storage.js";
import { renderSavedChats, renderMobileSavedChats } from "./savedChats.js";
import { renderEmptyState } from "./ui.js";
import { wireDrawer } from "./drawer.js";
import { wireComposer, autoresize, refreshSendState } from "./chat.js";
import { initPrivacy } from "./privacy.js";
import { initAuth } from "./auth.js";

function initCore() {
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
    refs.mobileOptionsBg = document.getElementById('mobileOptionsBg');
    refs.mobileOptionsCloseBtn = document.getElementById('mobileOptionsCloseBtn');
    refs.mobileOptionsHeader = document.getElementById('mobileOptionsHeader');

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
  const bg = refs.mobileOptionsBg;
  const closeBtn = refs.mobileOptionsCloseBtn;
  const mobileHeader = refs.mobileOptionsHeader;
  if (!btn || !panel || !bg) return;

  const isMobile = () => window.matchMedia("(max-width: 767px)").matches;
  const mobilePanelClasses = [
    "fixed", "inset-x-0", "bottom-0", "z-50", "max-h-[86dvh]",
    "overflow-y-auto", "rounded-t-2xl", "border", "border-slate-700/80",
    "bg-slate-900", "p-4", "pb-[calc(1rem+env(safe-area-inset-bottom))]",
    "shadow-2xl", "flex-col", "gap-2",
  ];

  const applyMobileShell = () => {
    panel.classList.add(...mobilePanelClasses);
    mobileHeader?.classList.remove("hidden");
    mobileHeader?.classList.add("flex");
  };

  const removeMobileShell = () => {
    panel.classList.remove(...mobilePanelClasses);
    mobileHeader?.classList.remove("flex");
    mobileHeader?.classList.add("hidden");
  };

  const open = () => {
    if (!isMobile()) return;
    applyMobileShell();
    panel.classList.remove("hidden");
    panel.classList.add("flex");
    bg.classList.remove("hidden");
    btn.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
  };

  const close = () => {
    if (isMobile()) {
      panel.classList.add("hidden");
      panel.classList.remove("flex");
      bg.classList.add("hidden");
      removeMobileShell();
      document.body.style.overflow = "";
    }
    btn.setAttribute("aria-expanded", "false");
  };

  const toggle = () => {
    if (!isMobile()) return;
    if (panel.classList.contains("hidden")) open();
    else close();
  };

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    toggle();
  });

  bg.addEventListener("click", () => close());
  closeBtn?.addEventListener("click", () => close());

  document.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof Node)) return;
    if (!isMobile()) return;
    if (panel.classList.contains("hidden")) return;
    if (panel.contains(target) || btn.contains(target)) return;
    close();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isMobile()) close();
  });

  window.addEventListener("resize", () => {
    if (!isMobile()) {
      panel.classList.remove("hidden");
      panel.classList.remove("flex");
      bg.classList.add("hidden");
      removeMobileShell();
      document.body.style.overflow = "";
      btn.setAttribute("aria-expanded", "false");
      return;
    }
    if (panel.classList.contains("hidden")) {
      removeMobileShell();
      bg.classList.add("hidden");
      document.body.style.overflow = "";
    }
  });

  panel.addEventListener("click", (e) => {
    const el = e.target instanceof Element ? e.target.closest("button,a") : null;
    if (!el) return;
    if (el.id === "mobileOptionsBtn" || el.id === "mobileOptionsCloseBtn") return;
    if (isMobile()) close();
  });

  refs.modelSelect?.addEventListener("change", () => {
    if (isMobile()) close();
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
