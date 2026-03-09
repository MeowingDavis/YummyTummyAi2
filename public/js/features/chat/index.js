// public/js/features/chat/index.js
import { boot } from "./init.js";
import { send, newChat } from "./chat.js";
import { renderSavedChats, renderMobileSavedChats, saveChat, loadChat, deleteChat, exportChat } from "./savedChats.js";
import { openMobileSavedChats, hideMobileSavedChats, toggleMobileSavedChats } from "./drawer.js";

window.send = send;
window.newChat = newChat;
window.renderSavedChats = renderSavedChats;
window.renderMobileSavedChats = renderMobileSavedChats;
window.saveChat = saveChat;
window.loadChat = loadChat;
window.deleteChat = deleteChat;
window.exportChat = exportChat;
window.openMobileSavedChats = openMobileSavedChats;
window.hideMobileSavedChats = hideMobileSavedChats;
window.toggleMobileSavedChats = toggleMobileSavedChats;

boot();
