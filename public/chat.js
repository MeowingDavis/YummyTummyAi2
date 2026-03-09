window.addEventListener("DOMContentLoaded", () => {
  async function authRequest(url, options = {}) {
    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
    return data;
  }

  function setHomeAuthUI(user) {
    const shell = document.getElementById("homeAuthShell");
    const shellMobile = document.getElementById("homeAuthShellMobile");
    const status = document.getElementById("homeAuthStatus");
    const statusMobile = document.getElementById("homeAuthStatusMobile");
    const email = document.getElementById("homeAuthEmail");
    const emailMobile = document.getElementById("homeAuthEmailMobile");
    const reg = document.getElementById("homeRegisterBtn");
    const login = document.getElementById("homeLoginBtn");
    const account = document.getElementById("homeAccountBtn");
    const logout = document.getElementById("homeLogoutBtn");
    const regMobile = document.getElementById("homeRegisterBtnMobile");
    const accountMobile = document.getElementById("homeAccountBtnMobile");
    const loginMobile = document.getElementById("homeLoginBtnMobile");
    const logoutMobile = document.getElementById("homeLogoutBtnMobile");
    const signedInText = user ? "Signed in" : "Sign in to save chats";

    if (status) status.textContent = signedInText;
    if (statusMobile) statusMobile.textContent = signedInText;
    if (email) {
      email.textContent = user?.email || "";
      email.classList.toggle("hidden", !user);
    }
    if (emailMobile) {
      emailMobile.textContent = user?.email || "";
      emailMobile.classList.toggle("hidden", !user);
    }
    reg?.classList.toggle("hidden", !!user);
    regMobile?.classList.toggle("hidden", !!user);
    login?.classList.toggle("hidden", !!user);
    account?.classList.toggle("hidden", !user);
    logout?.classList.toggle("hidden", !user);
    accountMobile?.classList.toggle("hidden", !user);
    loginMobile?.classList.toggle("hidden", !!user);
    logoutMobile?.classList.toggle("hidden", !user);
    shell?.setAttribute("data-auth-ready", "true");
    shellMobile?.setAttribute("data-auth-ready", "true");
  }

  function showAccountDeletedMessage() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("accountDeleted") !== "1") return;
    const host = document.getElementById("notice") || document.body;
    const wrap = document.createElement("div");
    wrap.className = "skeuo-wrap skeuo-container-wide";
    wrap.innerHTML = `
      <div class="glass skeuo-surface skeuo-section-tight skeuo-card-pad text-sm text-emerald-200">
        Account deleted.
      </div>
    `;
    host.parentNode.insertBefore(wrap, host);
    params.delete("accountDeleted");
    const clean = `${window.location.pathname}${
      params.toString() ? `?${params.toString()}` : ""
    }${window.location.hash}`;
    history.replaceState(null, "", clean);
  }

  async function refreshMe() {
    try {
      const data = await authRequest("/me");
      setHomeAuthUI(data?.user ?? null);
    } catch {
      setHomeAuthUI(null);
    }
  }

  function goToAuth(mode) {
    const next = encodeURIComponent(window.location.pathname || "/");
    window.location.href = `/auth.html?mode=${
      encodeURIComponent(mode)
    }&next=${next}`;
  }

  async function doLogout() {
    await authRequest("/auth/logout", { method: "POST" });
    await refreshMe();
  }

  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const noticeEl = document.getElementById("notice");
  const btn = document.getElementById("noticeDismiss");
  btn?.addEventListener("click", () => {
    if (noticeEl) noticeEl.style.display = "none";
  });

  const hasHomeAuthShell = !!document.getElementById("homeAuthShell");
  if (hasHomeAuthShell) {
    document.getElementById("homeRegisterBtn")?.addEventListener(
      "click",
      async (e) => {
        e.preventDefault();
        goToAuth("register");
      },
    );
    document.getElementById("homeLoginBtn")?.addEventListener(
      "click",
      async (e) => {
        e.preventDefault();
        goToAuth("login");
      },
    );
    document.getElementById("homeLoginBtnMobile")?.addEventListener(
      "click",
      async (e) => {
        e.preventDefault();
        goToAuth("login");
      },
    );
    document.getElementById("homeRegisterBtnMobile")?.addEventListener(
      "click",
      async (e) => {
        e.preventDefault();
        goToAuth("register");
      },
    );
    document.getElementById("homeLogoutBtn")?.addEventListener(
      "click",
      async (e) => {
        e.preventDefault();
        try {
          await doLogout();
        } catch (e2) {
          setHomeAuthUI(null);
        }
      },
    );
    document.getElementById("homeLogoutBtnMobile")?.addEventListener(
      "click",
      async (e) => {
        e.preventDefault();
        try {
          await doLogout();
        } catch (e2) {
          setHomeAuthUI(null);
        }
      },
    );
  }

  const menuBtn = document.getElementById("homeMobileMenuBtn");
  const menuBg = document.getElementById("homeMobileMenuBg");
  const menu = document.getElementById("homeMobileMenu");
  const menuClose = document.getElementById("homeMobileCloseBtn");
  const openMenu = () => {
    if (!menu || !menuBg || !menuBtn) return;
    menu.classList.remove("hidden");
    menuBg.classList.remove("hidden");
    menuBtn.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
  };
  const closeMenu = () => {
    if (!menu || !menuBg || !menuBtn) return;
    menu.classList.add("hidden");
    menuBg.classList.add("hidden");
    menuBtn.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  };
  menuBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    if (menu?.classList.contains("hidden")) openMenu();
    else closeMenu();
  });
  menuBg?.addEventListener("click", closeMenu);
  menuClose?.addEventListener("click", closeMenu);
  menu?.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (target.closest("a,button")) closeMenu();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });

  if (hasHomeAuthShell) refreshMe();
  showAccountDeletedMessage();

  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (id && id.length > 1) {
        const el = document.querySelector(id);
        if (el) {
          e.preventDefault();
          const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches;
          el.scrollIntoView({
            behavior: smooth ? "smooth" : "auto",
            block: "start",
          });
        }
      }
    });
  });
});
