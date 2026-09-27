// Loads a classic extension script (e.g. defaults.js) into a sandbox and returns its globals.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

export const ROOT = path.resolve(import.meta.dirname, '..', '..');
export const EXT = path.join(ROOT, 'extension');

export function loadScript(rel, extraGlobals = {}) {
  const sandbox = { console, URL, ...extraGlobals };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(EXT, rel), 'utf8'), sandbox, { filename: rel });
  return sandbox;
}

export const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(EXT, rel), 'utf8'));
