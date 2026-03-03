window.addEventListener('DOMContentLoaded', () => {
  const tabLogin = document.getElementById('tabLogin');
  const tabRegister = document.getElementById('tabRegister');
  const form = document.getElementById('authForm');
  const email = document.getElementById('email');
  const name = document.getElementById('name');
  const password = document.getElementById('password');
  const confirmPassword = document.getElementById('confirmPassword');
  const togglePassword = document.getElementById('togglePassword');
  const toggleConfirmPassword = document.getElementById('toggleConfirmPassword');
  const confirmWrap = document.getElementById('confirmWrap');
  const passwordGuidance = document.getElementById('passwordGuidance');
  const passwordStrength = document.getElementById('passwordStrength');
  const pwLen = document.getElementById('pwLen');
  const pwLower = document.getElementById('pwLower');
  const pwUpper = document.getElementById('pwUpper');
  const pwDigit = document.getElementById('pwDigit');
  const pwSymbol = document.getElementById('pwSymbol');
  const submitBtn = document.getElementById('submitBtn');
  const errorEl = document.getElementById('authError');
  const successEl = document.getElementById('authSuccess');
  const forgotPasswordLink = document.getElementById('forgotPasswordLink');
  const switchModeBtn = document.getElementById('switchModeBtn');

  const params = new URLSearchParams(window.location.search);
  const nextRaw = params.get('next') || '/chat.html';
  let next = '/chat.html';
  try {
    next = decodeURIComponent(nextRaw || '/chat.html');
  } catch {
    next = nextRaw || '/chat.html';
  }
  if (!next || !next.startsWith('/')) next = '/chat.html';
  let mode = params.get('mode') === 'register' ? 'register' : 'login';
  let submitting = false;

  function showError(message) {
    if (!errorEl) return;
    errorEl.textContent = message || 'Authentication failed';
    errorEl.classList.remove('hidden');
    successEl?.classList.add('hidden');
    if (successEl) successEl.textContent = '';
  }

  function showSuccess(message) {
    if (!successEl) return;
    successEl.textContent = message || '';
    successEl.classList.remove('hidden');
    errorEl?.classList.add('hidden');
    if (errorEl) errorEl.textContent = '';
  }

  function clearMessages() {
    errorEl?.classList.add('hidden');
    successEl?.classList.add('hidden');
    if (errorEl) errorEl.textContent = '';
    if (successEl) successEl.textContent = '';
  }

  function setSubmitting(isBusy) {
    submitting = isBusy;
    if (!submitBtn) return;
    submitBtn.disabled = isBusy;
    if (isBusy) {
      submitBtn.textContent = 'Please wait...';
      return;
    }
    submitBtn.textContent = mode === 'login' ? 'Login' : 'Create account';
  }

  function evaluatePassword(pw) {
    const checks = {
      len: pw.length >= 8,
      lower: /[a-z]/.test(pw),
      upper: /[A-Z]/.test(pw),
      digit: /\d/.test(pw),
      symbol: /[^A-Za-z0-9]/.test(pw),
    };
    const score = Object.values(checks).filter(Boolean).length;
    const strength = score <= 2 ? 'Weak' : (score <= 4 ? 'Medium' : 'Strong');
    return { checks, strength };
  }

  function markCheck(el, ok) {
    if (!el) return;
    el.classList.toggle('text-emerald-300', ok);
    el.classList.toggle('text-slate-300', !ok);
  }

  function renderPasswordGuidance() {
    const { checks, strength } = evaluatePassword(password.value);
    if (passwordStrength) {
      passwordStrength.textContent = strength;
      passwordStrength.classList.toggle('text-red-300', strength === 'Weak');
      passwordStrength.classList.toggle('text-amber-300', strength === 'Medium');
      passwordStrength.classList.toggle('text-emerald-300', strength === 'Strong');
      passwordStrength.classList.toggle('text-slate-200', false);
    }
    markCheck(pwLen, checks.len);
    markCheck(pwLower, checks.lower);
    markCheck(pwUpper, checks.upper);
    markCheck(pwDigit, checks.digit);
    markCheck(pwSymbol, checks.symbol);
    return checks;
  }

  function setMode(nextMode) {
    mode = nextMode;
    const isLogin = mode === 'login';
    name.parentElement.classList.toggle('hidden', isLogin);
    confirmWrap.classList.toggle('hidden', isLogin);
    passwordGuidance.classList.toggle('hidden', isLogin);
    forgotPasswordLink?.classList.toggle('hidden', !isLogin);
    if (switchModeBtn) {
      switchModeBtn.textContent = isLogin ? 'Need an account? Register' : 'Back to login';
    }
    password.autocomplete = isLogin ? 'current-password' : 'new-password';
    submitBtn.textContent = isLogin ? 'Login' : 'Create account';
    tabLogin.classList.toggle('skeuo-btn-primary', isLogin);
    tabRegister.classList.toggle('skeuo-btn-primary', !isLogin);
    tabLogin.classList.toggle('skeuo-btn-secondary', !isLogin);
    tabRegister.classList.toggle('skeuo-btn-secondary', isLogin);
    clearMessages();
    renderPasswordGuidance();

    const url = new URL(window.location.href);
    url.searchParams.set('mode', mode);
    url.searchParams.set('next', encodeURIComponent(next));
    history.replaceState(null, '', url.toString());
  }

  async function request(url, options = {}) {
    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data?.message || data?.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.code = data?.code;
      throw err;
    }
    return data;
  }

  tabLogin?.addEventListener('click', () => setMode('login'));
  tabRegister?.addEventListener('click', () => setMode('register'));
  switchModeBtn?.addEventListener('click', () => {
    setMode(mode === 'login' ? 'register' : 'login');
  });
  password?.addEventListener('input', () => {
    if (mode === 'register') renderPasswordGuidance();
  });

  function wireToggle(inputEl, btnEl) {
    btnEl?.addEventListener('click', () => {
      const showing = inputEl.type === 'text';
      inputEl.type = showing ? 'password' : 'text';
      btnEl.textContent = showing ? 'Show' : 'Hide';
    });
  }
  wireToggle(password, togglePassword);
  wireToggle(confirmPassword, toggleConfirmPassword);

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (submitting) return;
    clearMessages();

    const eVal = email.value.trim();
    const pVal = password.value;
    const nVal = name.value.trim();
    const cVal = confirmPassword.value;

    try {
      setSubmitting(true);
      if (!eVal || !pVal) throw new Error('Email and password are required');
      if (mode === 'register') {
        const checks = renderPasswordGuidance();
        if (!checks.len) throw new Error('Password must be at least 8 characters');
        if (!checks.lower || !checks.upper || !checks.digit || !checks.symbol) {
          throw new Error('Use upper/lowercase, a number, and a symbol');
        }
        if (pVal !== cVal) throw new Error('Passwords do not match');
      }

      const path = mode === 'login' ? '/auth/login' : '/auth/register';
      const body = mode === 'login'
        ? { email: eVal, password: pVal }
        : { email: eVal, password: pVal, name: nVal || undefined };

      await request(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (mode === 'register') {
        password.value = '';
        confirmPassword.value = '';
        setMode('login');
        showSuccess('Account created. Please check your email to confirm before logging in.');
        return;
      }

      showSuccess('Login successful. Redirecting...');
      await request('/me').catch(() => null);
      window.setTimeout(() => {
        window.location.href = next;
      }, 450);
    } catch (err) {
      if (err?.code === 'EMAIL_NOT_CONFIRMED') {
        showError('Please confirm your email before logging in.');
      } else {
        showError(err?.message || 'Authentication failed');
      }
    } finally {
      setSubmitting(false);
    }
  });

  setMode(mode);
});
