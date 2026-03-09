// public/js/features/chat/state.js

export const refs = {
  chatbox: null,
  typingEl: null,
  tray: null,
  input: null,
  commandPreview: null,
  sendBtn: null,
  newChatBtn: null,
  saveBtn: null,
  refreshSavedBtn: null,
  modelSelect: null,
  currentUser: null,
  mobileBtn: null,
  mobileBg: null,
  mobileModal: null,
  mobileClose: null,
  mobileOptionsBtn: null,
  mobileOptionsPanel: null,
  mobileOptionsBg: null,
  mobileOptionsCloseBtn: null,
  mobileOptionsHeader: null,
};

export const state = {
  chatHistory: [],
  pendingFiles: [],
  composing: false,
};

export function setRef(key, value) {
  refs[key] = value;
}
