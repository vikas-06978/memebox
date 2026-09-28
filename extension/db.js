// MemeBox: tiny IndexedDB store for uploaded clips and meme pictures (extension origin only).
// Used by the service worker (importScripts) and the options page.
(() => {
  'use strict';
  const DB_NAME = 'memebox';
  const CLIPS = 'clips';
  const PICTURES = 'pictures';
  let dbPromise = null;

  function open() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        // Version 2 added the pictures store. Existing clips are kept.
        const req = indexedDB.open(DB_NAME, 2);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(CLIPS)) db.createObjectStore(CLIPS, { keyPath: 'id' });
          if (!db.objectStoreNames.contains(PICTURES)) db.createObjectStore(PICTURES, { keyPath: 'id' });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      dbPromise.catch(() => { dbPromise = null; });
    }
    return dbPromise;
  }

  async function run(store, mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const req = fn(tx.objectStore(store));
      tx.oncomplete = () => resolve(req && req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('IndexedDB aborted'));
    });
  }

  // clip: { id, name, type, bytes: ArrayBuffer }
  // picture: { id, name, type: 'image/webp' | 'image/jpeg' | 'image/png', bytes: ArrayBuffer, width, height }
  globalThis.MemeDB = Object.freeze({
    putClip: (clip) => run(CLIPS, 'readwrite', (s) => s.put(clip)),
    getClip: (id) => run(CLIPS, 'readonly', (s) => s.get(id)),
    deleteClip: (id) => run(CLIPS, 'readwrite', (s) => s.delete(id)),
    listClips: () => run(CLIPS, 'readonly', (s) => s.getAll()),
    clear: () => run(CLIPS, 'readwrite', (s) => s.clear()),
    putPicture: (p) => run(PICTURES, 'readwrite', (s) => s.put(p)),
    getPicture: (id) => run(PICTURES, 'readonly', (s) => s.get(id)),
    deletePicture: (id) => run(PICTURES, 'readwrite', (s) => s.delete(id)),
  });
})();
