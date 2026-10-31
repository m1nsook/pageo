import MiniSearch from "minisearch";

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
  trigger.setAttribute("aria-haspopup", "dialog");
  trigger.setAttribute("aria-expanded", "false");
  header.appendChild(trigger);

  let shell;
  let input;
  let results;
  let closeButton;
  let previousFocus;
  let loaded = null;
  let engine = null;
  let pending = null;
  let loadError = false;
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
    modal.id = "paglora-search-dialog";
    trigger.setAttribute("aria-controls", modal.id);
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
    input.setAttribute("aria-controls", results.id);
    results.setAttribute("aria-live", "polite");
    results.appendChild(element("p", "paglora-search-status", "Type to search documentation"));
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
      // Enter confirms an IME candidate for Korean, Japanese and Chinese;
      // it must not navigate away before composition has finished.
      if (event.isComposing || event.keyCode === 229) return;
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        if (!currentResults.length) return;
        event.preventDefault();
        if (event.key === "Home") selected = 0;
        else if (event.key === "End") selected = currentResults.length - 1;
        else selected = (selected + (event.key === "ArrowDown" ? 1 : -1) + currentResults.length) % currentResults.length;
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
        ...results.querySelectorAll(".paglora-search-result, .paglora-search-retry")];
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
    trigger.setAttribute("aria-expanded", "false");
    document.body.classList.remove("paglora-search-open");
    (previousFocus?.focus ? previousFocus : trigger).focus?.();
  }

  function normalize(value) {
    return String(value ?? "").toLocaleLowerCase().normalize("NFKC");
  }

  // Keep programming-language tokens such as C++ and C# intact.
  const tokenize = value => normalize(value).split(/[\s.,;:!?()[\]{}\/\\]+/u).filter(Boolean);

  async function load() {
    if (loaded) return loaded;
    if (!pending) {
      loadError = false;
      // Revalidate after a deployment instead of reusing an indefinitely stale index.
      pending = fetch("search-index.json", { cache: "no-cache" })
        .then(response => {
          if (!response.ok) throw new Error("Search index unavailable");
          return response.json();
        })
        .then(data => {
          // Keep raw index validation bounded, but tolerate invalid entries
          // before the first 500 valid public pages (legacy behavior).
          // The exporter itself generates at most 500 entries.
          if (!data || data.version !== 1 || !Array.isArray(data.pages) ||
              data.pages.length > 2000) throw new Error("Invalid search index");
          const seenUrls = new Set();
          loaded = data.pages.filter(page => {
            if (!page || typeof page.title !== "string" || page.title.length > 200 ||
                typeof page.text !== "string" || page.text.length > 30_000 ||
                typeof page.url !== "string" || !/^[a-z0-9-]+\.html$/.test(page.url) ||
                seenUrls.has(page.url)) return false;
            seenUrls.add(page.url);
            return true;
          }).slice(0, 500).map(page => ({
            title: page.title, text: page.text.normalize("NFKC"), url: page.url,
            titleSearch: normalize(page.title), bodySearch: normalize(page.text),
          }));
          engine = new MiniSearch({
            idField: "url", fields: ["titleSearch", "bodySearch"], tokenize,
          });
          engine.addAll(loaded);
          return loaded;
        }).catch(error => { pending = null; loadError = true; throw error; });
    }
    return pending;
  }

  function find(query) {
    // MiniSearch indexes only the sanitized, local public-page JSON.
    // Limit query work and preserve punctuation in programming-language terms.
    const terms = [...new Set(tokenize(query.slice(0, 200)))].slice(0, 8);
    const phrase = terms.join(" ");
    if (!terms.length || !loaded || !engine) return [];
    const options = { combineWith: "AND", prefix: true, boost: { titleSearch: 5 } };
    let hits = engine.search(phrase, options);
    // Typo tolerance is a fallback, never a reason to demote exact matches.
    // Avoid fuzzy matching short technical identifiers (C++, C#, etc.).
    if (!hits.length && terms.every(term => term.length >= 5 && /^[a-z]+$/u.test(term))) {
      hits = engine.search(phrase, { ...options, fuzzy: 0.2 });
    }
    // MiniSearch matches complete tokens, which can miss CJK substrings in
    // longer unsegmented words. Merge substring matches even when other pages
    // have token hits, instead of using substring search only as a fallback.
    // Deduplicate by the validated local URL so a page appears only once.
    const matchesByUrl = new Map();
    for (const hit of hits) {
      const page = loaded.find(item => item.url === hit.id);
      if (page) matchesByUrl.set(page.url, { page, score: hit.score });
    }
    if (/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/u.test(phrase)) {
      for (const page of loaded) {
        if (!matchesByUrl.has(page.url) &&
            terms.every(term => page.titleSearch.includes(term) || page.bodySearch.includes(term))) {
          matchesByUrl.set(page.url, { page, score: 1 });
        }
      }
    }
    return [...matchesByUrl.values()].map(({ page, score }) => {
      if (page.titleSearch === phrase) score += 100;
      else if (page.titleSearch.startsWith(phrase)) score += 40;
      if (page.bodySearch.includes(phrase)) score += 10;
      const positions = terms.map(term => page.bodySearch.indexOf(term)).filter(index => index >= 0);
      const start = Math.max(0, (positions.length ? Math.min(...positions) : 0) - 64);
      return { title: page.title, url: page.url,
        snippet: page.text.slice(start, start + 200).trim(), score };
    }).sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, 8);
  }

  function updateSelected() {
    const links = results.querySelectorAll(".paglora-search-result");
    links.forEach((link, index) => {
      link.classList.toggle("is-selected", index === selected);
      if (index === selected) {
        link.setAttribute("aria-current", "true");
        input.setAttribute("aria-activedescendant", link.id);
        link.scrollIntoView({ block: "nearest" });
      } else link.removeAttribute("aria-current");
    });
  }

  async function retry() {
    // Keep the focused Retry control in the DOM while the request is pending.
    // Removing it immediately drops keyboard focus outside the modal.
    const retryButton = results.querySelectorAll(".paglora-search-retry")[0];
    const restoreFocus = document.activeElement === retryButton;
    if (retryButton) {
      retryButton.disabled = true;
      retryButton.setAttribute("aria-busy", "true");
      retryButton.textContent = "Retrying search…";
    }
    try { await load(); } catch { /* render a retryable error */ }
    if (shell && !shell.hidden) {
      render();
      if (restoreFocus) {
        // A failed retry creates a new button; success returns to the query.
        (results.querySelectorAll(".paglora-search-retry")[0] ?? input).focus();
      }
    }
  }

  function render() {
    const query = input.value.trim();
    currentResults = find(query);
    selected = 0;
    input.removeAttribute("aria-activedescendant");
    results.replaceChildren();
    if (!loaded) {
      results.appendChild(element("p", "paglora-search-status", loadError
        ? "Search index could not be loaded" : "Loading search index…"));
      if (loadError) {
        const retryButton = element("button", "paglora-search-retry", "Retry search");
        retryButton.type = "button";
        retryButton.addEventListener("click", () => { void retry(); });
        results.appendChild(retryButton);
      }
      return;
    }
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
      link.id = "paglora-search-option-" + results.children.length;
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
    trigger.setAttribute("aria-expanded", "true");
    document.body.classList.add("paglora-search-open");
    input.value = "";
    input.focus();
    results.replaceChildren(element("p", "paglora-search-status", "Loading search index…"));
    try {
      await load();
      if (!shell.hidden) render();
    } catch {
      if (!shell.hidden) render();
    }
  }

  trigger.addEventListener("click", () => { void open(); });
  document.addEventListener("keydown", event => {
    if (event.isComposing || event.keyCode === 229) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      if (shell && !shell.hidden) close();
      else void open();
    } else if (event.key === "Escape" && shell && !shell.hidden) {
      event.preventDefault(); close();
    }
  });
})();
