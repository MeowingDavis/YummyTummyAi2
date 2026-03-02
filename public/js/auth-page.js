window.addEventListener('DOMContentLoaded', () => {
  const tabLogin = document.getElementById('tabLogin');
  const tabRegister = document.getElementById('tabRegister');
  const form = document.getElementById('authForm');
  const email = document.getElementById('email');
  const name = document.getElementById('name');
  const password = document.getElementById('password');
  const confirmPassword = document.getElementById('confirmPassword');
  const confirmWrap = document.getElementById('confirmWrap');
  const submitBtn = document.getElementById('submitBtn');
  const errorEl = document.getElementById('authError');

  const params = new URLSearchParams(window.location.search);
  const next = params.get('next') || '/chat.html';
  let mode = params.get('mode') === 'login' ? 'login' : 'register';

  function setMode(nextMode) {
    mode = nextMode;
    const isLogin = mode === 'login';
    name.parentElement.classList.toggle('hidden', isLogin);
    confirmWrap.classList.toggle('hidden', isLogin);
    submitBtn.textContent = isLogin ? 'Login' : 'Create account';
    tabLogin.classList.toggle('skeuo-btn-primary', isLogin);
    tabRegister.classList.toggle('skeuo-btn-primary', !isLogin);
    tabLogin.classList.toggle('skeuo-btn-secondary', !isLogin);
    tabRegister.classList.toggle('skeuo-btn-secondary', isLogin);
    errorEl.classList.add('hidden');
    errorEl.textContent = '';

    const url = new URL(window.location.href);
    url.searchParams.set('mode', mode);
    url.searchParams.set('next', next);
    history.replaceState(null, '', url.toString());
  }

  async function request(url, options = {}) {
    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
    return data;
  }

  tabLogin?.addEventListener('click', () => setMode('login'));
  tabRegister?.addEventListener('click', () => setMode('register'));

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.classList.add('hidden');
    errorEl.textContent = '';

    const eVal = email.value.trim();
    const pVal = password.value;
    const nVal = name.value.trim();
    const cVal = confirmPassword.value;

    try {
      if (!eVal || !pVal) throw new Error('Email and password are required');
      if (mode === 'register' && pVal !== cVal) throw new Error('Passwords do not match');

      const path = mode === 'login' ? '/auth/login' : '/auth/register';
      const body = mode === 'login'
        ? { email: eVal, password: pVal }
        : { email: eVal, password: pVal, name: nVal || undefined };

      await request(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      window.location.href = next;
    } catch (err) {
      errorEl.textContent = err?.message || 'Authentication failed';
      errorEl.classList.remove('hidden');
    }
  });

  setMode(mode);
});
