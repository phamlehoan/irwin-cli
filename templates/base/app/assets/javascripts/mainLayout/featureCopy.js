(function () {
  const section = document.querySelector(".features-section[data-copy-feedback]");
  if (!section) return;

  let feedback = { copied: "Copied", failed: "Could not copy" };
  try {
    feedback = JSON.parse(section.dataset.copyFeedback || "{}");
  } catch {
    /* use defaults */
  }

  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    if (!ok) throw new Error("execCommand failed");
  }

  function resetCopyButton(btn, delay) {
    window.setTimeout(() => {
      btn.classList.remove("feature-card__copy--done", "feature-card__copy--error");
      const aria = btn.dataset.copyAria;
      if (aria) btn.setAttribute("aria-label", aria);
    }, delay);
  }

  function flashCopied(btn) {
    btn.classList.add("feature-card__copy--done");
    btn.setAttribute("aria-label", feedback.copied || "Copied");
    resetCopyButton(btn, 2000);
  }

  function flashFailed(btn) {
    btn.classList.add("feature-card__copy--error");
    btn.setAttribute("aria-label", feedback.failed || "Could not copy");
    resetCopyButton(btn, 2000);
  }

  section.addEventListener("click", async (event) => {
    const btn = event.target.closest(".feature-card__copy");
    if (!btn || !section.contains(btn)) return;

    const text = btn.dataset.copy;
    if (!text) return;

    try {
      await copyText(text);
      flashCopied(btn);
    } catch {
      flashFailed(btn);
    }
  });
})();
