(function () {
  function updateBadge(count) {
    const n = Math.max(0, Number(count) || 0);
    document.querySelectorAll("[data-notif-badge]").forEach((el) => {
      if (n === 0) {
        el.hidden = true;
        el.textContent = "";
      } else {
        el.hidden = false;
        el.textContent = n > 99 ? "99+" : String(n);
      }
    });
    document.querySelectorAll(".notif-bell__badge").forEach((el) => {
      if (n === 0) el.remove();
      else {
        el.textContent = n > 99 ? "99+" : String(n);
      }
    });
  }

  function markItemRead(el) {
    if (!el) return;
    el.classList.remove("notif-item--unread", "notif-bell__row--unread");
    el.dataset.notifUnread = "0";
    const btn = el.querySelector("[data-notif-mark-read]");
    if (btn) btn.remove();
  }

  async function postJson(url) {
    const res = await fetch(url, {
      method: "POST",
      headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
      credentials: "same-origin",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function markRead(id) {
    const data = await postJson(`/notifications/${encodeURIComponent(id)}/read`);
    if (typeof data.unreadCount === "number") updateBadge(data.unreadCount);
    document.querySelectorAll(`[data-notif-id="${CSS.escape(id)}"]`).forEach(markItemRead);
    return data;
  }

  async function markAllRead() {
    const data = await postJson("/notifications/read-all");
    if (typeof data.unreadCount === "number") updateBadge(data.unreadCount);
    document
      .querySelectorAll(".notif-item--unread, .notif-bell__row--unread")
      .forEach(markItemRead);
    document.querySelectorAll("[data-notif-mark-all]").forEach((b) => {
      b.hidden = true;
    });
    return data;
  }

  document.addEventListener("click", (event) => {
    const markAll = event.target.closest("[data-notif-mark-all]");
    if (markAll) {
      event.preventDefault();
      markAllRead().catch(() => {});
      return;
    }
    const markOne = event.target.closest("[data-notif-mark-read]");
    if (markOne) {
      event.preventDefault();
      const id = markOne.getAttribute("data-notif-mark-read");
      if (id) markRead(id).catch(() => {});
    }
  });

  function applySnapshot(payload) {
    if (!payload || typeof payload !== "object") return;
    if (typeof payload.unreadCount === "number") updateBadge(payload.unreadCount);
  }

  if (typeof EventSource !== "undefined") {
    try {
      const es = new EventSource("/notifications/stream");
      es.addEventListener("snapshot", (ev) => {
        try {
          applySnapshot(JSON.parse(ev.data));
        } catch {
          /* ignore */
        }
      });
      es.addEventListener("ping", () => {});
    } catch {
      /* SSE optional */
    }
  }
})();
