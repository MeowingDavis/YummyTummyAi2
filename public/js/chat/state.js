// public/js/chat/state.js

export const KEYS = {
  DRAFT: "yt_ai_draft",
  PRIVACY_ACK: "yt_privacy_notice_dismissed_v1",
};

export const refs = {
  chatbox: null,
  typingEl: null,
  tray: null,
  input: null,
  sendBtn: null,
  newChatBtn: null,
  saveBtn: null,
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
