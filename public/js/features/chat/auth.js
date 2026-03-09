import { refs } from "./state.js";
import { renderSavedChats, renderMobileSavedChats } from "./savedChats.js";

async function request(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

function toggleVisibility(nodes, hidden) {
  nodes.forEach((el) => {
    el.classList.toggle("hidden", hidden);
    el.setAttribute("aria-hidden", hidden ? "true" : "false");
  });
}

function statusNodes() {
  return document.querySelectorAll("[data-chat-auth-status]");
}

function emailNodes() {
  return document.querySelectorAll("[data-chat-auth-email]");
}

function shellNodes() {
  return document.querySelectorAll("[data-chat-auth-shell]");
}

function signedOutNodes() {
  return document.querySelectorAll('[data-chat-auth-state="signed-out"]');
}

function signedInNodes() {
  return document.querySelectorAll('[data-chat-auth-state="signed-in"]');
}

function setAuthUI(user) {
  refs.currentUser = user || null;
  const signedIn = Boolean(user);

  statusNodes().forEach((el) => {
    el.textContent = signedIn ? "Signed in" : "Sign in to save chats";
  });
  emailNodes().forEach((el) => {
    const show = signedIn && Boolean(user?.email);
    el.textContent = show ? user.email : "";
    el.classList.toggle("hidden", !show);
    el.setAttribute("aria-hidden", show ? "false" : "true");
  });
  toggleVisibility(signedOutNodes(), signedIn);
  toggleVisibility(signedInNodes(), !signedIn);
  shellNodes().forEach((el) => {
    el.setAttribute("data-auth-ready", "true");
  });

  if (refs.saveBtn) {
    refs.saveBtn.disabled = !user;
    refs.saveBtn.title = user ? "Save chat" : "Login to save chats";
    refs.saveBtn.classList.toggle("opacity-50", !user);
    refs.saveBtn.classList.toggle("cursor-not-allowed", !user);
  }
}

async function loadMe() {
  const data = await request("/me");
  setAuthUI(data?.user ?? null);
  await renderSavedChats();
  await renderMobileSavedChats();
}

function goToAuth(mode) {
  const next = encodeURIComponent("/chat.html");
  window.location.href = `/auth.html?mode=${encodeURIComponent(mode)}&next=${next}`;
}

async function logoutFlow() {
  await request("/auth/logout", { method: "POST" });
  await loadMe();
}

function setErrorStatus(message) {
  statusNodes().forEach((el) => {
    el.textContent = message;
  });
  shellNodes().forEach((el) => {
    el.setAttribute("data-auth-ready", "true");
  });
}

export async function initAuth() {
  document.querySelectorAll('[data-chat-auth-action="register"]').forEach((el) => {
    el.addEventListener("click", async () => {
      goToAuth("register");
    });
  });

  document.querySelectorAll('[data-chat-auth-action="login"]').forEach((el) => {
    el.addEventListener("click", async () => {
      goToAuth("login");
    });
  });

  document.querySelectorAll('[data-chat-auth-action="logout"]').forEach((el) => {
    el.addEventListener("click", async () => {
      try {
        await logoutFlow();
      } catch (err) {
        setErrorStatus((err && err.message) || "Logout failed");
      }
    });
  });

  document.querySelectorAll('[data-chat-auth-action="account"]').forEach((el) => {
    el.addEventListener("click", async () => {
      window.location.href = "/account.html";
    });
  });

  try {
    await loadMe();
  } catch {
    setAuthUI(null);
  }
}
