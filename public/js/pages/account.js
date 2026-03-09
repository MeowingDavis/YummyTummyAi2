window.addEventListener("DOMContentLoaded", async () => {
  const accountStatusEl = document.getElementById("accountStatus");

  const changePasswordSection = document.getElementById(
    "changePasswordSection",
  );
  const changePasswordForm = document.getElementById("changePasswordForm");
  const currentPasswordInput = document.getElementById("currentPassword");
  const newPasswordInput = document.getElementById("newPassword");
  const confirmNewPasswordInput = document.getElementById("confirmNewPassword");
  const changePasswordBtn = document.getElementById("changePasswordBtn");
  const changePasswordErrorEl = document.getElementById("changePasswordError");
  const changePasswordSuccessEl = document.getElementById(
    "changePasswordSuccess",
  );

  const deleteSection = document.getElementById("deleteSection");
  const deleteForm = document.getElementById("deleteForm");
  const passwordInput = document.getElementById("password");
  const deleteBtn = document.getElementById("deleteBtn");
  const deleteErrorEl = document.getElementById("deleteError");
  const deleteSuccessEl = document.getElementById("deleteSuccess");

  const profileForm = document.getElementById("profileForm");
  const dietaryRequirementsInput = document.getElementById(
    "dietaryRequirements",
  );
  const allergiesInput = document.getElementById("allergies");
  const dislikesInput = document.getElementById("dislikes");
  const profileSaveBtn = document.getElementById("profileSaveBtn");
  const profileHelpEl = document.getElementById("profileHelp");
  const dietaryPreviewEl = document.getElementById("dietaryPreview");
  const allergyPreviewEl = document.getElementById("allergyPreview");
  const dislikePreviewEl = document.getElementById("dislikePreview");
  const profileErrorEl = document.getElementById("profileError");
  const profileSuccessEl = document.getElementById("profileSuccess");

  let currentUser = null;

  async function request(url, options = {}) {
    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(
        data?.message || data?.error || `HTTP ${res.status}`,
      );
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
      button.dataset.prevLabel = button.textContent || "";
      button.textContent = busyLabel;
      return;
    }
    button.textContent = button.dataset.prevLabel || defaultLabel;
  }

  function showMessage(errorEl, successEl, message, isError) {
    if (isError) {
      if (errorEl) {
        errorEl.textContent = message || "Request failed.";
        errorEl.classList.remove("hidden");
      }
      if (successEl) {
        successEl.textContent = "";
        successEl.classList.add("hidden");
      }
      return;
    }

    if (successEl) {
      successEl.textContent = message || "";
      successEl.classList.remove("hidden");
    }
    if (errorEl) {
      errorEl.textContent = "";
      errorEl.classList.add("hidden");
    }
  }

  function setAccountStatus(message, html = false) {
    if (!accountStatusEl) return;
    if (html) accountStatusEl.innerHTML = message;
    else accountStatusEl.textContent = message;
    accountStatusEl.classList.remove("opacity-0");
  }

  function parseList(value) {
    const seen = new Set();
    return String(value || "")
      .replace(/\r?\n/g, ",")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .filter((item) => {
        const key = item.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 30);
  }

  function formatList(items) {
    return Array.isArray(items) ? items.filter(Boolean).join(", ") : "";
  }

  function renderPreview(container, items, emptyLabel) {
    if (!container) return;
    container.replaceChildren();

    if (!items.length) {
      const empty = document.createElement("p");
      empty.className =
        "rounded-full border border-slate-300/70 bg-slate-100/80 px-3 py-2 text-sm text-slate-500";
      empty.textContent = emptyLabel;
      container.appendChild(empty);
      return;
    }

    items.forEach((item) => {
      const chip = document.createElement("span");
      chip.className =
        "inline-flex items-center rounded-full border border-emerald-300/35 bg-emerald-400/10 px-3 py-2 text-sm font-medium text-emerald-800";
      chip.textContent = item;
      container.appendChild(chip);
    });
  }

  function renderProfileForm(user) {
    const dietaryRequirements =
      Array.isArray(user?.profile?.dietaryRequirements)
        ? user.profile.dietaryRequirements
        : [];
    const allergies = Array.isArray(user?.profile?.allergies)
      ? user.profile.allergies
      : [];
    const dislikes = Array.isArray(user?.profile?.dislikes)
      ? user.profile.dislikes
      : [];
    if (dietaryRequirementsInput) {
      dietaryRequirementsInput.value = formatList(dietaryRequirements);
    }
    if (allergiesInput) allergiesInput.value = formatList(allergies);
    if (dislikesInput) dislikesInput.value = formatList(dislikes);
    renderPreview(
      dietaryPreviewEl,
      dietaryRequirements,
      "No diet rules saved yet.",
    );
    renderPreview(allergyPreviewEl, allergies, "No allergies saved yet.");
    renderPreview(dislikePreviewEl, dislikes, "No dislikes saved yet.");
  }

  function setProfileFormEnabled(enabled, message, html = false) {
    if (dietaryRequirementsInput) dietaryRequirementsInput.disabled = !enabled;
    if (allergiesInput) allergiesInput.disabled = !enabled;
    if (dislikesInput) dislikesInput.disabled = !enabled;
    if (profileSaveBtn) {
      profileSaveBtn.disabled = !enabled;
      profileSaveBtn.classList.toggle("opacity-50", !enabled);
      profileSaveBtn.classList.toggle("cursor-not-allowed", !enabled);
      profileSaveBtn.textContent = enabled
        ? "Save food profile"
        : "Sign in to save";
    }
    if (profileHelpEl) {
      if (html) profileHelpEl.innerHTML = message;
      else profileHelpEl.textContent = message;
    }
  }

  try {
    const me = await request("/me");
    currentUser = me?.user ?? null;
  } catch {
    currentUser = null;
  }

  if (!currentUser) {
    renderPreview(dietaryPreviewEl, [], "No diet rules saved yet.");
    renderPreview(allergyPreviewEl, [], "No allergies saved yet.");
    renderPreview(dislikePreviewEl, [], "No dislikes saved yet.");
    setProfileFormEnabled(
      false,
      'Sign in to save your diet, allergy, and dislike preferences. <a href="/auth.html?mode=login&next=%2Faccount.html" class="skeuo-link">Go to login</a>.',
      true,
    );
    setAccountStatus(
      'You are not logged in. <a href="/auth.html?mode=login&next=%2Faccount.html" class="skeuo-link">Go to login</a>.',
      true,
    );
    return;
  }

  setAccountStatus(`Signed in as ${currentUser.email}`);

  setProfileFormEnabled(
    true,
    "Use short comma-separated lists. Signed-in chat will use these preferences, and it may also remember stable diet statements you share in chat.",
  );
  changePasswordSection?.classList.remove("hidden");
  deleteSection?.classList.remove("hidden");
  renderProfileForm(currentUser);

  dietaryRequirementsInput?.addEventListener("input", () => {
    renderPreview(
      dietaryPreviewEl,
      parseList(dietaryRequirementsInput.value),
      "No diet rules saved yet.",
    );
  });
  allergiesInput?.addEventListener("input", () => {
    renderPreview(
      allergyPreviewEl,
      parseList(allergiesInput.value),
      "No allergies saved yet.",
    );
  });
  dislikesInput?.addEventListener("input", () => {
    renderPreview(
      dislikePreviewEl,
      parseList(dislikesInput.value),
      "No dislikes saved yet.",
    );
  });

  profileForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const dietaryRequirements = parseList(
      dietaryRequirementsInput?.value || "",
    );
    const allergies = parseList(allergiesInput?.value || "");
    const dislikes = parseList(dislikesInput?.value || "");
    dietaryRequirementsInput?.setAttribute("aria-invalid", "false");
    allergiesInput?.setAttribute("aria-invalid", "false");
    dislikesInput?.setAttribute("aria-invalid", "false");

    try {
      setSubmitting(profileSaveBtn, true, "Saving...", "Save food profile");
      const data = await request("/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dietaryRequirements, allergies, dislikes }),
      });
      currentUser = data?.user ?? currentUser;
      renderProfileForm(currentUser);
      showMessage(
        profileErrorEl,
        profileSuccessEl,
        "Food profile saved. Future signed-in chats will use your diet, allergy, and dislike preferences.",
        false,
      );
    } catch (err) {
      dietaryRequirementsInput?.setAttribute("aria-invalid", "true");
      allergiesInput?.setAttribute("aria-invalid", "true");
      dislikesInput?.setAttribute("aria-invalid", "true");
      showMessage(
        profileErrorEl,
        profileSuccessEl,
        err?.message || "Unable to save your food profile right now.",
        true,
      );
    } finally {
      setSubmitting(profileSaveBtn, false, "Saving...", "Save food profile");
    }
  });

  changePasswordForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const currentPassword = currentPasswordInput?.value || "";
    const newPassword = newPasswordInput?.value || "";
    const confirmNewPassword = confirmNewPasswordInput?.value || "";

    currentPasswordInput?.setAttribute("aria-invalid", "false");
    newPasswordInput?.setAttribute("aria-invalid", "false");
    confirmNewPasswordInput?.setAttribute("aria-invalid", "false");

    if (!currentPassword) {
      currentPasswordInput?.setAttribute("aria-invalid", "true");
      showMessage(
        changePasswordErrorEl,
        changePasswordSuccessEl,
        "Please enter your current password.",
        true,
      );
      return;
    }
    if (newPassword.length < 8) {
      newPasswordInput?.setAttribute("aria-invalid", "true");
      showMessage(
        changePasswordErrorEl,
        changePasswordSuccessEl,
        "New password must be at least 8 characters.",
        true,
      );
      return;
    }
    if (newPassword !== confirmNewPassword) {
      confirmNewPasswordInput?.setAttribute("aria-invalid", "true");
      showMessage(
        changePasswordErrorEl,
        changePasswordSuccessEl,
        "New passwords do not match.",
        true,
      );
      return;
    }
    if (newPassword === currentPassword) {
      newPasswordInput?.setAttribute("aria-invalid", "true");
      showMessage(
        changePasswordErrorEl,
        changePasswordSuccessEl,
        "New password must be different from current password.",
        true,
      );
      return;
    }

    try {
      setSubmitting(
        changePasswordBtn,
        true,
        "Please wait...",
        "Update password",
      );
      await request("/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      showMessage(
        changePasswordErrorEl,
        changePasswordSuccessEl,
        "Password updated successfully.",
        false,
      );
      if (changePasswordForm) changePasswordForm.reset();
      currentPasswordInput?.setAttribute("aria-invalid", "false");
      newPasswordInput?.setAttribute("aria-invalid", "false");
      confirmNewPasswordInput?.setAttribute("aria-invalid", "false");
    } catch (err) {
      if (err?.code === "INVALID_PASSWORD") {
        currentPasswordInput?.setAttribute("aria-invalid", "true");
        showMessage(
          changePasswordErrorEl,
          changePasswordSuccessEl,
          "Current password is incorrect.",
          true,
        );
      } else if (err?.code === "PASSWORD_REUSE") {
        newPasswordInput?.setAttribute("aria-invalid", "true");
        showMessage(
          changePasswordErrorEl,
          changePasswordSuccessEl,
          "New password must be different from current password.",
          true,
        );
      } else {
        showMessage(
          changePasswordErrorEl,
          changePasswordSuccessEl,
          err?.message || "Unable to update password right now.",
          true,
        );
      }
    } finally {
      setSubmitting(
        changePasswordBtn,
        false,
        "Please wait...",
        "Update password",
      );
    }
  });

  deleteForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = passwordInput?.value || "";
    passwordInput?.setAttribute("aria-invalid", "false");

    if (!password) {
      passwordInput?.setAttribute("aria-invalid", "true");
      showMessage(
        deleteErrorEl,
        deleteSuccessEl,
        "Please enter your password.",
        true,
      );
      return;
    }

    try {
      setSubmitting(
        deleteBtn,
        true,
        "Please wait...",
        "Delete account permanently",
      );
      await request("/auth/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      showMessage(deleteErrorEl, deleteSuccessEl, "Account deleted.", false);
      window.setTimeout(() => {
        window.location.href = "/?accountDeleted=1";
      }, 400);
    } catch (err) {
      if (err?.code === "INVALID_PASSWORD") {
        passwordInput?.setAttribute("aria-invalid", "true");
        showMessage(
          deleteErrorEl,
          deleteSuccessEl,
          "Incorrect password.",
          true,
        );
      } else {
        showMessage(
          deleteErrorEl,
          deleteSuccessEl,
          err?.message || "Unable to delete account right now.",
          true,
        );
      }
    } finally {
      setSubmitting(
        deleteBtn,
        false,
        "Please wait...",
        "Delete account permanently",
      );
    }
  });
});
