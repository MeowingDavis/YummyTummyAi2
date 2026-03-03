window.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('forgotForm');
  const emailInput = document.getElementById('email');
  const submitBtn = document.getElementById('submitBtn');
  const errorEl = document.getElementById('forgotError');
  const successEl = document.getElementById('forgotSuccess');

  function showError(message) {
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.remove('hidden');
    }
    if (successEl) {
      successEl.textContent = '';
      successEl.classList.add('hidden');
    }
    emailInput?.setAttribute('aria-invalid', 'true');
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
    emailInput?.setAttribute('aria-invalid', 'false');
  }

  function setSubmitting(isBusy) {
    if (!submitBtn) return;
    submitBtn.disabled = isBusy;
    if (isBusy) {
      submitBtn.dataset.prevLabel = submitBtn.textContent || '';
      submitBtn.textContent = 'Please wait...';
      return;
    }
    submitBtn.textContent = submitBtn.dataset.prevLabel || 'Send reset email';
  }

  async function requestForgotPassword(email) {
    const res = await fetch('/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data?.message || data?.error || 'Unable to submit right now');
      err.code = data?.code;
      throw err;
    }
    return data;
  }

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = emailInput?.value?.trim() || '';
    if (!email) {
      showError('Please enter your email.');
      return;
    }

    try {
      setSubmitting(true);
      await requestForgotPassword(email);
      showSuccess('If an account exists, a reset email has been sent.');
    } catch (err) {
      showError(err?.message || 'Unable to submit right now');
    } finally {
      setSubmitting(false);
    }
  });
});
