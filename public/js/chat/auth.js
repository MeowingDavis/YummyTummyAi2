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

function setAuthUI(user) {
  refs.currentUser = user || null;

  if (refs.authStatus) {
    refs.authStatus.textContent = user ? `Signed in as ${user.email}` : "Not signed in";
    refs.authStatus.classList.toggle("hidden", false);
  }

  refs.authRegisterBtn?.classList.toggle("hidden", !!user);
  refs.authLoginBtn?.classList.toggle("hidden", !!user);
  refs.authAccountBtn?.classList.toggle("hidden", !user);
  refs.authLogoutBtn?.classList.toggle("hidden", !user);

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

export async function initAuth() {
  refs.authStatus = document.getElementById("authStatus");
  refs.authRegisterBtn = document.getElementById("authRegisterBtn");
  refs.authLoginBtn = document.getElementById("authLoginBtn");
  refs.authAccountBtn = document.getElementById("authAccountBtn");
  refs.authLogoutBtn = document.getElementById("authLogoutBtn");

  refs.authRegisterBtn?.addEventListener("click", async () => {
    goToAuth("register");
  });

  refs.authLoginBtn?.addEventListener("click", async () => {
    goToAuth("login");
  });

  refs.authLogoutBtn?.addEventListener("click", async () => {
    try {
      await logoutFlow();
    } catch (err) {
      alert((err && err.message) || "Logout failed");
    }
  });

  refs.authAccountBtn?.addEventListener("click", async () => {
    window.location.href = "/account.html";
  });

  try {
    await loadMe();
  } catch {
    setAuthUI(null);
  }
}
