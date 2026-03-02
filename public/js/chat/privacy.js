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
      } catch (e) { console.warn("[privacy] dismiss failed:", e); }
    });

    learnBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      try {
        alert(
          "Where are chats stored?\n\n" +
          "• Saved chats are stored on the server by your session.\n" +
          "• Messages are sent to the AI service to generate replies.\n" +
          "• Conversation context is persisted server-side to keep chats working across refreshes.\n" +
          "• Using a different browser/device creates a new session until login is added.\n" +
          "• You can export a chat from the Saved Chats panel at any time."
        );
      } catch (e) { console.warn("[privacy] learn more failed:", e); }
    });
  } catch (e) {
    console.error("[initPrivacy] failed:", e);
  }
}
