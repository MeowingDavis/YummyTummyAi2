// public/js/chat/state.js

export const refs = {
  chatbox: null,
  typingEl: null,
  tray: null,
  input: null,
  sendBtn: null,
  newChatBtn: null,
  saveBtn: null,
  refreshSavedBtn: null,
  modelSelect: null,
  authStatus: null,
  authRegisterBtn: null,
  authLoginBtn: null,
  authAccountBtn: null,
  authLogoutBtn: null,
  currentUser: null,
  mobileBtn: null,
  mobileBg: null,
  mobileModal: null,
  mobileClose: null,
};

export const state = {
  chatHistory: [],
  pendingFiles: [],
  composing: false,
};

export function setRef(key, value) {
  refs[key] = value;
}
