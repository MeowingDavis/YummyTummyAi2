window.addEventListener('DOMContentLoaded', () => {
  async function authRequest(url, options = {}) {
    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
    return data;
  }

  function setHomeAuthUI(user) {
    const status = document.getElementById('homeAuthStatus');
    const reg = document.getElementById('homeRegisterBtn');
    const login = document.getElementById('homeLoginBtn');
    const logout = document.getElementById('homeLogoutBtn');
    const loginMobile = document.getElementById('homeLoginBtnMobile');
    const logoutMobile = document.getElementById('homeLogoutBtnMobile');

    if (status) status.textContent = user ? `Signed in as ${user.email}` : 'Not signed in';
    reg?.classList.toggle('hidden', !!user);
    login?.classList.toggle('hidden', !!user);
    logout?.classList.toggle('hidden', !user);
    loginMobile?.classList.toggle('hidden', !!user);
    logoutMobile?.classList.toggle('hidden', !user);
  }

  async function refreshMe() {
    try {
      const data = await authRequest('/me');
      setHomeAuthUI(data?.user ?? null);
    } catch {
      setHomeAuthUI(null);
    }
  }

  function goToAuth(mode) {
    const next = encodeURIComponent(window.location.pathname || '/');
    window.location.href = `/auth.html?mode=${encodeURIComponent(mode)}&next=${next}`;
  }

  async function doLogout() {
    await authRequest('/auth/logout', { method: 'POST' });
    await refreshMe();
  }

  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const noticeEl = document.getElementById('notice');
  const btn = document.getElementById('noticeDismiss');
  btn?.addEventListener('click', () => {
    if (noticeEl) noticeEl.style.display = 'none';
  });

  const privacyEl = document.getElementById('privacyNoticeHome');
  const privacyBtn = document.getElementById('privacyDismissHome');
  privacyBtn?.addEventListener('click', () => {
    if (privacyEl) privacyEl.style.display = 'none';
  });

  document.getElementById('homeRegisterBtn')?.addEventListener('click', async (e) => {
    e.preventDefault();
    goToAuth('register');
  });
  document.getElementById('homeLoginBtn')?.addEventListener('click', async (e) => {
    e.preventDefault();
    goToAuth('login');
  });
  document.getElementById('homeLoginBtnMobile')?.addEventListener('click', async (e) => {
    e.preventDefault();
    goToAuth('login');
  });
  document.getElementById('homeLogoutBtn')?.addEventListener('click', async (e) => {
    e.preventDefault();
    try { await doLogout(); } catch (e2) { alert(e2.message || 'Logout failed'); }
  });
  document.getElementById('homeLogoutBtnMobile')?.addEventListener('click', async (e) => {
    e.preventDefault();
    try { await doLogout(); } catch (e2) { alert(e2.message || 'Logout failed'); }
  });

  refreshMe();

  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      if (id && id.length > 1) {
        const el = document.querySelector(id);
        if (el) {
          e.preventDefault();
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  });
});
