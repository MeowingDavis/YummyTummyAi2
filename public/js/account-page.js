window.addEventListener('DOMContentLoaded', async () => {
  const accountStatusEl = document.getElementById('accountStatus');
  const deleteSection = document.getElementById('deleteSection');
  const deleteForm = document.getElementById('deleteForm');
  const passwordInput = document.getElementById('password');
  const deleteBtn = document.getElementById('deleteBtn');
  const errorEl = document.getElementById('deleteError');
  const successEl = document.getElementById('deleteSuccess');
  let currentUser = null;

  function showError(message) {
    if (errorEl) {
      errorEl.textContent = message || 'Request failed.';
      errorEl.classList.remove('hidden');
    }
    if (successEl) {
      successEl.textContent = '';
      successEl.classList.add('hidden');
    }
  }

  function showSuccess(message) {
    if (successEl) {
      successEl.textContent = message || '';
      successEl.classList.remove('hidden');
    }
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.classList.add('hidden');
    }
  }

  function setSubmitting(isBusy) {
    if (!deleteBtn) return;
    deleteBtn.disabled = isBusy;
    if (isBusy) {
      deleteBtn.dataset.prevLabel = deleteBtn.textContent || '';
      deleteBtn.textContent = 'Please wait...';
      return;
    }
    deleteBtn.textContent = deleteBtn.dataset.prevLabel || 'Delete account permanently';
  }

  async function request(url, options = {}) {
    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data?.message || data?.error || `HTTP ${res.status}`);
      err.code = data?.code;
      err.status = res.status;
      throw err;
    }
    return data;
  }

  try {
    const me = await request('/me');
    currentUser = me?.user ?? null;
  } catch {
    currentUser = null;
  }

  if (!currentUser) {
    if (accountStatusEl) {
      accountStatusEl.innerHTML = 'You are not logged in. <a href="/auth.html?mode=login&next=%2Faccount.html" class="skeuo-link">Go to login</a>.';
    }
    return;
  }

  if (accountStatusEl) {
    accountStatusEl.textContent = `Signed in as ${currentUser.email}`;
  }
  deleteSection?.classList.remove('hidden');

  deleteForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = passwordInput?.value || '';
    if (!password) {
      showError('Please enter your password.');
      return;
    }

    try {
      setSubmitting(true);
      await request('/auth/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      showSuccess('Account deleted.');
      window.setTimeout(() => {
        window.location.href = '/?accountDeleted=1';
      }, 400);
    } catch (err) {
      if (err?.code === 'INVALID_PASSWORD') {
        showError('Incorrect password.');
      } else {
        showError(err?.message || 'Unable to delete account right now.');
      }
    } finally {
      setSubmitting(false);
    }
  });
});
