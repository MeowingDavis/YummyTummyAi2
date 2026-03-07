// public/js/chat/drawer.js
import { refs } from "./state.js";

function isDrawerOpen() {
  return document.body.classList.contains('drawer-open');
}

export function openMobileSavedChats(){
  if (typeof window.renderMobileSavedChats === "function") window.renderMobileSavedChats();
  document.body.classList.add('drawer-open');
  refs.mobileBg?.classList.remove("hidden");
  refs.mobileModal?.classList.remove("hidden");
  refs.mobileBtn?.setAttribute("aria-expanded", "true");
  document.body.style.overflow = 'hidden';
}

export function hideMobileSavedChats(){
  document.body.classList.remove('drawer-open');
  refs.mobileBg?.classList.add("hidden");
  refs.mobileModal?.classList.add("hidden");
  refs.mobileBtn?.setAttribute("aria-expanded", "false");
  document.body.style.overflow = '';
}

export function toggleMobileSavedChats(){
  if (isDrawerOpen()) hideMobileSavedChats(); else openMobileSavedChats();
}

let drawerWired = false;
export function wireDrawer() {
  if (drawerWired) return;
  refs.mobileBtn   = document.getElementById('mobileMenuBtn');
  refs.mobileBg    = document.getElementById('mobileSavedModalBg');
  refs.mobileModal = document.getElementById('mobileSavedModal');
  refs.mobileClose = document.getElementById('mobileCloseBtn');

  if (!refs.mobileBtn || !refs.mobileBg || !refs.mobileModal) return;

  const onToggle = () => toggleMobileSavedChats();
  const onClose  = (e) => { e && e.preventDefault(); hideMobileSavedChats(); };

  refs.mobileBtn.addEventListener('click', onToggle);
  refs.mobileBg.addEventListener('click', onClose);
  refs.mobileClose?.addEventListener('click', onClose);

  // Close when clicking any link inside the drawer
  refs.mobileModal.addEventListener('click', (e) => {
    const link = e.target instanceof Element ? e.target.closest('a,button[type="submit"]') : null;
    if (link) hideMobileSavedChats();
  });

  // Esc to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isDrawerOpen()) hideMobileSavedChats();
  });

  drawerWired = true;
}
