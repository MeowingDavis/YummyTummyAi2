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
    const account = document.getElementById('homeAccountBtn');
    const logout = document.getElementById('homeLogoutBtn');
    const accountMobile = document.getElementById('homeAccountBtnMobile');
    const loginMobile = document.getElementById('homeLoginBtnMobile');
    const logoutMobile = document.getElementById('homeLogoutBtnMobile');
    const loginBottom = document.getElementById('homeLoginBtnBottom');

    if (status) status.textContent = user ? `Signed in as ${user.email}` : 'Not signed in';
    reg?.classList.toggle('hidden', !!user);
    login?.classList.toggle('hidden', !!user);
    account?.classList.toggle('hidden', !user);
    logout?.classList.toggle('hidden', !user);
    accountMobile?.classList.toggle('hidden', !user);
    loginMobile?.classList.toggle('hidden', !!user);
    logoutMobile?.classList.toggle('hidden', !user);
    loginBottom?.classList.toggle('hidden', !!user);
  }

  function showAccountDeletedMessage() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('accountDeleted') !== '1') return;
    const host = document.getElementById('notice') || document.body;
    const wrap = document.createElement('div');
    wrap.className = 'skeuo-wrap skeuo-container-wide';
    wrap.innerHTML = `
      <div class="glass skeuo-surface skeuo-section-tight skeuo-card-pad text-sm text-emerald-200">
        Account deleted.
      </div>
    `;
    host.parentNode.insertBefore(wrap, host);
    params.delete('accountDeleted');
    const clean = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}${window.location.hash}`;
    history.replaceState(null, '', clean);
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
    try { await doLogout(); } catch (e2) { setHomeAuthUI(null); }
  });
  document.getElementById('homeLogoutBtnMobile')?.addEventListener('click', async (e) => {
    e.preventDefault();
    try { await doLogout(); } catch (e2) { setHomeAuthUI(null); }
  });

  refreshMe();
  showAccountDeletedMessage();

  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      if (id && id.length > 1) {
        const el = document.querySelector(id);
        if (el) {
          e.preventDefault();
          const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
        }
      }
    });
  });
});
