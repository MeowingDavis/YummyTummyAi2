// public/js/features/chat/markdown.js

export function renderMarkdown(md) {
  const html = marked.parse(md || "");
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}

export function enhanceCodeBlocks(scope = document) {
  scope.querySelectorAll('pre > code').forEach(code => {
    try { hljs.highlightElement(code); } catch {}
    const pre = code.parentElement;
    if (pre.dataset.enhanced) return;
    pre.dataset.enhanced = "1";
    const btn = document.createElement('button');
    btn.className = "absolute top-2 right-2 skeuo-btn skeuo-btn-secondary skeuo-interactive text-xs px-2 py-1";
    btn.textContent = "Copy";
    btn.onclick = async () => {
      await navigator.clipboard.writeText(code.innerText);
      btn.textContent = "Copied!";
      setTimeout(() => btn.textContent = "Copy", 1200);
    };
    const wrapper = document.createElement('div');
    wrapper.className = "relative";
    pre.replaceWith(wrapper);
    wrapper.appendChild(pre);
    wrapper.appendChild(btn);
  });
}
