// public/js/chat/privacy.js
import { refs } from "./state.js";
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
        if (refs.saveBtn) {
          refs.saveBtn.disabled = false;
          refs.saveBtn.title = "Save chat";
          refs.saveBtn.classList.remove("opacity-50", "cursor-not-allowed");
        }
      } catch (e) { console.warn("[privacy] dismiss failed:", e); }
    });

    learnBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      try {
        alert(
          "Where are chats stored?\n\n" +
          "• Saved chats live in your browser's local storage on this device.\n" +
          "• Messages are sent to the AI service to generate replies.\n" +
          "• Live chat context is held briefly in server memory to keep the conversation flowing.\n" +
          "• Clearing site data or using a different browser/device will remove them.\n" +
          "• You can export a chat from the Saved Chats panel at any time."
        );
      } catch (e) { console.warn("[privacy] learn more failed:", e); }
    });
  } catch (e) {
    console.error("[initPrivacy] failed:", e);
  }
}
