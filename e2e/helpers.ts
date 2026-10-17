import type { Page } from "@playwright/test";

/** Escreve diretamente no IndexedDB do app (mesmo formato do store) para preparar cenários. */
export async function seedKv(page: Page, key: string, value: unknown) {
  await page.evaluate(async ({ key, value }) => {
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open("shadow-realm", 1);
      open.onupgradeneeded = () => open.result.createObjectStore("kv");
      open.onsuccess = () => {
        const tx = open.result.transaction("kv", "readwrite");
        tx.objectStore("kv").put(value, key);
        tx.oncomplete = () => { open.result.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
      open.onerror = () => reject(open.error);
    });
  }, { key, value });
}

export async function readKv<T>(page: Page, key: string): Promise<T | undefined> {
  return page.evaluate(async (key) => {
    return await new Promise<unknown>((resolve, reject) => {
      const open = indexedDB.open("shadow-realm", 1);
      open.onsuccess = () => {
        const req = open.result.transaction("kv", "readonly").objectStore("kv").get(key);
        req.onsuccess = () => { open.result.close(); resolve(req.result); };
        req.onerror = () => reject(req.error);
      };
      open.onerror = () => reject(open.error);
    });
  }, key) as Promise<T | undefined>;
}
