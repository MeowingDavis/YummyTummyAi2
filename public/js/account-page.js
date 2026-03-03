window.addEventListener('DOMContentLoaded', async () => {
  const accountStatusEl = document.getElementById('accountStatus');

  const changePasswordSection = document.getElementById('changePasswordSection');
  const changePasswordForm = document.getElementById('changePasswordForm');
  const currentPasswordInput = document.getElementById('currentPassword');
  const newPasswordInput = document.getElementById('newPassword');
  const confirmNewPasswordInput = document.getElementById('confirmNewPassword');
  const changePasswordBtn = document.getElementById('changePasswordBtn');
  const changePasswordErrorEl = document.getElementById('changePasswordError');
  const changePasswordSuccessEl = document.getElementById('changePasswordSuccess');

  const deleteSection = document.getElementById('deleteSection');
  const deleteForm = document.getElementById('deleteForm');
  const passwordInput = document.getElementById('password');
  const deleteBtn = document.getElementById('deleteBtn');
  const deleteErrorEl = document.getElementById('deleteError');
  const deleteSuccessEl = document.getElementById('deleteSuccess');

  let currentUser = null;

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

  function setSubmitting(button, busy, busyLabel, defaultLabel) {
    if (!button) return;
    button.disabled = busy;
    if (busy) {
      button.dataset.prevLabel = button.textContent || '';
      button.textContent = busyLabel;
      return;
    }
    button.textContent = button.dataset.prevLabel || defaultLabel;
  }

  function showMessage(errorEl, successEl, message, isError) {
    if (isError) {
      if (errorEl) {
        errorEl.textContent = message || 'Request failed.';
        errorEl.classList.remove('hidden');
      }
      if (successEl) {
        successEl.textContent = '';
        successEl.classList.add('hidden');
      }
      return;
    }

    if (successEl) {
      successEl.textContent = message || '';
      successEl.classList.remove('hidden');
    }
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.classList.add('hidden');
    }
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

  changePasswordSection?.classList.remove('hidden');
  deleteSection?.classList.remove('hidden');

  changePasswordForm?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const currentPassword = currentPasswordInput?.value || '';
    const newPassword = newPasswordInput?.value || '';
    const confirmNewPassword = confirmNewPasswordInput?.value || '';

    currentPasswordInput?.setAttribute('aria-invalid', 'false');
    newPasswordInput?.setAttribute('aria-invalid', 'false');
    confirmNewPasswordInput?.setAttribute('aria-invalid', 'false');

    if (!currentPassword) {
      currentPasswordInput?.setAttribute('aria-invalid', 'true');
      showMessage(changePasswordErrorEl, changePasswordSuccessEl, 'Please enter your current password.', true);
      return;
    }
    if (newPassword.length < 8) {
      newPasswordInput?.setAttribute('aria-invalid', 'true');
      showMessage(changePasswordErrorEl, changePasswordSuccessEl, 'New password must be at least 8 characters.', true);
      return;
    }
    if (newPassword !== confirmNewPassword) {
      confirmNewPasswordInput?.setAttribute('aria-invalid', 'true');
      showMessage(changePasswordErrorEl, changePasswordSuccessEl, 'New passwords do not match.', true);
      return;
    }
    if (newPassword === currentPassword) {
      newPasswordInput?.setAttribute('aria-invalid', 'true');
      showMessage(changePasswordErrorEl, changePasswordSuccessEl, 'New password must be different from current password.', true);
      return;
    }

    try {
      setSubmitting(changePasswordBtn, true, 'Please wait...', 'Update password');
      await request('/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      showMessage(changePasswordErrorEl, changePasswordSuccessEl, 'Password updated successfully.', false);
      if (changePasswordForm) changePasswordForm.reset();
      currentPasswordInput?.setAttribute('aria-invalid', 'false');
      newPasswordInput?.setAttribute('aria-invalid', 'false');
      confirmNewPasswordInput?.setAttribute('aria-invalid', 'false');
    } catch (err) {
      if (err?.code === 'INVALID_PASSWORD') {
        currentPasswordInput?.setAttribute('aria-invalid', 'true');
        showMessage(changePasswordErrorEl, changePasswordSuccessEl, 'Current password is incorrect.', true);
      } else if (err?.code === 'PASSWORD_REUSE') {
        newPasswordInput?.setAttribute('aria-invalid', 'true');
        showMessage(changePasswordErrorEl, changePasswordSuccessEl, 'New password must be different from current password.', true);
      } else {
        showMessage(changePasswordErrorEl, changePasswordSuccessEl, err?.message || 'Unable to update password right now.', true);
      }
    } finally {
      setSubmitting(changePasswordBtn, false, 'Please wait...', 'Update password');
    }
  });

  deleteForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = passwordInput?.value || '';
    passwordInput?.setAttribute('aria-invalid', 'false');

    if (!password) {
      passwordInput?.setAttribute('aria-invalid', 'true');
      showMessage(deleteErrorEl, deleteSuccessEl, 'Please enter your password.', true);
      return;
    }

    try {
      setSubmitting(deleteBtn, true, 'Please wait...', 'Delete account permanently');
      await request('/auth/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      showMessage(deleteErrorEl, deleteSuccessEl, 'Account deleted.', false);
      window.setTimeout(() => {
        window.location.href = '/?accountDeleted=1';
      }, 400);
    } catch (err) {
      if (err?.code === 'INVALID_PASSWORD') {
        passwordInput?.setAttribute('aria-invalid', 'true');
        showMessage(deleteErrorEl, deleteSuccessEl, 'Incorrect password.', true);
      } else {
        showMessage(deleteErrorEl, deleteSuccessEl, err?.message || 'Unable to delete account right now.', true);
      }
    } finally {
      setSubmitting(deleteBtn, false, 'Please wait...', 'Delete account permanently');
    }
  });
});
