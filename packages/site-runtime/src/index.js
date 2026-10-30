/*
 * Paglora site runtime. MIT licensed; see repository LICENSE.
 * Progressive enhancement for generated HTML, inspired by VitePress's
 * approach to navigation/appearance. No VitePress source is copied here.
 */
(() => {
  "use strict";
  const root = document.documentElement;
  const header = document.querySelector(".top-bar");
  if (!root || !header) return;

  const modes = ["light", "dark", "system"];
  const configured = modes.includes(root.dataset.colorMode)
    ? root.dataset.colorMode : "system";
  // Prefix by deployed site root so independent Paglora sites do not share
  // preferences when hosted under the same origin at different paths.
  const storageKey = "paglora:theme:" + new URL(".", location.href).pathname;
  function readPreference() {
    try {
      const stored = localStorage.getItem(storageKey);
      return modes.includes(stored) ? stored : configured;
    } catch {
      return configured;
    }
  }
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "paglora-appearance-toggle";
  toggle.setAttribute("data-paglora-appearance", "");
  header.appendChild(toggle);
  function setAppearance(mode) {
    root.dataset.colorMode = mode;
    toggle.textContent = mode === "dark" ? "☾ Dark" :
      mode === "light" ? "☀ Light" : "◐ System";
    toggle.setAttribute("aria-label", "Appearance: " + mode + ". Change theme");
    toggle.title = "Appearance: " + mode + ". Change theme";
  }
  setAppearance(readPreference());
  toggle.addEventListener("click", () => {
    const next = modes[(modes.indexOf(root.dataset.colorMode) + 1) % modes.length];
    setAppearance(next);
    try { localStorage.setItem(storageKey, next); } catch { /* storage disabled */ }
  });

  // Give generated Markdown code blocks copy controls. Clipboard access
  // requires a secure context; a failure never affects readable code.
  for (const code of document.querySelectorAll?.(".docs pre > code") ?? []) {
    const pre = code.parentElement;
    if (!pre) continue;
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "paglora-copy-code";
    copy.textContent = "Copy";
    copy.setAttribute("aria-label", "Copy code block");
    pre.appendChild(copy);
    pre.classList.add("paglora-has-copy");
    copy.addEventListener("click", async () => {
      if (!navigator.clipboard?.writeText) {
        copy.textContent = "Unavailable";
        return;
      }
      try {
        await navigator.clipboard.writeText(code.textContent ?? "");
        copy.textContent = "Copied";
        copy.setAttribute("aria-label", "Code copied to clipboard");
      } catch {
        copy.textContent = "Unavailable";
      }
    });
  }

  // Expose sharable heading anchors without changing project Markdown.
  for (const heading of document.querySelectorAll?.(".docs h2[id], .docs h3[id]") ?? []) {
    const id = heading.getAttribute("id");
    if (!id) continue;
    const link = document.createElement("a");
    link.className = "paglora-heading-link";
    link.href = "#" + encodeURIComponent(id);
    link.textContent = "#";
    link.setAttribute("aria-label", "Link to " + (heading.textContent ?? "section").trim().slice(0, 160));
    heading.appendChild(link);
  }

  // Highlight the TOC heading the reader is currently passing. This is a
  // progressive enhancement: anchor links work without JavaScript.
  const outline = document.querySelector(".toc-inner");
  if (!outline) return;
  const items = [...outline.querySelectorAll('a[href^="#"]')]
    .map(link => {
      const heading = document.getElementById(link.getAttribute("href").slice(1));
      return heading ? { link, heading } : null;
    })
    .filter(Boolean);
  if (!items.length) return;

  let scheduled = false;
  function markActiveHeading() {
    scheduled = false;
    let active = items[0];
    for (const item of items) {
      if (item.heading.getBoundingClientRect().top <= 140) active = item;
    }
    for (const item of items) {
      if (item === active) item.link.setAttribute("aria-current", "location");
      else item.link.removeAttribute("aria-current");
    }
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(markActiveHeading);
  }
  addEventListener("scroll", schedule, { passive: true });
  addEventListener("resize", schedule, { passive: true });
  addEventListener("hashchange", schedule);
  schedule();
})();
