import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

window.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('resetForm');
  const newPasswordInput = document.getElementById('newPassword');
  const confirmPasswordInput = document.getElementById('confirmPassword');
  const submitBtn = document.getElementById('submitBtn');
  const errorEl = document.getElementById('resetError');
  const successEl = document.getElementById('resetSuccess');
  const backToLoginLink = document.getElementById('backToLoginLink');
  let supabase = null;

  function showError(message) {
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.remove('hidden');
    }
    if (successEl) {
      successEl.textContent = '';
      successEl.classList.add('hidden');
    }
    newPasswordInput?.setAttribute('aria-invalid', 'true');
    confirmPasswordInput?.setAttribute('aria-invalid', 'true');
    backToLoginLink?.classList.add('hidden');
  }

  function showSuccess(message) {
    if (successEl) {
      successEl.textContent = message;
      successEl.classList.remove('hidden');
    }
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.classList.add('hidden');
    }
    newPasswordInput?.setAttribute('aria-invalid', 'false');
    confirmPasswordInput?.setAttribute('aria-invalid', 'false');
    backToLoginLink?.classList.remove('hidden');
  }

  function setSubmitting(isBusy) {
    if (!submitBtn) return;
    submitBtn.disabled = isBusy;
    if (isBusy) {
      submitBtn.dataset.prevLabel = submitBtn.textContent || '';
      submitBtn.textContent = 'Please wait...';
      return;
    }
    submitBtn.textContent = submitBtn.dataset.prevLabel || 'Update password';
  }

  async function getClientConfig() {
    const res = await fetch('/auth/client-config');
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.supabaseUrl || !data?.supabaseAnonKey) {
      throw new Error('Unable to initialize password reset right now.');
    }
    return data;
  }

  async function establishRecoverySession(client) {
    const query = new URLSearchParams(window.location.search);
    const code = query.get('code');
    if (code) {
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (error) throw error;
      return;
    }

    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const accessToken = hash.get('access_token');
    const refreshToken = hash.get('refresh_token');
    if (accessToken && refreshToken) {
      const { error } = await client.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) throw error;
    }
  }

  try {
    const conf = await getClientConfig();
    supabase = createClient(conf.supabaseUrl, conf.supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: true,
      },
    });
    await establishRecoverySession(supabase);
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!data?.session) throw new Error('Recovery link is invalid or expired. Request a new reset email.');
    history.replaceState(null, '', window.location.pathname);
  } catch (err) {
    showError(err?.message || 'Recovery link is invalid or expired. Request a new reset email.');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Link expired';
    }
    return;
  }

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const newPassword = newPasswordInput?.value || '';
    const confirmPassword = confirmPasswordInput?.value || '';

    if (newPassword.length < 8) {
      showError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      showError('Passwords do not match.');
      return;
    }

    try {
      setSubmitting(true);
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      showSuccess('Password updated. Please log in.');
      form.reset();
    } catch (err) {
      showError(err?.message || 'Unable to update password right now.');
    } finally {
      setSubmitting(false);
    }
  });
});
