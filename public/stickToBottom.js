window.addEventListener('DOMContentLoaded', () => {
    const chatbox = document.getElementById('chatbox');
    const input = document.getElementById('input');
    const jumpBtn = document.getElementById('jumpLatest');
    if (!chatbox || !input || !jumpBtn) return;

    // --- Stick logic
    const THRESHOLD = 64;
    let stickToLatest = true; // start pinned

    const atBottom = () =>
        (chatbox.scrollHeight - chatbox.scrollTop - chatbox.clientHeight) <= THRESHOLD;

    function showJump(show) {
        jumpBtn.classList.toggle('hidden', !show);
    }

    function scrollToLatest(immediate = true) {
        const prev = chatbox.style.scrollBehavior;
        chatbox.style.scrollBehavior = immediate ? 'auto' : 'smooth';
        chatbox.scrollTop = chatbox.scrollHeight;
        chatbox.style.scrollBehavior = prev || '';
    }

    function nudgeLatest(frames = 3, spreadMs = 120) {
        let i = 0;
        const tick = () => {
            scrollToLatest(true);
            if (++i < frames) requestAnimationFrame(tick);
            else setTimeout(() => scrollToLatest(true), spreadMs);
        };
        requestAnimationFrame(tick);
    }

    // Track manual scroll to toggle stick mode
    let scrollTimeout = null;
    chatbox.addEventListener('scroll', () => {
        if (scrollTimeout) cancelAnimationFrame(scrollTimeout);
        scrollTimeout = requestAnimationFrame(() => {
            stickToLatest = atBottom();
            showJump(!stickToLatest);
        });
    }, { passive: true });

    // Jump button
    jumpBtn.addEventListener('click', () => {
        stickToLatest = true;
        nudgeLatest(4, 120);
        showJump(false);
    });

    // Observe new message nodes (direct children) and stay pinned if we were pinned
    const mo = new MutationObserver((muts) => {
        const added = muts.some(m => m.addedNodes && m.addedNodes.length);
        if (!added) return;
        if (stickToLatest) nudgeLatest(2, 80);
        else showJump(true);
    });
    mo.observe(chatbox, { childList: true });

    // Images/markdown late layout
    document.addEventListener('load', (e) => {
        if (e.target && e.target.tagName === 'IMG' && e.target.closest('#chatbox')) {
            if (stickToLatest) nudgeLatest(2, 80);
        }
    }, true);

    // Keyboard (IME) show/hide and viewport shifts
    if (window.visualViewport) {
        const pin = () => { if (stickToLatest) nudgeLatest(2, 80); };
        visualViewport.addEventListener('resize', pin);
        visualViewport.addEventListener('scroll', pin);
    }

    // Wrap send(): close keyboard and keep pinned like real chats
    if (typeof window.send === 'function') {
        const originalSend = window.send;
        window.send = async function patchedSend() {
            const msg = (input.value || '').trim();
            if (!msg) return;

            stickToLatest = true;
            try { input.blur(); } catch { }
            nudgeLatest(4, 120);

            try {
                await originalSend();
            } finally {
                setTimeout(() => { try { input.blur(); } catch { } }, 10);
                setTimeout(() => { try { input.blur(); } catch { } }, 150);
                nudgeLatest(6, 220);
            }
        };
    }

    // Also handle Return (Enter) without Shift
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            stickToLatest = true;
            try { input.blur(); } catch { }
            nudgeLatest(4, 120);
        }
    });
});
