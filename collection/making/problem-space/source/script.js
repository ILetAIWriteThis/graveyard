(async () => {
  "use strict";

  let data;
  try {
    const response = await fetch(new URL("data/problems.json", document.baseURI));
    if (!response.ok) throw new Error(`Problem data returned ${response.status}`);
    data = await response.json();
  } catch (error) {
    document.body.innerHTML = '<main class="fatal-state"><p>Problem Space could not read its graph.</p><small>Refresh online or validate the repository data.</small></main>';
    return;
  }
  if (!Array.isArray(data?.problems)) return;

  const problems = data.problems;
  const byId = new Map(problems.map((problem) => [problem.id, problem]));
  const parents = new Map(problems.map((problem) => [problem.id, []]));
  problems.forEach((problem) => {
    problem.children.forEach((childId) => {
      if (parents.has(childId)) parents.get(childId).push(problem.id);
    });
  });
  const roots = problems.filter((problem) => parents.get(problem.id).length === 0);
  const rootFor = new Map();
  roots.forEach((root) => {
    const queue = [root.id];
    const seen = new Set();
    while (queue.length) {
      const id = queue.shift();
      if (seen.has(id)) continue;
      seen.add(id);
      if (!rootFor.has(id)) rootFor.set(id, root.id);
      byId.get(id)?.children.forEach((childId) => queue.push(childId));
    }
  });

  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
  const escapeHtml = (value) =>
    String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[character]);

  let currentId = getIdFromHash() || roots[0]?.id || null;
  if (currentId && !byId.has(currentId)) currentId = roots[0]?.id || null;
  let trail = [];
  let toastTimer;

  function getIdFromHash() {
    return location.hash.startsWith("#problem/") ? decodeURIComponent(location.hash.slice(9)) : null;
  }

  function shortestAncestry(id) {
    if (roots.some((root) => root.id === id)) return [id];
    const queue = [[id]];
    const visited = new Set();
    while (queue.length) {
      const path = queue.shift();
      const head = path[0];
      if (visited.has(head)) continue;
      visited.add(head);
      if (roots.some((root) => root.id === head)) return path;
      (parents.get(head) || []).forEach((parentId) => queue.push([parentId, ...path]));
    }
    return [id];
  }

  function rootAccent(problem) {
    const root = byId.get(rootFor.get(problem.id));
    return root?.accent || problem.accent || "#d9ff4b";
  }

  function navigate(id, options = {}) {
    if (!byId.has(id)) return;
    const { history = true, remember = true, focusAtlas = false } = options;
    currentId = id;
    if (remember && trail.at(-1) !== id) {
      trail.push(id);
      trail = trail.slice(-8);
    }
    if (history) window.history.pushState({ problemId: id }, "", `#problem/${encodeURIComponent(id)}`);
    render();
    if (focusAtlas) $("#atlas").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderRoots() {
    $("#root-count").textContent = String(roots.length).padStart(2, "0");
    if (!roots.length) {
      $("#root-list").innerHTML = '<div class="root-empty"><i aria-hidden="true"></i><span>No problems yet</span><small>The first real question belongs to you.</small></div>';
      return;
    }
    $("#root-list").innerHTML = roots.map((root) => `
      <button class="root-button ${rootFor.get(currentId) === root.id ? "is-active" : ""}" type="button" data-go="${root.id}" style="--root-accent:${root.accent || "#d9ff4b"}">
        <i aria-hidden="true"></i>
        <span>${escapeHtml(root.title)}</span>
        <small>${escapeHtml(root.domain)}</small>
      </button>`).join("");
  }

  function renderBreadcrumbs() {
    const path = shortestAncestry(currentId);
    $("#breadcrumbs").innerHTML = path.map((id, index) => {
      const problem = byId.get(id);
      const divider = index ? '<i aria-hidden="true">/</i>' : "";
      return `${divider}<button type="button" data-go="${id}" title="${escapeHtml(problem.title)}">${index ? "…" : "root"} ${escapeHtml(problem.title)}</button>`;
    }).join("");
  }

  function collectGraphNodes(problem) {
    const result = [];
    const seen = new Set([problem.id]);
    const add = (id, kind) => {
      if (!id || seen.has(id) || !byId.has(id)) return;
      seen.add(id);
      result.push({ problem: byId.get(id), kind });
    };
    (parents.get(problem.id) || []).slice(0, 2).forEach((id) => add(id, "parent"));
    problem.children.slice(0, 4).forEach((id) => add(id, "child"));
    problem.related.slice(0, 4).forEach((relation) => add(relation.id, "related"));
    problems.forEach((candidate) => {
      if (result.filter((item) => item.kind === "related").length >= 4) return;
      if (candidate.related.some((relation) => relation.id === problem.id)) add(candidate.id, "related");
    });
    return result;
  }

  function positionFor(kind, index, total) {
    if (kind === "parent") return { x: total === 1 ? 50 : 32 + index * 36, y: 14 };
    if (kind === "child") return { x: total === 1 ? 50 : 13 + index * (74 / (total - 1)), y: 82 };
    if (kind === "related") {
      const positions = [{ x: 13, y: 42 }, { x: 87, y: 42 }, { x: 14, y: 62 }, { x: 86, y: 62 }];
      return positions[index] || positions[0];
    }
    return { x: 50, y: 49 };
  }

  function renderGraph() {
    const current = byId.get(currentId);
    const neighbors = collectGraphNodes(current);
    const kindTotals = ["parent", "child", "related"].reduce((acc, kind) => {
      acc[kind] = neighbors.filter((item) => item.kind === kind).length;
      return acc;
    }, {});
    const kindIndexes = { parent: 0, child: 0, related: 0 };
    const nodes = [{ problem: current, kind: "current", position: { x: 50, y: 49 } }];
    neighbors.forEach((item) => {
      item.position = positionFor(item.kind, kindIndexes[item.kind]++, kindTotals[item.kind]);
      nodes.push(item);
    });

    $("#graph-nodes").innerHTML = nodes.map(({ problem, kind, position }) => `
      <button class="graph-node graph-node--${kind}" type="button" data-go="${problem.id}" data-kind="${kind}"
        style="left:${position.x}%;top:${position.y}%;--node-accent:${rootAccent(problem)}"
        aria-label="${kind === "current" ? "Current problem" : kind}: ${escapeHtml(problem.title)}">
        <span>${kind === "current" ? "You are here" : kind}</span>
        <strong>${escapeHtml(problem.title)}</strong>
      </button>`).join("");
    requestAnimationFrame(drawGraphLines);
  }

  function drawGraphLines() {
    const canvas = $("#graph-canvas");
    const svg = $("#graph-lines");
    const current = $(".graph-node--current");
    if (!canvas || !svg || !current) return;
    const canvasRect = canvas.getBoundingClientRect();
    const point = (element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.left - canvasRect.left + rect.width / 2, y: rect.top - canvasRect.top + rect.height / 2 };
    };
    const center = point(current);
    svg.setAttribute("viewBox", `0 0 ${canvasRect.width} ${canvasRect.height}`);
    svg.innerHTML = $$(".graph-node:not(.graph-node--current)", canvas).map((node) => {
      const target = point(node);
      return `<line class="${node.dataset.kind === "related" ? "related" : ""}" x1="${center.x}" y1="${center.y}" x2="${target.x}" y2="${target.y}" />`;
    }).join("");
  }

  function renderReader() {
    const problem = byId.get(currentId);
    const level = data.levels[problem.level - 1];
    $("#reader-domain").textContent = problem.domain;
    $("#reader-domain").style.color = rootAccent(problem);
    $("#reader-level").textContent = `${level} ${String(problem.level).padStart(2, "0")}/04`;
    $("#reader-kind").textContent = parents.get(problem.id).length ? "Subproblem" : "Root problem";
    $("#reader-title").textContent = problem.title;
    $("#reader-summary").textContent = problem.summary;
    $("#reader-model").textContent = problem.model;
    $("#reader-uncertainty").textContent = problem.uncertainty;
    $("#reader-updated").textContent = `Observed ${problem.updated}`;
    $("#concept-row").innerHTML = problem.concepts.map((concept) => `<span>${escapeHtml(concept)}</span>`).join("");
    const children = problem.children.map((id) => byId.get(id)).filter(Boolean);
    $("#children-section").hidden = children.length === 0;
    $("#reader-children").innerHTML = children.map((child, index) => `
      <button class="child-link" type="button" data-go="${child.id}">
        <span>${String(index + 1).padStart(2, "0")}</span>${escapeHtml(child.title)}
      </button>`).join("");
    $("#capture-problem").textContent = problem.title;
  }

  function collectRelated(problem) {
    const candidates = new Map();
    const add = (id, reason, strength) => {
      if (id === problem.id || !byId.has(id)) return;
      const existing = candidates.get(id);
      if (!existing || existing.strength < strength) candidates.set(id, { id, reason, strength });
    };
    problem.related.forEach((relation) => add(relation.id, relation.reason, 10));
    problems.forEach((candidate) => {
      candidate.related.forEach((relation) => {
        if (relation.id === problem.id) add(candidate.id, relation.reason, 9);
      });
    });
    problems.forEach((candidate) => {
      const shared = candidate.concepts.filter((concept) => problem.concepts.includes(concept));
      if (shared.length) add(candidate.id, `Shared lens: ${shared.join(", ")}.`, shared.length);
    });
    return [...candidates.values()].sort((a, b) => b.strength - a.strength).slice(0, 3);
  }

  function renderRelated() {
    const current = byId.get(currentId);
    const related = collectRelated(current);
    $("#related-list").innerHTML = related.map(({ id, reason }) => {
      const problem = byId.get(id);
      return `<button class="related-card" type="button" data-go="${id}" style="--related-accent:${rootAccent(problem)}">
        <span>${escapeHtml(problem.domain)} ↗</span>
        <strong>${escapeHtml(problem.title)}</strong>
        <small>${escapeHtml(reason)}</small>
      </button>`;
    }).join("");
  }

  function renderTrail() {
    $("#trail").innerHTML = trail.map((id, index) => {
      const problem = byId.get(id);
      return `<button type="button" data-go="${id}" title="${escapeHtml(problem.title)}">${String(index + 1).padStart(2, "0")} · ${escapeHtml(problem.title)}</button>`;
    }).join("");
    $("#trail").scrollLeft = $("#trail").scrollWidth;
  }

  function render() {
    if (!problems.length) {
      $("#breadcrumbs").innerHTML = "<span>root / waiting for a problem</span>";
      $("#graph-lines").innerHTML = "";
      $("#graph-nodes").innerHTML = '<div class="graph-empty"><span>∅</span><strong>The map is empty on purpose.</strong><p>Capture a loose thought now. Promote it only when it becomes a problem worth keeping.</p></div>';
      $("#reader-domain").textContent = "Unassigned";
      $("#reader-domain").style.color = "var(--acid)";
      $("#reader-level").textContent = "No claim";
      $("#reader-kind").textContent = "Before the first node";
      $("#reader-title").textContent = "Your thinking has not been pre-filled.";
      $("#reader-summary").textContent = "Demonstration problems were removed. Canonical knowledge begins only when one of your questions earns a place in the repository.";
      $("#reader-model").textContent = "A problem can become a root, contain unlimited recursive subproblems, and connect sideways across any domain.";
      $("#reader-uncertainty").textContent = "Which problem has changed how you think recently?";
      $("#children-section").hidden = true;
      $("#concept-row").innerHTML = "";
      $("#reader-updated").textContent = "Waiting";
      $(".copy-link").hidden = true;
      $("#capture-problem").textContent = "No canonical problem yet";
      $("#attach-context").checked = false;
      $("#attach-context").disabled = true;
      $("#related-list").innerHTML = '<div class="related-empty">Relations appear after the first real problem exists.</div>';
      trail = [];
      renderRoots();
      renderTrail();
      return;
    }
    renderRoots();
    renderBreadcrumbs();
    renderGraph();
    renderReader();
    renderRelated();
    renderTrail();
  }

  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-go]");
    if (target) navigate(target.dataset.go);
  });
  $(".trail-clear").addEventListener("click", () => { trail = currentId ? [currentId] : []; renderTrail(); });
  $(".copy-link").addEventListener("click", async () => {
    await navigator.clipboard.writeText(location.href);
    showToast("Problem link copied");
  });
  window.addEventListener("popstate", () => {
    const id = getIdFromHash();
    if (id && byId.has(id)) navigate(id, { history: false, remember: false });
  });
  window.addEventListener("resize", () => requestAnimationFrame(drawGraphLines));

  const searchDialog = $(".search-dialog");
  const searchInput = $("#search-input");
  let searchSelection = 0;
  function openSearch() {
    searchDialog.showModal();
    searchInput.value = "";
    searchSelection = 0;
    renderSearch("");
    requestAnimationFrame(() => searchInput.focus());
  }
  function renderSearch(query) {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const results = problems.filter((problem) => {
      const haystack = [problem.title, problem.domain, ...problem.concepts].join(" ").toLowerCase();
      return terms.every((term) => haystack.includes(term));
    }).slice(0, 10);
    searchSelection = Math.min(searchSelection, Math.max(results.length - 1, 0));
    $("#search-results").innerHTML = results.map((problem, index) => `
      <button class="search-result ${index === searchSelection ? "is-active" : ""}" type="button" data-search-go="${problem.id}">
        <span>${escapeHtml(problem.domain)}</span><strong>${escapeHtml(problem.title)}</strong>
      </button>`).join("") || '<div class="inbox-empty"><span>∅</span><p>No problem uses those words yet.</p></div>';
  }
  $(".search-trigger").addEventListener("click", openSearch);
  searchInput.addEventListener("input", () => { searchSelection = 0; renderSearch(searchInput.value); });
  searchInput.addEventListener("keydown", (event) => {
    const results = $$(".search-result");
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!results.length) return;
      searchSelection = (searchSelection + (event.key === "ArrowDown" ? 1 : -1) + results.length) % results.length;
      renderSearch(searchInput.value);
    }
    if (event.key === "Enter" && results[searchSelection]) {
      event.preventDefault();
      const id = results[searchSelection].dataset.searchGo;
      searchDialog.close();
      navigate(id, { focusAtlas: true });
    }
  });
  $("#search-results").addEventListener("click", (event) => {
    const target = event.target.closest("[data-search-go]");
    if (!target) return;
    searchDialog.close();
    navigate(target.dataset.searchGo, { focusAtlas: true });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) {
      event.preventDefault();
      openSearch();
    }
  });

  function showToast(message) {
    const toast = $(".toast");
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2200);
  }

  const DB_NAME = "problem-space-local";
  const STORE_NAME = "thoughts";
  let dbPromise;
  function openDatabase() {
    if (!("indexedDB" in window)) return Promise.reject(new Error("IndexedDB is unavailable"));
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return dbPromise;
  }
  async function runStore(mode, action) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      const request = action(store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  const getThoughts = async () => (await runStore("readonly", (store) => store.getAll())).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const addThought = (thought) => runStore("readwrite", (store) => store.add(thought));
  const deleteThought = (id) => runStore("readwrite", (store) => store.delete(id));

  const inboxDialog = $(".inbox-dialog");
  async function openInbox() {
    inboxDialog.showModal();
    await renderThoughts();
    requestAnimationFrame(() => $("#thought-input").focus());
  }
  $$(".inbox-trigger, .mobile-capture").forEach((button) => button.addEventListener("click", openInbox));
  $(".inbox-close").addEventListener("click", () => inboxDialog.close());

  function thoughtMarkdown(thought) {
    const date = new Date(thought.createdAt).toISOString().slice(0, 10);
    const context = thought.problemId
      ? `\n\nRelated problem: ${thought.problemTitle}\nProblem ID: ${thought.problemId}`
      : "";
    return `## Loose thought — ${date}\n\n${thought.text}${context}\n`;
  }

  async function renderThoughts() {
    try {
      const thoughts = await getThoughts();
      $$(".inbox-count").forEach((counter) => {
        counter.textContent = thoughts.length;
        counter.setAttribute("aria-label", `${thoughts.length} saved thoughts`);
      });
      $("#inbox-status").textContent = `${thoughts.length} thought${thoughts.length === 1 ? "" : "s"}`;
      $("#inbox-empty").hidden = thoughts.length > 0;
      $(".export-thoughts").disabled = thoughts.length === 0;
      $("#thought-list").innerHTML = thoughts.map((thought) => `
        <article class="thought-card" data-thought-id="${thought.id}">
          <time datetime="${thought.createdAt}">${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(thought.createdAt))}</time>
          <p>${escapeHtml(thought.text)}</p>
          ${thought.problemId ? `<div class="thought-context"><span>Attached to</span><span>→</span> ${escapeHtml(thought.problemTitle)}</div>` : ""}
          <div class="thought-actions">
            <button type="button" data-thought-action="copy">Copy as note</button>
            <button type="button" data-thought-action="share">Share</button>
            <button class="delete-thought" type="button" data-thought-action="delete">Delete</button>
          </div>
        </article>`).join("");
      return thoughts;
    } catch (error) {
      showToast("Local storage is unavailable");
      return [];
    }
  }

  $(".capture-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = $("#thought-input").value.trim();
    if (!text) return;
    const problem = byId.get(currentId);
    const attach = $("#attach-context").checked && Boolean(problem);
    const thought = {
      id: crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      text,
      createdAt: new Date().toISOString(),
      problemId: attach ? problem.id : null,
      problemTitle: attach ? problem.title : null
    };
    try {
      await addThought(thought);
      $("#thought-input").value = "";
      await renderThoughts();
      showToast("Thought kept on this device");
    } catch (error) {
      showToast("Could not save locally");
    }
  });

  $("#thought-list").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-thought-action]");
    if (!button) return;
    const id = button.closest("[data-thought-id]").dataset.thoughtId;
    const thoughts = await getThoughts();
    const thought = thoughts.find((item) => item.id === id);
    if (!thought) return;
    const markdown = thoughtMarkdown(thought);
    if (button.dataset.thoughtAction === "copy") {
      await navigator.clipboard.writeText(markdown);
      showToast("Ready to paste into the repo");
    }
    if (button.dataset.thoughtAction === "share") {
      if (navigator.share) await navigator.share({ title: "Problem Space thought", text: markdown });
      else {
        await navigator.clipboard.writeText(markdown);
        showToast("Sharing unavailable — copied instead");
      }
    }
    if (button.dataset.thoughtAction === "delete") {
      await deleteThought(id);
      await renderThoughts();
      showToast("Local thought deleted");
    }
  });

  $(".export-thoughts").addEventListener("click", async () => {
    const thoughts = await getThoughts();
    if (!thoughts.length) return;
    const content = `# Problem Space — loose thoughts\n\nExported ${new Date().toISOString()}\n\n---\n\n${thoughts.map(thoughtMarkdown).join("\n---\n\n")}`;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([content], { type: "text/markdown" }));
    link.download = `problem-space-thoughts-${new Date().toISOString().slice(0, 10)}.md`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  $$(".reveal").forEach((element, index) => {
    element.style.transitionDelay = `${Math.min(index % 3, 2) * 65}ms`;
    observer.observe(element);
  });

  trail = currentId ? [currentId] : [];
  render();
  renderThoughts();

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
  }
})();
