window.addEventListener('DOMContentLoaded', () => {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  const input = document.getElementById('recipeSearchInput');
  const btn = document.getElementById('recipeSearchBtn');
  const resultsEl = document.getElementById('recipeResults');
  const statusEl = document.getElementById('searchStatus');
  const categoryButtons = Array.from(document.querySelectorAll('.recipe-category'));

  let activeCategory = '';
  let pendingTimer = null;
  let reqId = 0;

  function escapeHtml(str) {
    return String(str ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  function renderRecipes(recipes) {
    if (!resultsEl) return;
    if (!recipes.length) {
      resultsEl.innerHTML = `
        <article class="glass skeuo-surface skeuo-card-pad-lg">
          <h3 class="text-lg font-semibold">No recipes found</h3>
          <p class="mt-2 text-slate-200">Try another keyword or category.</p>
        </article>
      `;
      return;
    }

    resultsEl.innerHTML = recipes.map((recipe) => {
      const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
      const ingredientList = ingredients.slice(0, 10).map((item) => `<li>${escapeHtml(item)}</li>`).join('');
      const instructions = escapeHtml(String(recipe.instructions ?? '')).replaceAll('|', '<br/>');
      return `
        <article class="glass skeuo-surface skeuo-card-pad-lg">
          <h3 class="text-xl font-semibold">${escapeHtml(recipe.title)}</h3>
          ${recipe.servings ? `<p class="mt-1 text-sm text-slate-300">Servings: ${escapeHtml(recipe.servings)}</p>` : ''}
          ${ingredientList ? `<h4 class="mt-3 font-semibold text-emerald-300">Ingredients</h4><ul class="mt-2 list-inside list-disc space-y-1 text-slate-200">${ingredientList}</ul>` : ''}
          ${instructions ? `<h4 class="mt-3 font-semibold text-emerald-300">Instructions</h4><p class="mt-2 whitespace-pre-wrap text-slate-200 leading-relaxed">${instructions}</p>` : ''}
        </article>
      `;
    }).join('');
  }

  async function searchRecipes() {
    const query = (input?.value ?? '').trim();
    const currentReqId = ++reqId;

    if (!query && !activeCategory) {
      renderRecipes([]);
      setStatus('Type a query to start browsing recipes.');
      return;
    }

    setStatus('Searching recipes...');
    if (resultsEl) {
      resultsEl.innerHTML = `
        <article class="glass skeuo-surface skeuo-card-pad-lg">
          <p class="text-slate-200">Loading...</p>
        </article>
      `;
    }

    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (activeCategory) params.set('category', activeCategory);
    params.set('limit', '18');

    try {
      const res = await fetch(`/recipes/search?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (currentReqId !== reqId) return;

      if (!res.ok || !data?.ok) {
        const msg = data?.message || 'Unable to search recipes right now.';
        setStatus(msg.includes('configured') ? 'Recipe provider is not configured on the server.' : msg);
        renderRecipes([]);
        return;
      }

      const recipes = Array.isArray(data?.recipes) ? data.recipes : [];
      setStatus(recipes.length ? `Found ${recipes.length} recipes.` : 'No recipes found for this search.');
      renderRecipes(recipes);
    } catch {
      if (currentReqId !== reqId) return;
      setStatus('Network error. Please try again.');
      renderRecipes([]);
    }
  }

  function queueSearch() {
    if (pendingTimer) window.clearTimeout(pendingTimer);
    pendingTimer = window.setTimeout(searchRecipes, 260);
  }

  input?.addEventListener('input', queueSearch);
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      searchRecipes();
    }
  });
  btn?.addEventListener('click', () => searchRecipes());

  for (const node of categoryButtons) {
    node.addEventListener('click', () => {
      activeCategory = node.dataset.category || '';
      for (const btnEl of categoryButtons) {
        const isActive = btnEl === node;
        btnEl.classList.toggle('skeuo-btn-primary', isActive);
        btnEl.classList.toggle('skeuo-btn-secondary', !isActive);
      }
      searchRecipes();
    });
  }
});
