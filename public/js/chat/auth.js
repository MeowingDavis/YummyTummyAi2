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

async function loginFlow() {
  const email = prompt("Email:", "");
  if (!email) return;
  const password = prompt("Password:", "");
  if (!password) return;
  await request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  await loadMe();
}

async function registerFlow() {
  const email = prompt("Email:", "");
  if (!email) return;
  const password = prompt("Password (min 8 chars):", "");
  if (!password) return;
  const name = prompt("Name (optional):", "") || undefined;
  await request("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });
  await loadMe();
}

async function logoutFlow() {
  await request("/auth/logout", { method: "POST" });
  await loadMe();
}

export async function initAuth() {
  refs.authStatus = document.getElementById("authStatus");
  refs.authRegisterBtn = document.getElementById("authRegisterBtn");
  refs.authLoginBtn = document.getElementById("authLoginBtn");
  refs.authLogoutBtn = document.getElementById("authLogoutBtn");

  refs.authRegisterBtn?.addEventListener("click", async () => {
    try {
      await registerFlow();
    } catch (err) {
      alert((err && err.message) || "Register failed");
    }
  });

  refs.authLoginBtn?.addEventListener("click", async () => {
    try {
      await loginFlow();
    } catch (err) {
      alert((err && err.message) || "Login failed");
    }
  });

  refs.authLogoutBtn?.addEventListener("click", async () => {
    try {
      await logoutFlow();
    } catch (err) {
      alert((err && err.message) || "Logout failed");
    }
  });

  try {
    await loadMe();
  } catch {
    setAuthUI(null);
  }
}
