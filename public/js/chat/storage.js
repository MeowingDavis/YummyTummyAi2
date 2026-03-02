let draftValue = "";
let selectedModel = "";
let privacySeen = false;

export function hasPrivacyAck() {
  return privacySeen;
}

export function savePrivacyAck() {
  privacySeen = true;
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
