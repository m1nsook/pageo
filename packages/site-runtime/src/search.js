/*
 * Paglora static site search. No framework, server endpoint, or unsafe HTML.
 * Inspired by the Ctrl+K local search experience in VitePress (MIT).
 * The exported search-index.json contains only public, sanitized page text.
 */
(() => {
  "use strict";
  const header = document.querySelector(".top-bar");
  if (!header) return;
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "paglora-search-trigger";
  trigger.textContent = "Search";
  trigger.setAttribute("aria-label", "Search documentation");
  trigger.setAttribute("aria-keyshortcuts", "Control+K Meta+K");
  header.appendChild(trigger);

  let shell;
  let input;
  let results;
  let status;
  let closeButton;
  let previousFocus;
  let loaded = null;
  let pending = null;
  let selected = 0;
  let currentResults = [];

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function buildDialog() {
    shell = element("div", "paglora-search-backdrop");
    shell.hidden = true;
    shell.setAttribute("data-paglora-search", "");
    const modal = element("section", "paglora-search-dialog");
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", "Search documentation");
    const bar = element("div", "paglora-search-field");
    input = element("input", "paglora-search-input");
    input.type = "search";
    input.placeholder = "Search documentation…";
    input.autocomplete = "off";
    input.setAttribute("aria-label", "Search all public documentation pages");
    closeButton = element("button", "paglora-search-close", "Esc");
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Close search");
    bar.append(input, closeButton);
    results = element("div", "paglora-search-results");
    results.id = "paglora-search-results";
    results.setAttribute("aria-live", "polite");
    status = element("p", "paglora-search-status", "Type to search documentation");
    results.appendChild(status);
    const foot = element("div", "paglora-search-footnote", "↑ ↓ Navigate  ·  Enter Open  ·  Esc Close");
    modal.append(bar, results, foot);
    shell.appendChild(modal);
    document.body.appendChild(shell);
    shell.addEventListener("mousedown", event => {
      if (event.target === shell) close();
    });
    closeButton.addEventListener("click", close);
    input.addEventListener("input", render);
    input.addEventListener("keydown", event => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (!currentResults.length) return;
        selected = (selected + (event.key === "ArrowDown" ? 1 : -1) + currentResults.length) % currentResults.length;
        updateSelected();
      } else if (event.key === "Enter" && currentResults.length) {
        event.preventDefault();
        window.location.assign(currentResults[selected].url);
      }
    });
    shell.addEventListener("keydown", event => {
      if (event.key !== "Tab") return;
      // Include the result links in the dialog's keyboard focus cycle.
      // Merely trapping focus between the input and close button would make
      // links unreachable with Tab (screen readers and keyboard users).
      const controls = [input, closeButton,
        ...results.querySelectorAll(".paglora-search-result")];
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    });
  }

  function close() {
    if (!shell || shell.hidden) return;
    shell.hidden = true;
    document.body.classList.remove("paglora-search-open");
    previousFocus?.focus?.();
  }

  function normalize(value) {
    return String(value ?? "").toLocaleLowerCase().normalize("NFKC");
  }

  async function load() {
    if (loaded) return loaded;
    if (!pending) {
      pending = fetch("search-index.json", { cache: "force-cache" })
        .then(response => {
          if (!response.ok) throw new Error("Search index unavailable");
          return response.json();
        })
        .then(data => {
          if (!data || data.version !== 1 || !Array.isArray(data.pages)) throw new Error("Invalid search index");
          loaded = data.pages.slice(0, 500).filter(page =>
            typeof page.title === "string" &&
            typeof page.text === "string" &&
            typeof page.url === "string" &&
            /^[a-z0-9-]+\.html$/.test(page.url)
          ).map(page => ({
            title: page.title, text: page.text, url: page.url,
            titleSearch: normalize(page.title), bodySearch: normalize(page.text),
          }));
          return loaded;
        }).catch(error => { pending = null; throw error; });
    }
    return pending;
  }

  function find(query) {
    const terms = normalize(query).trim().split(/\s+/).filter(Boolean).slice(0, 8);
    if (!terms.length || !loaded) return [];
    const matches = [];
    for (const page of loaded) {
      let score = 0;
      let firstTextMatch = -1;
      for (const word of terms) {
        const titleAt = page.titleSearch.indexOf(word);
        const bodyAt = page.bodySearch.indexOf(word);
        if (titleAt < 0 && bodyAt < 0) { score = 0; break; }
        if (titleAt >= 0) score += titleAt === 0 ? 12 : 8;
        if (bodyAt >= 0) {
          score += 2;
          if (firstTextMatch < 0) firstTextMatch = bodyAt;
        }
      }
      if (score) {
        const start = Math.max(0, (firstTextMatch < 0 ? 0 : firstTextMatch) - 64);
        const snippet = page.text.slice(start, start + 200).trim();
        matches.push({ title: page.title, url: page.url, snippet, score });
      }
    }
    return matches.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, 8);
  }

  function updateSelected() {
    const links = results.querySelectorAll(".paglora-search-result");
    links.forEach((link, index) => {
      link.classList.toggle("is-selected", index === selected);
      if (index === selected) {
        link.setAttribute("aria-current", "true");
        link.scrollIntoView({ block: "nearest" });
      } else link.removeAttribute("aria-current");
    });
  }

  function render() {
    const query = input.value.trim();
    currentResults = find(query);
    selected = 0;
    results.replaceChildren();
    if (!query) {
      results.appendChild(element("p", "paglora-search-status", "Type to search documentation"));
      return;
    }
    if (!currentResults.length) {
      results.appendChild(element("p", "paglora-search-status", "No matching pages"));
      return;
    }
    for (const item of currentResults) {
      const link = element("a", "paglora-search-result");
      link.href = item.url;
      const title = element("strong", "paglora-search-result-title", item.title);
      const summary = element("span", "paglora-search-result-summary", item.snippet || "Open page");
      link.append(title, summary);
      link.addEventListener("mouseenter", () => {
        selected = currentResults.indexOf(item);
        updateSelected();
      });
      results.appendChild(link);
    }
    updateSelected();
  }

  async function open() {
    if (!shell) buildDialog();
    if (!shell.hidden) { input.focus(); return; }
    previousFocus = document.activeElement;
    shell.hidden = false;
    document.body.classList.add("paglora-search-open");
    input.value = "";
    input.focus();
    results.replaceChildren(element("p", "paglora-search-status", "Loading search index…"));
    try {
      await load();
      if (!shell.hidden) render();
    } catch {
      if (!shell.hidden) results.replaceChildren(element("p", "paglora-search-status", "Search index could not be loaded"));
    }
  }

  trigger.addEventListener("click", () => { void open(); });
  document.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      if (shell && !shell.hidden) close();
      else void open();
    } else if (event.key === "Escape" && shell && !shell.hidden) {
      event.preventDefault(); close();
    }
  });
})();
