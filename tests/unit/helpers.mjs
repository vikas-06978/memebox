// Loads a classic extension script (e.g. defaults.js) into a sandbox and returns its globals.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

export const ROOT = path.resolve(import.meta.dirname, '..', '..');
export const EXT = path.join(ROOT, 'extension');

// rel: one path or a list, loaded in order into the same sandbox.
export function loadScript(rel, extraGlobals = {}) {
  const sandbox = { console, URL, atob, btoa, ...extraGlobals };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const f of [].concat(rel)) vm.runInContext(fs.readFileSync(path.join(EXT, f), 'utf8'), sandbox, { filename: f });
  return sandbox;
}

export const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(EXT, rel), 'utf8'));
