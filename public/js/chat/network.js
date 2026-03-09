// public/js/chat/network.js

export async function postJSON(url, body, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.message || data?.error || `HTTP ${res.status}`;
        throw new Error(msg);
      }
      return data;
    } catch (err) {
      if (i === tries - 1) throw err;
      await new Promise(r => setTimeout(r, 400 * Math.pow(2, i)));
    }
  }
}
