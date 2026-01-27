window.addEventListener('DOMContentLoaded', () => {
    // current year + "Continue chat" if a draft exists
    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
    const privacyKey = 'yt_privacy_notice_dismissed_v1';
    const hasAck = localStorage.getItem(privacyKey) === '1';
    const hasDraft = hasAck && !!localStorage.getItem('yt_ai_draft');
    if (hasDraft) {
      const cta  = document.getElementById('cta');
      const cta2 = document.getElementById('cta2');
      if (cta)  cta.textContent  = 'Continue chat';
      if (cta2) cta2.textContent = 'Continue chat';
    }

    // Dismissible responsive notice (persists)
    const noticeKey = 'yt_ai_notice_dismissed_v1';
    const noticeEl  = document.getElementById('notice');
    const btn       = document.getElementById('noticeDismiss');
    if (noticeEl && localStorage.getItem(noticeKey) === '1') {
      noticeEl.style.display = 'none';
    }
    btn?.addEventListener('click', () => {
      localStorage.setItem(noticeKey, '1');
      if (noticeEl) noticeEl.style.display = 'none';
    });

    // Privacy notice on landing page
    const privacyEl = document.getElementById('privacyNoticeHome');
    const privacyBtn = document.getElementById('privacyDismissHome');
    if (hasAck) {
      if (privacyEl) privacyEl.style.display = 'none';
    } else {
      privacyBtn?.addEventListener('click', () => {
        localStorage.setItem(privacyKey, '1');
        if (privacyEl) privacyEl.style.display = 'none';
        const hasDraftNow = !!localStorage.getItem('yt_ai_draft');
        if (hasDraftNow) {
          const cta  = document.getElementById('cta');
          const cta2 = document.getElementById('cta2');
          if (cta)  cta.textContent  = 'Continue chat';
          if (cta2) cta2.textContent = 'Continue chat';
        }
      });
    }

    // Smooth scroll for “How it works”
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', e => {
        const id = a.getAttribute('href');
        if (id && id.length > 1) {
          const el = document.querySelector(id);
          if (el) {
            e.preventDefault();
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      });
    });
});
