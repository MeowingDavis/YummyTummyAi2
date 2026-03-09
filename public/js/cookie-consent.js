window.addEventListener("DOMContentLoaded", () => {
  const storageKey = "yt_cookie_consent_v1";
  const existing = window.localStorage.getItem(storageKey);
  if (existing === "accepted") return;

  const banner = document.createElement("section");
  banner.setAttribute("aria-label", "Cookie consent");
  banner.className = "fixed inset-x-3 bottom-3 z-[100] rounded-2xl border border-slate-700/70 bg-slate-950/92 p-4 text-slate-100 shadow-[0_20px_40px_rgba(15,23,42,0.55)] backdrop-blur-md sm:inset-x-auto sm:right-4 sm:w-[34rem]";

  const text = document.createElement("p");
  text.className = "text-sm leading-6";
  text.innerHTML = 'We use cookies for essential functions like login, sessions, saved chats, and security. By continuing with <strong>I Agree</strong>, you consent to this use. <a href="/about.html#privacy-section" class="underline decoration-emerald-300/70 hover:decoration-emerald-200">Learn more</a>.';

  const actions = document.createElement("div");
  actions.className = "mt-3 flex items-center gap-2";

  const agreeBtn = document.createElement("button");
  agreeBtn.type = "button";
  agreeBtn.className = "skeuo-btn skeuo-btn-primary skeuo-btn-sm";
  agreeBtn.textContent = "I Agree";
  agreeBtn.addEventListener("click", () => {
    window.localStorage.setItem(storageKey, "accepted");
    banner.remove();
  });

  const dismissBtn = document.createElement("button");
  dismissBtn.type = "button";
  dismissBtn.className = "skeuo-btn skeuo-btn-secondary skeuo-btn-sm";
  dismissBtn.textContent = "Not Now";
  dismissBtn.addEventListener("click", () => {
    banner.remove();
  });

  actions.appendChild(agreeBtn);
  actions.appendChild(dismissBtn);
  banner.appendChild(text);
  banner.appendChild(actions);
  document.body.appendChild(banner);
});
