let draftValue = "";
let selectedModel = "";
let privacySeen = false;
const PRIVACY_ACK_KEY = "yta_privacy_ack_v1";

function getStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function hasPrivacyAck() {
  const storage = getStorage();
  if (storage) {
    const raw = storage.getItem(PRIVACY_ACK_KEY);
    if (raw === "1") {
      privacySeen = true;
      return true;
    }
  }
  return privacySeen;
}

export function savePrivacyAck() {
  privacySeen = true;
  const storage = getStorage();
  if (storage) storage.setItem(PRIVACY_ACK_KEY, "1");
}

export function saveDraft(value) {
  draftValue = String(value ?? "");
}

export function clearDraft() {
  draftValue = "";
}

export function loadDraft() {
  return draftValue;
}

export function getSelectedModel() {
  return selectedModel;
}

export function saveSelectedModel(model) {
  if (!model) return;
  selectedModel = model;
}
