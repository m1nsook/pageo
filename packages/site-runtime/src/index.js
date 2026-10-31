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

  // The export embeds reviewed translation strings as JSON, not executable code.
  let translations = {};
  try {
    translations = JSON.parse(document.getElementById?.("paglora-i18n")?.textContent || "{}");
  } catch { /* keep English defaults when the dictionary is unavailable */ }
  const tr = (key, english, args = {}) => {
    const value = typeof translations[key] === "string" ? translations[key] : english;
    return value.replace(/\{([a-z][a-zA-Z0-9_]*)\}/g, (match, name) =>
      Object.prototype.hasOwnProperty.call(args, name) ? String(args[name]) : match);
  };

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
    const label = mode === "dark" ? tr("site.appearance.dark", "Dark") :
      mode === "light" ? tr("site.appearance.light", "Light") : tr("site.appearance.system", "System");
    toggle.textContent = (mode === "dark" ? "☾ " : mode === "light" ? "☀ " : "◐ ") + label;
    const description = tr("site.appearance.change", "Appearance: {mode}. Change theme", { mode: label });
    toggle.setAttribute("aria-label", description);
    toggle.title = description;
  }
  setAppearance(readPreference());
  // Keep separately opened documentation tabs in sync without requiring reload.
  // Ignore storage changes from other Paglora sites hosted on this origin.
  addEventListener("storage", event => {
    if (event.key !== storageKey) return;
    setAppearance(modes.includes(event.newValue) ? event.newValue : configured);
  });
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
    copy.textContent = tr("site.copy.copy", "Copy");
    copy.setAttribute("aria-label", tr("site.copy.copyLabel", "Copy code block"));
    copy.setAttribute("aria-live", "polite");
    pre.appendChild(copy);
    pre.classList.add("paglora-has-copy");
    let resetTimer;
    function showFeedback(text, label) {
      copy.textContent = text;
      copy.setAttribute("aria-label", label);
      if (resetTimer !== undefined) clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        copy.textContent = tr("site.copy.copy", "Copy");
        copy.setAttribute("aria-label", tr("site.copy.copyLabel", "Copy code block"));
        resetTimer = undefined;
      }, 2000);
    }
    let copying = false;
    copy.addEventListener("click", async () => {
      if (copying) return;
      if (!navigator.clipboard?.writeText) {
        showFeedback(tr("site.copy.unavailable", "Unavailable"), tr("site.copy.unavailableLabel", "Clipboard unavailable"));
        return;
      }
      // Cancel a previous success timer so it cannot erase the in-flight
      // status of a slower subsequent clipboard operation.
      if (resetTimer !== undefined) {
        clearTimeout(resetTimer);
        resetTimer = undefined;
      }
      copying = true;
      copy.disabled = true;
      copy.textContent = tr("site.copy.copying", "Copying…");
      copy.setAttribute("aria-label", tr("site.copy.copyingLabel", "Copying code to clipboard"));
      copy.setAttribute("aria-busy", "true");
      try {
        await navigator.clipboard.writeText(code.textContent ?? "");
        showFeedback(tr("site.copy.copied", "Copied"), tr("site.copy.copiedLabel", "Code copied to clipboard"));
      } catch {
        showFeedback(tr("site.copy.unavailable", "Unavailable"), tr("site.copy.unavailableLabel", "Clipboard unavailable"));
      } finally {
        copying = false;
        copy.disabled = false;
        copy.removeAttribute("aria-busy");
      }
    });
  }


  // Code groups are readable as labeled, stacked examples without scripts.
  // Only after the full tab interface exists do we hide inactive examples.
  let codeGroupIndex = 0;
  for (const group of document.querySelectorAll?.(".docs .paglora-code-group") ?? []) {
    const panels = Array.from(group.querySelectorAll(".paglora-code-group-item"));
    const container = group.querySelector(".paglora-code-group-panels");
    if (panels.length < 2 || !container) continue;
    const groupId = codeGroupIndex++;
    const tablist = document.createElement("div");
    tablist.className = "paglora-code-group-tabs";
    tablist.setAttribute("role", "tablist");
    tablist.setAttribute("aria-label", group.getAttribute("aria-label") || "Code examples");
    const tabs = panels.map((panel, index) => {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "paglora-code-group-tab";
      tab.textContent = panel.querySelector(".paglora-code-group-label")?.textContent || "Example " + (index + 1);
      const tabId = "paglora-code-tab-" + groupId + "-" + index;
      const panelId = "paglora-code-panel-" + groupId + "-" + index;
      tab.id = tabId;
      panel.id = panelId;
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-controls", panelId);
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", tabId);
      panel.tabIndex = 0;
      tab.addEventListener("click", () => activate(index));
      tab.addEventListener("keydown", event => {
        const direction = root.dir === "rtl" ? -1 : 1;
        let next = index;
        if (event.key === "ArrowRight") next = (index + direction + tabs.length) % tabs.length;
        else if (event.key === "ArrowLeft") next = (index - direction + tabs.length) % tabs.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = tabs.length - 1;
        else return;
        event.preventDefault();
        activate(next, true);
      });
      tablist.appendChild(tab);
      return tab;
    });
    function activate(selected, focus = false) {
      tabs.forEach((tab, index) => {
        const active = index === selected;
        tab.setAttribute("aria-selected", String(active));
        tab.tabIndex = active ? 0 : -1;
        panels[index].hidden = !active;
      });
      if (focus) tabs[selected].focus();
    }
    container.before(tablist);
    activate(0);
    group.classList.add("paglora-code-group-enhanced");
  }

  // General content tabs share the script-free, stacked-panel fallback of
  // code groups. Never hide a panel until all controls are ready.
  let contentTabsIndex = 0;
  for (const group of document.querySelectorAll?.(".docs .paglora-tabs") ?? []) {
    const panels = Array.from(group.querySelectorAll(".paglora-tabs-item"));
    const container = group.querySelector(".paglora-tabs-panels");
    if (panels.length < 2 || !container) continue;
    const groupId = contentTabsIndex++;
    const tablist = document.createElement("div");
    tablist.className = "paglora-tabs-tablist";
    tablist.setAttribute("role", "tablist");
    tablist.setAttribute("aria-label", group.getAttribute("aria-label") || "Content tabs");
    const tabs = panels.map((panel, index) => {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "paglora-tabs-tab";
      tab.textContent = panel.querySelector(".paglora-tabs-label")?.textContent || "Tab " + (index + 1);
      const tabId = "paglora-content-tab-" + groupId + "-" + index;
      const panelId = "paglora-content-panel-" + groupId + "-" + index;
      tab.id = tabId;
      panel.id = panelId;
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-controls", panelId);
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", tabId);
      panel.tabIndex = 0;
      tab.addEventListener("click", () => activate(index));
      tab.addEventListener("keydown", event => {
        const direction = root.dir === "rtl" ? -1 : 1;
        let next = index;
        if (event.key === "ArrowRight") next = (index + direction + tabs.length) % tabs.length;
        else if (event.key === "ArrowLeft") next = (index - direction + tabs.length) % tabs.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = tabs.length - 1;
        else return;
        event.preventDefault();
        activate(next, true);
      });
      tablist.appendChild(tab);
      return tab;
    });
    function activate(selected, focus = false) {
      tabs.forEach((tab, index) => {
        const active = index === selected;
        tab.setAttribute("aria-selected", String(active));
        tab.tabIndex = active ? 0 : -1;
        panels[index].hidden = !active;
      });
      if (focus) tabs[selected].focus();
    }
    container.before(tablist);
    activate(0);
    group.classList.add("paglora-tabs-enhanced");
  }

  // Expose sharable heading anchors without changing project Markdown.
  for (const heading of document.querySelectorAll?.(".docs h2[id], .docs h3[id], .docs h4[id]") ?? []) {
    const id = heading.getAttribute("id");
    if (!id) continue;
    const link = document.createElement("a");
    link.className = "paglora-heading-link";
    link.href = "#" + encodeURIComponent(id);
    link.textContent = "#";
    link.setAttribute("aria-label", tr("site.heading.linkTo", "Link to {heading}", {
      heading: (heading.textContent ?? tr("site.heading.section", "section")).trim().slice(0, 160)
    }));
    heading.appendChild(link);
  }

  // Highlight the TOC heading the reader is currently passing. This is a
  // progressive enhancement: anchor links work without JavaScript.
  const mobileOutline = document.querySelector(".mobile-toc");
  const outlines = [document.querySelector(".toc-inner"), mobileOutline].filter(Boolean);
  if (!outlines.length) return;
  // Desktop and mobile outlines point to the same headings. Keep both sets
  // of links synchronized, even when the desktop sidebar is CSS-hidden.
  const items = outlines.flatMap(outline => [...outline.querySelectorAll('a[href^="#"]')])
    .map(link => {
      let id = link.getAttribute("href").slice(1);
      try { id = decodeURIComponent(id); } catch { return null; }
      const heading = document.getElementById(id);
      return heading ? { link, heading } : null;
    })
    .filter(Boolean);
  if (!items.length) return;

  // Close the mobile "On this page" drawer after a heading is selected.
  mobileOutline?.addEventListener("click", event => {
    if (event.target?.closest?.('a[href^="#"]')) mobileOutline.open = false;
  });

  let scheduled = false;
  function markActiveHeading() {
    scheduled = false;
    let activeHeading = items[0].heading;
    let closestPassed = -Infinity;
    let closestUpcoming = Infinity;
    // Desktop and mobile TOCs duplicate headings and may be ordered differently.
    // Select by actual viewport position, not whichever duplicate appears last.
    for (const item of items) {
      const top = item.heading.getBoundingClientRect().top;
      if (top <= 140 && top > closestPassed) {
        closestPassed = top;
        activeHeading = item.heading;
      } else if (closestPassed === -Infinity && top > 140 && top < closestUpcoming) {
        closestUpcoming = top;
        activeHeading = item.heading;
      }
    }
    for (const item of items) {
      if (item.heading === activeHeading) item.link.setAttribute("aria-current", "location");
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
