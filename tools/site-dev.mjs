// npm run site:dev: runs the MemeBox site locally, close to Cloudflare Pages.
// Serves site/public (with _headers and pretty URLs), runs site/functions as routes and
// gives them a D1 stand-in (node:sqlite). Secrets come from site/.dev.vars (git-ignored).
// Also imported by the Playwright tests: startSite({ env }) -> { url, db, close }.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { D1 } from './d1-sqlite.mjs';

const SITE = path.resolve(import.meta.dirname, '..', 'site');
const PUBLIC = path.join(SITE, 'public');
const FUNCTIONS = path.join(SITE, 'functions');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml', '.gif': 'image/gif', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
};

// /api/feedback -> functions/api/feedback.js, /admin -> functions/admin/index.js
async function loadRoutes() {
  const routes = new Map();
  const walk = async (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) await walk(p);
      else if (e.name.endsWith('.js')) {
        let route = '/' + path.relative(FUNCTIONS, p).replace(/\\/g, '/').replace(/\.js$/, '');
        route = route.replace(/\/index$/, '') || '/';
        const mod = await import(pathToFileURL(p).href);
        if (typeof mod.onRequest === 'function') routes.set(route, mod.onRequest);
      }
    }
  };
  await walk(FUNCTIONS);
  return routes;
}

// Minimal _headers support: "/*", "/exact" and "/prefix/*" blocks.
function loadHeaders() {
  const file = path.join(PUBLIC, '_headers');
  if (!fs.existsSync(file)) return [];
  const rules = [];
  let current = null;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) { current = { pattern: line.trim(), headers: [] }; rules.push(current); continue; }
    const i = line.indexOf(':');
    if (current && i > 0) current.headers.push([line.slice(0, i).trim(), line.slice(i + 1).trim()]);
  }
  return rules;
}

const matches = (pattern, p) => (pattern.endsWith('*') ? p.startsWith(pattern.slice(0, -1)) : p === pattern);

function staticFile(urlPath) {
  const clean = path.normalize(decodeURIComponent(urlPath)).replace(/^([/\\])+/, '');
  if (clean.startsWith('..') || path.basename(clean).startsWith('_')) return null;
  const candidates = urlPath.endsWith('/') ? [path.join(clean, 'index.html')] : [clean, clean + '.html', path.join(clean, 'index.html')];
  for (const c of candidates) {
    const full = path.join(PUBLIC, c);
    if (full.startsWith(PUBLIC) && fs.existsSync(full) && fs.statSync(full).isFile()) return full;
  }
  return null;
}

// The [vars] section of site/wrangler.toml (simple KEY = "value" lines), like Cloudflare reads it.
export function readTomlVars(file = path.join(SITE, 'wrangler.toml')) {
  const env = {};
  let inVars = false;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (/^\s*\[/.test(line)) { inVars = /^\s*\[vars\]\s*$/.test(line); continue; }
    const m = inVars && /^\s*([A-Z0-9_]+)\s*=\s*"([^"]*)"\s*$/.exec(line);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

export function readDevVars(file = path.join(SITE, '.dev.vars')) {
  const env = readTomlVars();
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/.exec(line);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

export async function startSite({ port = 0, env = {}, db = new D1() } = {}) {
  const routes = await loadRoutes();
  const headerRules = loadHeaders();

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const handler = routes.get(url.pathname.replace(/\/$/, '') || '/');
      if (handler) {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        const headers = new Headers();
        for (const [k, v] of Object.entries(req.headers)) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
        if (!headers.has('cf-connecting-ip')) headers.set('cf-connecting-ip', req.socket.remoteAddress || '127.0.0.1');
        const request = new Request(url, {
          method: req.method, headers,
          body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks),
        });
        const response = await handler({ request, env: { ...env, DB: db }, params: {}, waitUntil() {}, next: () => new Response('Not found', { status: 404 }) });
        const out = {};
        response.headers.forEach((v, k) => { if (k !== 'set-cookie') out[k] = v; });
        const cookies = response.headers.getSetCookie();
        if (cookies.length) out['set-cookie'] = cookies;
        res.writeHead(response.status, out);
        res.end(Buffer.from(await response.arrayBuffer()));
        return;
      }
      const file = staticFile(url.pathname);
      if (!file) { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('Not found'); return; }
      const headers = { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' };
      for (const rule of headerRules) if (matches(rule.pattern, url.pathname)) for (const [k, v] of rule.headers) headers[k.toLowerCase()] = v;
      res.writeHead(200, headers);
      res.end(fs.readFileSync(file));
    } catch (err) {
      console.error(err);
      res.writeHead(500, { 'content-type': 'text/plain' });
      res.end('Server error');
    }
  });

  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  // close() also ends kept-alive browser connections, or server.close() can wait on them.
  const close = () => new Promise((r) => { server.close(r); server.closeAllConnections(); });
  return { url, db, close };
}

// Run directly: npm run site:dev
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const env = readDevVars();
  const dbFile = path.join(SITE, '.wrangler', 'dev.sqlite');
  fs.mkdirSync(path.dirname(dbFile), { recursive: true });
  const { url } = await startSite({ port: Number(process.env.PORT) || 8788, env, db: new D1(dbFile) });
  console.log(`MemeBox site running at ${url}`);
  for (const k of ['TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET_KEY', 'ADMIN_KEY']) {
    if (!env[k]) console.log(`  (no ${k} in site/.dev.vars: see README "Run the site locally")`);
  }
}
