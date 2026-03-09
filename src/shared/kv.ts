type KvListEntry<T> = { key: Deno.KvKey; value: T; versionstamp: string };
type KvGetEntry<T> = { key: Deno.KvKey; value: T | null; versionstamp: string | null };

export type AppKv = {
  get<T>(key: Deno.KvKey): Promise<KvGetEntry<T>>;
  set<T>(key: Deno.KvKey, value: T): Promise<unknown>;
  delete(key: Deno.KvKey): Promise<unknown>;
  list<T>(selector: { prefix: Deno.KvKey }): AsyncIterable<KvListEntry<T>>;
};

function keyToString(key: Deno.KvKey): string {
  return JSON.stringify([...key]);
}

function hasPrefix(key: Deno.KvKey, prefix: Deno.KvKey): boolean {
  if (prefix.length > key.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (key[i] !== prefix[i]) return false;
  }
  return true;
}

class MemoryKv implements AppKv {
  #store = new Map<string, { key: Deno.KvKey; value: unknown; versionstamp: string }>();
  #v = 0;

  async get<T>(key: Deno.KvKey): Promise<KvGetEntry<T>> {
    const row = this.#store.get(keyToString(key));
    return {
      key,
      value: (row?.value as T | undefined) ?? null,
      versionstamp: row?.versionstamp ?? null,
    };
  }

  async set<T>(key: Deno.KvKey, value: T) {
    this.#v += 1;
    this.#store.set(keyToString(key), { key, value, versionstamp: String(this.#v) });
    return { ok: true, versionstamp: String(this.#v) };
  }

  async delete(key: Deno.KvKey) {
    this.#store.delete(keyToString(key));
    return { ok: true };
  }

  async *list<T>({ prefix }: { prefix: Deno.KvKey }): AsyncIterable<KvListEntry<T>> {
    for (const row of this.#store.values()) {
      if (!hasPrefix(row.key, prefix)) continue;
      yield {
        key: row.key,
        value: row.value as T,
        versionstamp: row.versionstamp,
      };
    }
  }
}

let kvPromise: Promise<AppKv> | null = null;
let warned = false;
const memoryKv = new MemoryKv();

function warnFallback(err: unknown) {
  if (warned) return;
  warned = true;
  console.warn("[kv] Falling back to in-memory KV:", String((err as Error)?.message ?? err));
}

export async function getAppKv(): Promise<AppKv> {
  if (kvPromise) return await kvPromise;

  kvPromise = (async () => {
    try {
      if (typeof Deno.openKv === "function") {
        return await Deno.openKv();
      }
      warnFallback("Deno.openKv is unavailable");
      return memoryKv;
    } catch (err) {
      warnFallback(err);
      return memoryKv;
    }
  })();

  return await kvPromise;
}
