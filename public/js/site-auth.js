window.addEventListener('DOMContentLoaded', () => {
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

  function setUI(user) {
    const signedIn = Boolean(user);
    statusEls.forEach((el) => {
      el.textContent = signedIn ? `Signed in as ${user.email}` : 'Not signed in';
    });
    emailEls.forEach((el) => {
      el.textContent = user?.email || '';
    });
    toggleVisibility(signedInEls, !signedIn);
    toggleVisibility(signedOutEls, signedIn);
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
      }
    });
  });

  init();
});
