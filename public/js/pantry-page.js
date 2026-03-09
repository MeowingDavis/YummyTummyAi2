window.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("pantrySearchForm");
  const queryInput = document.getElementById("pantryQuery");
  const statusEl = document.getElementById("pantryStatus");
  const resultsEl = document.getElementById("pantryResults");
  const recipeSection = document.getElementById("pantryRecipeSection");
  const recipeTitle = document.getElementById("pantry-recipe-title");
  const recipeMeta = document.getElementById("pantryRecipeMeta");
  const recipeSummary = document.getElementById("pantryRecipeSummary");
  const recipeIngredients = document.getElementById("pantryRecipeIngredients");
  const recipeInstructions = document.getElementById("pantryRecipeInstructions");
  const recipeSource = document.getElementById("pantryRecipeSource");
  const recipeClose = document.getElementById("pantryRecipeClose");
  const prevPageBtn = document.getElementById("pantryPrevPage");
  const nextPageBtn = document.getElementById("pantryNextPage");
  const pageInfo = document.getElementById("pantryPageInfo");
  const dietSelect = document.getElementById("pantryDiet");
  const cuisineSelect = document.getElementById("pantryCuisine");
  const maxReadyTimeSelect = document.getElementById("pantryMaxReadyTime");
  const quickFilters = document.getElementById("pantryQuickFilters");
  const lockedNotice = document.getElementById("pantryLockedNotice");
  const searchOverlay = document.getElementById("pantrySearchOverlay");
  const resultsOverlay = document.getElementById("pantryResultsOverlay");

  if (
    !form || !queryInput || !statusEl || !resultsEl || !recipeSection ||
    !recipeTitle || !recipeMeta || !recipeSummary || !recipeIngredients ||
    !recipeInstructions || !recipeSource || !recipeClose || !prevPageBtn ||
    !nextPageBtn || !pageInfo || !dietSelect || !cuisineSelect ||
    !maxReadyTimeSelect || !quickFilters || !lockedNotice || !searchOverlay ||
    !resultsOverlay
  ) return;

  const PAGE_SIZE = 6;
  let currentQuery = "";
  let currentPage = 1;
  let totalResults = 0;
  let lastRenderedIds = [];
  let pantryLocked = false;

  const setStatus = (message, isError = false) => {
    statusEl.textContent = message;
    statusEl.classList.toggle("text-red-200", isError);
    statusEl.classList.toggle("text-slate-200", !isError);
  };

  const getActiveFilters = () => ({
    diet: String(dietSelect.value || "").trim(),
    cuisine: String(cuisineSelect.value || "").trim(),
    maxReadyTime: String(maxReadyTimeSelect.value || "").trim(),
  });

  const clearResults = () => {
    resultsEl.replaceChildren();
  };

  const applyLockedState = (locked) => {
    pantryLocked = locked;
    const controls = [
      queryInput,
      dietSelect,
      cuisineSelect,
      maxReadyTimeSelect,
      prevPageBtn,
      nextPageBtn,
      ...quickFilters.querySelectorAll("button"),
      ...form.querySelectorAll("button"),
    ];
    controls.forEach((el) => {
      if ("disabled" in el) el.disabled = locked;
    });
    lockedNotice.classList.toggle("hidden", !locked);
    searchOverlay.classList.toggle("hidden", !locked);
    resultsOverlay.classList.toggle("hidden", !locked);
    if (locked) {
      setStatus("Sign in to unlock Pantry search and recipe details.", true);
    }
  };

  const updatePaginationUI = () => {
    const totalPages = Math.max(1, Math.ceil(totalResults / PAGE_SIZE));
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    prevPageBtn.disabled = currentPage <= 1;
    nextPageBtn.disabled = currentPage >= totalPages || totalResults === 0;
  };

  const createMeta = (readyInMinutes, servings) => {
    const meta = document.createElement("p");
    meta.className = "mt-3 text-sm text-slate-600";
    const bits = [];
    if (typeof readyInMinutes === "number") bits.push(`${readyInMinutes} min`);
    if (typeof servings === "number") bits.push(`${servings} servings`);
    meta.textContent = bits.length ? bits.join(" • ") : "Timing not provided";
    return meta;
  };

  const createCard = (recipe) => {
    const card = document.createElement("article");
    card.className = "glass skeuo-surface skeuo-card-pad overflow-hidden";

    if (recipe.image) {
      const img = document.createElement("img");
      img.src = recipe.image;
      img.alt = recipe.title || "Recipe image";
      img.loading = "lazy";
      img.decoding = "async";
      img.className = "h-44 w-full rounded-2xl object-cover";
      img.addEventListener("error", () => {
        img.remove();
        const fallback = document.createElement("div");
        fallback.className = "flex h-44 w-full items-center justify-center rounded-2xl bg-slate-100 text-sm font-medium text-slate-500";
        fallback.textContent = "Image unavailable";
        card.prepend(fallback);
      });
      card.appendChild(img);
    } else {
      const fallback = document.createElement("div");
      fallback.className = "flex h-44 w-full items-center justify-center rounded-2xl bg-slate-100 text-sm font-medium text-slate-500";
      fallback.textContent = "No image provided";
      card.appendChild(fallback);
    }

    const title = document.createElement("h3");
    title.className = "mt-4 text-xl text-[#1A3D37]";
    title.textContent = recipe.title || "Untitled recipe";
    card.appendChild(title);

    card.appendChild(createMeta(recipe.readyInMinutes, recipe.servings));

    const buttonRow = document.createElement("div");
    buttonRow.className = "mt-4 flex flex-wrap gap-2";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "inline-flex skeuo-btn skeuo-btn-secondary skeuo-btn-sm";
    button.textContent = "Open in Pantry";
    if (!recipe.id) {
      button.disabled = true;
      button.classList.add("opacity-60", "cursor-not-allowed");
    } else {
      button.addEventListener("click", () => openRecipeDetails(recipe.id));
    }
    buttonRow.appendChild(button);

    const bookmark = document.createElement("button");
    bookmark.type = "button";
    bookmark.disabled = true;
    bookmark.className = "inline-flex skeuo-btn skeuo-btn-secondary skeuo-btn-sm opacity-60 cursor-not-allowed";
    bookmark.textContent = "Bookmark (soon)";
    bookmark.setAttribute("aria-label", "Bookmark feature coming soon");
    buttonRow.appendChild(bookmark);

    card.appendChild(buttonRow);

    return card;
  };

  const renderRecipeDetails = (recipe) => {
    recipeTitle.textContent = recipe.title || "Untitled recipe";
    const bits = [];
    if (typeof recipe.readyInMinutes === "number") {
      bits.push(`${recipe.readyInMinutes} min`);
    }
    if (typeof recipe.servings === "number") bits.push(`${recipe.servings} servings`);
    recipeMeta.textContent = bits.length ? bits.join(" • ") : "Timing not provided";
    recipeSummary.textContent = recipe.summary || "No summary provided.";
    recipeInstructions.textContent = recipe.instructions || "No instructions provided.";

    recipeIngredients.replaceChildren();
    const ingredientList = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
    if (!ingredientList.length) {
      const li = document.createElement("li");
      li.textContent = "No ingredient list provided.";
      recipeIngredients.appendChild(li);
    } else {
      ingredientList.forEach((item) => {
        const li = document.createElement("li");
        li.textContent = String(item);
        recipeIngredients.appendChild(li);
      });
    }

    const sourceHref = recipe.sourceUrl || recipe.spoonacularSourceUrl || "";
    if (sourceHref) {
      recipeSource.href = sourceHref;
      recipeSource.classList.remove("hidden");
    } else {
      recipeSource.href = "#";
      recipeSource.classList.add("hidden");
    }

    recipeSection.classList.remove("hidden");
    recipeSection.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openRecipeDetails = async (recipeId) => {
    if (pantryLocked) {
      setStatus("Sign in to open recipe details in Pantry.", true);
      return;
    }
    setStatus("Loading recipe details…");
    try {
      const response = await fetch(`/api/pantry/recipe/${encodeURIComponent(String(recipeId))}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || `Details failed (${response.status})`);
      }
      renderRecipeDetails(data);
      setStatus(`Loaded "${data?.title || "recipe"}".`);
    } catch (error) {
      const msg = (error && error.message) || "Could not load recipe details.";
      setStatus(msg, true);
    }
  };

  const renderResults = (results) => {
    clearResults();
    const frag = document.createDocumentFragment();
    results.forEach((recipe) => {
      frag.appendChild(createCard(recipe));
    });
    resultsEl.appendChild(frag);
  };

  const fetchPage = async (query, offset, filters) => {
    const params = new URLSearchParams({
      q: query,
      number: String(PAGE_SIZE),
      offset: String(offset),
    });
    if (filters.diet) params.set("diet", filters.diet);
    if (filters.cuisine) params.set("cuisine", filters.cuisine);
    if (filters.maxReadyTime) {
      params.set("maxReadyTime", filters.maxReadyTime);
    }
    const response = await fetch(
      `/api/pantry/search?${params.toString()}`,
      { cache: "no-store" },
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error || `Search failed (${response.status})`);
    }
    return data;
  };

  const searchPantry = async (query, page = 1) => {
    if (pantryLocked) {
      setStatus("Sign in to unlock Pantry search.", true);
      return;
    }
    currentQuery = query;
    currentPage = page;
    const filters = getActiveFilters();
    const offset = (currentPage - 1) * PAGE_SIZE;
    setStatus("Searching recipes…");
    clearResults();
    recipeSection.classList.add("hidden");

    try {
      let data = await fetchPage(query, offset, filters);
      let results = Array.isArray(data?.results) ? data.results : [];
      let ids = results.map((r) => String(r?.id ?? "")).filter(Boolean);
      if (
        currentPage > 1 &&
        ids.length &&
        ids.join(",") === lastRenderedIds.join(",")
      ) {
        const retryOffset = offset + PAGE_SIZE;
        data = await fetchPage(query, retryOffset, filters);
        results = Array.isArray(data?.results) ? data.results : [];
        ids = results.map((r) => String(r?.id ?? "")).filter(Boolean);
      }

      totalResults = Number(data?.totalResults ?? results.length ?? 0);
      updatePaginationUI();
      if (!results.length) {
        setStatus(`No results for "${query}". Try another ingredient or dish.`);
        return;
      }

      const start = offset + 1;
      const end = Math.min(offset + results.length, totalResults || (offset + results.length));
      const filterTags = [
        filters.diet ? `diet: ${filters.diet}` : "",
        filters.cuisine ? `cuisine: ${filters.cuisine}` : "",
        filters.maxReadyTime ? `max: ${filters.maxReadyTime}m` : "",
      ].filter(Boolean);
      const filterSuffix = filterTags.length ? ` (${filterTags.join(", ")})` : "";
      setStatus(`Showing ${start}-${end} of ${totalResults} for "${query}"${filterSuffix}.`);
      renderResults(results);
      lastRenderedIds = ids;
    } catch (error) {
      const msg = (error && error.message) || "Could not load recipes right now.";
      setStatus(msg, true);
      totalResults = 0;
      lastRenderedIds = [];
      updatePaginationUI();
    }
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = String(queryInput.value || "").trim();
    if (!query) {
      setStatus("Enter an ingredient or dish to search.", true);
      return;
    }
    lastRenderedIds = [];
    searchPantry(query, 1);
  });

  recipeClose.addEventListener("click", () => {
    recipeSection.classList.add("hidden");
  });

  prevPageBtn.addEventListener("click", () => {
    if (!currentQuery || currentPage <= 1) return;
    searchPantry(currentQuery, currentPage - 1);
  });

  nextPageBtn.addEventListener("click", () => {
    if (!currentQuery) return;
    const totalPages = Math.max(1, Math.ceil(totalResults / PAGE_SIZE));
    if (currentPage >= totalPages) return;
    searchPantry(currentQuery, currentPage + 1);
  });

  quickFilters.querySelectorAll("button[data-query]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (pantryLocked) {
        setStatus("Sign in to use quick Pantry categories.", true);
        return;
      }
      const suggestedQuery = String(btn.getAttribute("data-query") || "").trim();
      if (!suggestedQuery) return;
      queryInput.value = suggestedQuery;
      lastRenderedIds = [];
      searchPantry(suggestedQuery, 1);
    });
  });

  const initAuthGate = async () => {
    try {
      const res = await fetch("/me", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      applyLockedState(!Boolean(data?.user));
    } catch {
      applyLockedState(true);
    }
  };

  initAuthGate().then(() => {
    const deepLinkRecipeId = new URLSearchParams(window.location.search).get("recipeId");
    if (deepLinkRecipeId && !pantryLocked) {
      openRecipeDetails(deepLinkRecipeId);
    }
  });

  updatePaginationUI();
});
