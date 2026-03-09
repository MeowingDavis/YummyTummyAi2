window.addEventListener('DOMContentLoaded', () => {
  const shellEls = document.querySelectorAll('[data-auth-shell]');
  const statusEls = document.querySelectorAll('[data-auth-status]');
  const signedInEls = document.querySelectorAll('[data-auth="signed-in-only"]');
  const signedOutEls = document.querySelectorAll('[data-auth="signed-out-only"]');
  const emailEls = document.querySelectorAll('[data-auth-email]');
  const logoutEls = document.querySelectorAll('[data-auth-action="logout"]');
  const next = encodeURIComponent(window.location.pathname + window.location.search);

  async function request(url, options = {}) {
    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
    return data;
  }

  function setLoginLinks() {
    document.querySelectorAll('[data-auth-link="login"]').forEach((el) => {
      el.setAttribute('href', `/auth.html?mode=login&next=${next}`);
    });
    document.querySelectorAll('[data-auth-link="register"]').forEach((el) => {
      el.setAttribute('href', `/auth.html?mode=register&next=${next}`);
    });
  }

  function toggleVisibility(nodes, hidden) {
    nodes.forEach((el) => {
      el.classList.toggle('hidden', hidden);
      el.setAttribute('aria-hidden', hidden ? 'true' : 'false');
    });
  }

  function setReady() {
    shellEls.forEach((el) => {
      el.setAttribute('data-auth-ready', 'true');
    });
  }

  function setUI(user) {
    const signedIn = Boolean(user);
    statusEls.forEach((el) => {
      el.textContent = signedIn ? 'Signed in' : 'Sign in to save chats';
    });
    emailEls.forEach((el) => {
      const show = signedIn && Boolean(user?.email);
      el.textContent = show ? user.email : '';
      el.classList.toggle('hidden', !show);
      el.setAttribute('aria-hidden', show ? 'false' : 'true');
    });
    toggleVisibility(signedInEls, !signedIn);
    toggleVisibility(signedOutEls, signedIn);
    setReady();
  }

  async function init() {
    setLoginLinks();
    try {
      const me = await request('/me');
      setUI(me?.user || null);
    } catch {
      setUI(null);
    }
  }

  logoutEls.forEach((el) => {
    el.addEventListener('click', async (event) => {
      event.preventDefault();
      try {
        await request('/auth/logout', { method: 'POST' });
        setUI(null);
      } catch (error) {
        const msg = (error && error.message) || 'Logout failed';
        statusEls.forEach((statusEl) => {
          statusEl.textContent = msg;
        });
        setReady();
      }
    });
  });

  init();
});
