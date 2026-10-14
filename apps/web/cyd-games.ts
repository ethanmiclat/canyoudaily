// Vite plugin for imported games (see scripts/games.mjs).
// Dev: serves each game's built client at /<id>/ and runs the generated api/ entrypoints in-process.
// Build: copies each game's client into dist/<id>/. In production Vercel serves both.
import fs from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function gameIds(hubRoot: string): string[] {
  const dir = path.join(hubRoot, 'imported');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((d) => !d.startsWith('.') && fs.existsSync(path.join(dir, d, 'game.json')));
}

function sendFile(res: ServerResponse, file: string) {
  res.setHeader('Content-Type', MIME[path.extname(file)] ?? 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
}

/** Serve /<id>/... from imported/<id>/web, falling back to its index.html for client routes. */
function serveGame(hubRoot: string, req: IncomingMessage, res: ServerResponse): boolean {
  const url = new URL(req.url ?? '/', 'http://hub');
  const [, id, ...rest] = url.pathname.split('/');
  if (!id || !gameIds(hubRoot).includes(id)) return false;
  const webDir = path.join(hubRoot, 'imported', id, 'web');
  const file = path.normalize(path.join(webDir, decodeURIComponent(rest.join('/'))));
  if (!file.startsWith(webDir)) return false;
  sendFile(res, fs.existsSync(file) && fs.statSync(file).isFile() ? file : path.join(webDir, 'index.html'));
  return true;
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/** Run a generated api/<...>.ts entrypoint like a Vercel Node function. */
async function serveApi(server: ViteDevServer, hubRoot: string, req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = new URL(req.url ?? '/', 'http://hub');
  if (!url.pathname.startsWith('/api/')) return false;
  // Like Vercel's rewrites: /api/<id>/<route> falls back to the nearest api/<...>.ts above it (a game's router).
  const segments = url.pathname.split('/').filter(Boolean);
  let entry: string | undefined;
  for (let n = segments.length; n >= 2 && !entry; n--) {
    const base = path.normalize(path.join(hubRoot, ...segments.slice(0, n)));
    entry = [`${base}.ts`, path.join(base, 'index.ts')].find((f) => f.startsWith(path.join(hubRoot, 'api')) && fs.existsSync(f));
  }
  if (!entry || path.basename(path.dirname(entry)) === '_cyd') {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'Not found' }));
    return true;
  }
  const handler = (await server.ssrLoadModule(entry)).default as (req: IncomingMessage, res: ServerResponse) => Promise<void>;
  Object.assign(req, { body: await readBody(req), query: Object.fromEntries(url.searchParams) });
  await handler(req, res);
  return true;
}

export function cydGames(hubRoot: string): Plugin {
  let outDir = '';
  return {
    name: 'cyd-games',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    configureServer(server) {
      // Generated api/_cyd setup files resolve game content and data from here (Vercel uses its cwd).
      process.env.CYD_ROOT = hubRoot;
      server.middlewares.use((req, res, next) => {
        serveApi(server, hubRoot, req, res)
          .then((handled) => handled || serveGame(hubRoot, req, res) || next())
          .catch((err) => {
            server.config.logger.error(String(err?.stack ?? err));
            if (!res.headersSent) res.statusCode = 500;
            res.end('Internal error');
          });
      });
    },
    closeBundle() {
      for (const id of gameIds(hubRoot)) {
        fs.cpSync(path.join(hubRoot, 'imported', id, 'web'), path.join(outDir, id), { recursive: true });
      }
    },
  };
}
