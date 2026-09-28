// MemeBox: tiny IndexedDB store for uploaded clips (extension origin only).
// Used by the service worker (importScripts) and the options page.
(() => {
  'use strict';
  const DB_NAME = 'memebox';
  const STORE = 'clips';
  let dbPromise = null;

  function open() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      dbPromise.catch(() => { dbPromise = null; });
    }
    return dbPromise;
  }

  async function run(mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req && req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('IndexedDB aborted'));
    });
  }

  // clip: { id, name, type, bytes: ArrayBuffer }
  globalThis.MemeDB = Object.freeze({
    putClip: (clip) => run('readwrite', (s) => s.put(clip)),
    getClip: (id) => run('readonly', (s) => s.get(id)),
    deleteClip: (id) => run('readwrite', (s) => s.delete(id)),
    listClips: () => run('readonly', (s) => s.getAll()),
    clear: () => run('readwrite', (s) => s.clear()),
  });
})();
