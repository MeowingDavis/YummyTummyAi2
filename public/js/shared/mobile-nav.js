window.addEventListener("DOMContentLoaded", () => {
  const trigger = document.querySelector("[data-mobile-nav-btn]");
  const panel = document.querySelector("[data-mobile-nav-panel]");

  if (!trigger || !panel) return;

  // Move drawer to body so header stacking contexts cannot place backdrop above it.
  document.body.appendChild(panel);

  const backdrop = document.createElement("div");
  backdrop.setAttribute("data-mobile-nav-backdrop", "true");
  backdrop.className = "fixed inset-0 z-40 hidden bg-black/70 sm:bg-black/60";
  document.body.appendChild(backdrop);

  const baseClassesToRemove = [
    "absolute",
    "right-0",
    "top-[calc(100%+0.5rem)]",
    "w-64",
    "rounded-2xl",
    "border",
    "border-slate-700/80",
    "bg-slate-950/95",
    "p-3",
    "shadow-[0_20px_40px_rgba(15,23,42,0.45)]",
    "backdrop-blur-md",
    "z-50",
  ];
  panel.classList.remove(...baseClassesToRemove);
  panel.classList.add(
    "stack-drawer",
    "stack-compact",
    "skeuo-surface",
    "fixed",
    "left-0",
    "top-0",
    "z-50",
    "h-[100dvh]",
    "w-[92vw]",
    "max-w-xs",
    "overflow-y-auto",
    "p-5",
    "sm:w-[82vw]",
    "transform",
    "transition-transform",
    "duration-200",
    "ease-out",
    "-translate-x-full",
  );
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");

  const openMenu = () => {
    panel.classList.remove("hidden");
    backdrop.classList.remove("hidden");
    requestAnimationFrame(() => {
      panel.classList.remove("-translate-x-full");
    });
    trigger.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
  };

  const closeMenu = () => {
    panel.classList.add("-translate-x-full");
    backdrop.classList.add("hidden");
    trigger.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
    window.setTimeout(() => {
      if (panel.classList.contains("-translate-x-full")) {
        panel.classList.add("hidden");
      }
    }, 200);
  };

  trigger.addEventListener("click", () => {
    const expanded = trigger.getAttribute("aria-expanded") === "true";
    if (expanded) {
      closeMenu();
      return;
    }
    openMenu();
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (panel.classList.contains("hidden")) return;
    if (panel.contains(target) || trigger.contains(target)) return;
    closeMenu();
  });

  backdrop.addEventListener("click", () => {
    closeMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });

  panel.querySelectorAll("a, button").forEach((el) => {
    el.addEventListener("click", () => {
      closeMenu();
    });
  });

  window.addEventListener("resize", () => {
    if (window.matchMedia("(min-width: 768px)").matches) {
      panel.classList.add("-translate-x-full");
      panel.classList.add("hidden");
      backdrop.classList.add("hidden");
      trigger.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
    }
  });
});
