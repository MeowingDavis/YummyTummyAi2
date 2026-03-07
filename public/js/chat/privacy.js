// public/js/chat/privacy.js
import { hasPrivacyAck, savePrivacyAck } from "./storage.js";
import { renderSavedChats, renderMobileSavedChats } from "./savedChats.js";

export function initPrivacy(){
  try {
    const notice = document.getElementById("privacyNotice");
    const dismissBtn = document.getElementById("privacyDismiss");
    const learnBtn = document.getElementById("privacyLearnMore");

    if (!notice) return;

    const seen = hasPrivacyAck();
    if (!seen) notice.classList.remove("hidden");

    dismissBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      try {
        savePrivacyAck();
        notice.classList.add("hidden");
        renderSavedChats();
        renderMobileSavedChats();
      } catch (e) { console.warn("[privacy] dismiss failed:", e); }
    });

    learnBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      try {
        window.location.href = "/about.html#privacy-section";
      } catch (e) { console.warn("[privacy] learn more failed:", e); }
    });
  } catch (e) {
    console.error("[initPrivacy] failed:", e);
  }
}
