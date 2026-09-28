(() => {
  "use strict";

  // ---------- Config ----------
  const HISTORY_KEY = "encyclopedia_history";
  const THEME_KEY = "encyclopedia_theme";
  const LANG_KEY = "encyclopedia_lang";
  const MAX_HISTORY = 20;

  // ---------- State ----------
  let lang = localStorage.getItem(LANG_KEY) || "en";
  let currentView = "home";
  let lastResults = [];
  let suggestTimer = null;

  // ---------- DOM ----------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const searchInput = $("#searchInput");
  const searchForm = $("#searchForm");
  const suggestions = $("#suggestions");
  const loader = $("#loader");
  const toast = $("#toast");
  const sideMenu = $("#sideMenu");
  const overlay = $("#overlay");
  const main = $("#main");
  const themeBtn = $("#themeBtn");
  const langSelect = $("#langSelect");

  // Views
  const views = {
    home: $("#homeView"),
    results: $("#resultsView"),
    article: $("#articleView"),
    history: $("#historyView"),
    about: $("#aboutView"),
  };

  // ---------- Theme ----------
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    themeBtn.textContent = theme === "dark" ? "☀️" : "🌙";
    localStorage.setItem(THEME_KEY, theme);
  }

  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) {
      applyTheme(saved);
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      applyTheme("dark");
    } else {
      applyTheme("light");
    }
  }

  themeBtn.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    applyTheme(current === "dark" ? "light" : "dark");
  });

  // ---------- Language ----------
  langSelect.value = lang;
  langSelect.addEventListener("change", () => {
    lang = langSelect.value;
    localStorage.setItem(LANG_KEY, lang);
    showToast(`Language set to ${langSelect.options[langSelect.selectedIndex].text}`);
    showView("home");
  });

  // ---------- API helpers ----------
  function apiBase() {
    return `https://${lang}.wikipedia.org/w/api.php`;
  }

  async function wikiFetch(params) {
    const url = new URL(apiBase());
    url.searchParams.set("format", "json");
    url.searchParams.set("origin", "*");
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error("Network error");
    return res.json();
  }

  // ---------- UI helpers ----------
  function showLoader(show = true) {
    loader.classList.toggle("hidden", !show);
  }

  function showToast(msg, ms = 2200) {
    toast.textContent = msg;
    toast.classList.remove("hidden");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toast.classList.add("hidden"), ms);
  }

  function showView(name) {
    Object.values(views).forEach((v) => v.classList.add("hidden"));
    if (views[name]) views[name].classList.remove("hidden");
    currentView = name;
    closeMenu();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openMenu() {
    sideMenu.classList.add("open");
    overlay.classList.remove("hidden");
    sideMenu.setAttribute("aria-hidden", "false");
  }

  function closeMenu() {
    sideMenu.classList.remove("open");
    overlay.classList.add("hidden");
    sideMenu.setAttribute("aria-hidden", "true");
  }

  $("#menuBtn").addEventListener("click", openMenu);
  $("#closeMenu").addEventListener("click", closeMenu);
  overlay.addEventListener("click", closeMenu);

  // Side menu actions
  sideMenu.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === "home") showView("home");
    else if (action === "random") loadRandom();
    else if (action === "featured") loadFeatured();
    else if (action === "history") showHistory();
    else if (action === "about") showView("about");
  });

  // Quick actions & chips
  document.addEventListener("click", (e) => {
    const actionBtn = e.target.closest("[data-action]");
    if (actionBtn && !sideMenu.contains(actionBtn)) {
      const a = actionBtn.dataset.action;
      if (a === "random") loadRandom();
      if (a === "featured") loadFeatured();
    }
    const chip = e.target.closest(".chip");
    if (chip) {
      searchInput.value = chip.dataset.query;
      doSearch(chip.dataset.query);
    }
  });

  // ---------- History ----------
  function getHistory() {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function saveHistory(title) {
    let hist = getHistory().filter((t) => t !== title);
    hist.unshift(title);
    hist = hist.slice(0, MAX_HISTORY);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(hist));
    renderRecent();
  }

  function renderRecent() {
    const hist = getHistory();
    const section = $("#recentSection");
    const list = $("#recentList");
    if (!hist.length) {
      section.classList.add("hidden");
      return;
    }
    section.classList.remove("hidden");
    list.innerHTML = hist
      .slice(0, 6)
      .map(
        (t) =>
          `<button class="recent-item" data-title="${escapeAttr(t)}">${escapeHtml(t)}</button>`
      )
      .join("");
    list.querySelectorAll(".recent-item").forEach((btn) => {
      btn.addEventListener("click", () => loadArticle(btn.dataset.title));
    });
  }

  function showHistory() {
    const hist = getHistory();
    const list = $("#historyList");
    if (!hist.length) {
      list.innerHTML = `<div class="empty">No recent searches yet.</div>`;
    } else {
      list.innerHTML = hist
        .map(
          (t) =>
            `<button class="result-card" data-title="${escapeAttr(t)}">
              <div class="result-body"><h3>${escapeHtml(t)}</h3></div>
            </button>`
        )
        .join("");
      list.querySelectorAll(".result-card").forEach((btn) => {
        btn.addEventListener("click", () => loadArticle(btn.dataset.title));
      });
    }
    showView("history");
  }

  $("#clearHistory").addEventListener("click", () => {
    localStorage.removeItem(HISTORY_KEY);
    renderRecent();
    showHistory();
    showToast("History cleared");
  });

  // ---------- Search & Suggestions ----------
  searchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = searchInput.value.trim();
    if (q) doSearch(q);
    suggestions.classList.add("hidden");
  });

  searchInput.addEventListener("input", () => {
    clearTimeout(suggestTimer);
    const q = searchInput.value.trim();
    if (q.length < 2) {
      suggestions.classList.add("hidden");
      return;
    }
    suggestTimer = setTimeout(() => fetchSuggestions(q), 280);
  });

  searchInput.addEventListener("focus", () => {
    if (suggestions.children.length) suggestions.classList.remove("hidden");
  });

  document.addEventListener("click", (e) => {
    if (!searchForm.contains(e.target)) suggestions.classList.add("hidden");
  });

  async function fetchSuggestions(q) {
    try {
      const data = await wikiFetch({
        action: "opensearch",
        search: q,
        limit: 8,
        namespace: 0,
      });
      // opensearch returns [query, titles[], descriptions[], urls[]]
      const titles = data[1] || [];
      if (!titles.length) {
        suggestions.classList.add("hidden");
        return;
      }
      suggestions.innerHTML = titles
        .map(
          (t) =>
            `<li role="option" tabindex="0" data-title="${escapeAttr(t)}">${escapeHtml(t)}</li>`
        )
        .join("");
      suggestions.classList.remove("hidden");
      suggestions.querySelectorAll("li").forEach((li) => {
        li.addEventListener("click", () => {
          searchInput.value = li.dataset.title;
          suggestions.classList.add("hidden");
          loadArticle(li.dataset.title);
        });
      });
    } catch {
      suggestions.classList.add("hidden");
    }
  }

  async function doSearch(query) {
    showLoader(true);
    try {
      const data = await wikiFetch({
        action: "query",
        generator: "search",
        gsrsearch: query,
        gsrlimit: 15,
        prop: "pageimages|extracts|info",
        piprop: "thumbnail",
        pithumbsize: 120,
        exintro: 1,
        explaintext: 1,
        exchars: 180,
        inprop: "url",
      });

      const pages = data.query?.pages ? Object.values(data.query.pages) : [];
      pages.sort((a, b) => (a.index || 0) - (b.index || 0));
      lastResults = pages;

      $("#resultsTitle").textContent = `Results for “${query}”`;
      const list = $("#resultsList");
      if (!pages.length) {
        list.innerHTML = `<div class="empty">No results found. Try a different search.</div>`;
      } else {
        list.innerHTML = pages
          .map(
            (p) => `
          <button class="result-card" data-title="${escapeAttr(p.title)}">
            ${
              p.thumbnail
                ? `<img class="result-thumb" src="${p.thumbnail.source}" alt="" loading="lazy" />`
                : `<div class="result-thumb" style="display:flex;align-items:center;justify-content:center;font-size:1.5rem">📄</div>`
            }
            <div class="result-body">
              <h3>${escapeHtml(p.title)}</h3>
              <p>${escapeHtml(p.extract || "No summary available.")}</p>
            </div>
          </button>`
          )
          .join("");
        list.querySelectorAll(".result-card").forEach((btn) => {
          btn.addEventListener("click", () => loadArticle(btn.dataset.title));
        });
      }
      showView("results");
    } catch (err) {
      showToast("Search failed. Check your connection.");
      console.error(err);
    } finally {
      showLoader(false);
    }
  }

  // ---------- Load Article ----------
  async function loadArticle(title) {
    showLoader(true);
    try {
      const data = await wikiFetch({
        action: "query",
        titles: title,
        prop: "extracts|pageimages|info",
        exintro: 0,
        explaintext: 1,
        piprop: "thumbnail",
        pithumbsize: 800,
        inprop: "url",
        redirects: 1,
      });

      const page = Object.values(data.query.pages)[0];
      if (!page || page.missing) {
        showToast("Article not found");
        return;
      }

      saveHistory(page.title);

      const content = $("#articleContent");
      content.innerHTML = `
        <div class="article-header">
          <h1>${escapeHtml(page.title)}</h1>
          <div class="article-meta">From Wikipedia • ${lang.toUpperCase()}</div>
        </div>
        ${
          page.thumbnail
            ? `<img class="article-image" src="${page.thumbnail.source}" alt="${escapeAttr(page.title)}" />`
            : ""
        }
        <div class="article-extract">${formatExtract(page.extract || "No content available.")}</div>
      `;

      const wikiLink = $("#wikiLink");
      wikiLink.href = page.fullurl || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(page.title)}`;

      $("#shareBtn").onclick = () => shareArticle(page.title, wikiLink.href);

      showView("article");
    } catch (err) {
      showToast("Failed to load article");
      console.error(err);
    } finally {
      showLoader(false);
    }
  }

  function formatExtract(text) {
    // Split into paragraphs for better readability
    return text
      .split(/\n+/)
      .filter((p) => p.trim())
      .map((p) => `<p>${escapeHtml(p.trim())}</p>`)
      .join("");
  }

  // ---------- Random & Featured ----------
  async function loadRandom() {
    showLoader(true);
    try {
      const data = await wikiFetch({
        action: "query",
        list: "random",
        rnnamespace: 0,
        rnlimit: 1,
      });
      const title = data.query.random[0].title;
      await loadArticle(title);
    } catch {
      showToast("Could not load random article");
      showLoader(false);
    }
  }

  async function loadFeatured() {
    // Use today's featured article via the TFA API (English has a solid endpoint)
    // For other languages fall back to random of "Featured articles" category or just random
    showLoader(true);
    try {
      if (lang === "en") {
        const today = new Date();
        const y = today.getUTCFullYear();
        const m = String(today.getUTCMonth() + 1).padStart(2, "0");
        const d = String(today.getUTCDate()).padStart(2, "0");
        const dateStr = `${y}/${m}/${d}`;

        const res = await fetch(
          `https://api.wikimedia.org/feed/v1/wikipedia/en/featured/${dateStr}`
        );
        if (res.ok) {
          const feed = await res.json();
          const tfa = feed.tfa;
          if (tfa && tfa.titles && tfa.titles.normalized) {
            await loadArticle(tfa.titles.normalized);
            return;
          }
        }
      }
      // Fallback: pick from featured articles category if available, else random
      await loadRandom();
    } catch {
      await loadRandom();
    }
  }

  // ---------- Share ----------
  async function shareArticle(title, url) {
    if (navigator.share) {
      try {
        await navigator.share({ title, url, text: `Read about ${title}` });
      } catch {
        /* user cancelled */
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        showToast("Link copied to clipboard");
      } catch {
        showToast("Could not share");
      }
    }
  }

  // ---------- Back button ----------
  $("#backBtn").addEventListener("click", () => {
    if (lastResults.length) showView("results");
    else showView("home");
  });

  // ---------- Utilities ----------
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/'/g, "&#39;");
  }

  // ---------- Init ----------
  initTheme();
  renderRecent();
  showView("home");

  // Expose for debugging if needed
  window.Encyclopedia = { loadArticle, doSearch, loadRandom };
})();
