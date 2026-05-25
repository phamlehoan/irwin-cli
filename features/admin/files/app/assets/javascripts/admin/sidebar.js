(function () {
  const STORAGE_KEY = "irwin.admin.sidebarCollapsed";
  const MOBILE_MQ = window.matchMedia("(max-width: 767px)");

  const layout = document.getElementById("adminLayout");
  const sidebar = document.getElementById("adminSidebar");
  const shell = sidebar?.closest(".admin-sidebar-shell");
  const toggle = document.querySelector(".admin-sidebar__toggle");
  const backdrop = document.querySelector(".admin-sidebar-backdrop");

  if (!sidebar || !toggle || !layout) return;

  function isMobile() {
    return MOBILE_MQ.matches;
  }

  function setAria(collapsed) {
    toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
    if (isMobile()) {
      const label = collapsed
        ? toggle.dataset.labelMenu
        : toggle.dataset.labelClose;
      if (label) toggle.setAttribute("aria-label", label);
      return;
    }
    const label = collapsed
      ? toggle.dataset.labelExpand
      : toggle.dataset.labelCollapse;
    if (label) toggle.setAttribute("aria-label", label);
  }

  function setDesktopCollapsed(collapsed) {
    sidebar.classList.toggle("admin-sidebar--collapsed", collapsed);
    shell?.classList.toggle("admin-sidebar-shell--collapsed", collapsed);
    layout.classList.toggle("admin-layout--sidebar-collapsed", collapsed);
    layout.classList.remove("admin-layout--sidebar-open");
    setAria(collapsed);
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  function setMobileOpen(open) {
    layout.classList.toggle("admin-layout--sidebar-open", open);
    sidebar.classList.remove("admin-sidebar--collapsed");
    shell?.classList.remove("admin-sidebar-shell--collapsed");
    setAria(!open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    if (backdrop) backdrop.tabIndex = open ? 0 : -1;
    document.body.style.overflow = open ? "hidden" : "";
  }

  function applyModeFromStorage() {
    if (isMobile()) {
      setMobileOpen(false);
      return;
    }
    const collapsed =
      sidebar.classList.contains("admin-sidebar--collapsed") ||
      localStorage.getItem(STORAGE_KEY) === "1";
    setDesktopCollapsed(collapsed);
  }

  toggle.addEventListener("click", () => {
    if (isMobile()) {
      setMobileOpen(!layout.classList.contains("admin-layout--sidebar-open"));
      return;
    }
    setDesktopCollapsed(!sidebar.classList.contains("admin-sidebar--collapsed"));
  });

  backdrop?.addEventListener("click", () => setMobileOpen(false));

  sidebar.querySelectorAll(".admin-sidebar__link").forEach((link) => {
    link.addEventListener("click", () => {
      if (isMobile()) setMobileOpen(false);
    });
  });

  MOBILE_MQ.addEventListener("change", () => {
    layout.classList.remove("admin-layout--sidebar-open");
    document.body.style.overflow = "";
    if (backdrop) backdrop.tabIndex = -1;
    applyModeFromStorage();
  });

  applyModeFromStorage();
})();
