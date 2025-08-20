
    // current year + “Continue chat” if a draft exists
    document.getElementById('year').textContent = new Date().getFullYear();
    const hasDraft = !!localStorage.getItem('yt_ai_draft');
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
    if (localStorage.getItem(noticeKey) === '1') {
      noticeEl.style.display = 'none';
    }
    btn?.addEventListener('click', () => {
      localStorage.setItem(noticeKey, '1');
      noticeEl.style.display = 'none';
    });

    // Smooth scroll for “How it works”
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', e => {
        const id = a.getAttribute('href');
        if (id.length > 1) {
          const el = document.querySelector(id);
          if (el) {
            e.preventDefault();
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      });
    });
