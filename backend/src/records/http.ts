import fs from 'node:fs';
import path from 'node:path';
import { createServer, type IncomingMessage } from 'node:http';
import { fileURLToPath } from 'node:url';
import { readJsonBody, readRawBody } from '../http-utils.js';
import { readMultipartFiles } from '../multipart-upload.js';
import { RecordStore, fail, string } from './store.js';
import { chunkPages, mimeFor, startExtractionWorker } from './extraction.js';

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const recordsRoot = () => path.resolve(projectRoot, process.env.OPENWRITE_RECORDS_PATH || 'data/records');
const localHost = (host: string) => ['localhost', '127.0.0.1', '[::1]', '::1'].includes(host);
function requireLocalRequest(req: IncomingMessage) {
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '')) fail('Local access only', 403);
  if (req.headers['x-forwarded-for'] && String(req.headers['x-forwarded-for']).split(',').some(ip => !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip.trim()))) fail('Remote forwarding is not allowed', 403);
  if (req.headers['x-forwarded-host'] && !localHost(new URL(`http://${req.headers['x-forwarded-host']}`).hostname)) fail('Remote forwarding is not allowed', 403);
  if (!localHost(new URL(`http://${req.headers.host}`).hostname)) fail('Local host required', 403);
  if (req.headers.origin && !localHost(new URL(req.headers.origin).hostname)) fail('Origin is not allowed', 403);
  if (req.headers['sec-fetch-site'] === 'cross-site') fail('Cross-site requests are not allowed', 403);
}
const integer = (v: string | null, fallback: number, max: number) => Math.min(max, Math.max(0, Math.floor(Number(v ?? fallback) || 0)));

export function createRecordsServer(store: RecordStore, options: { worker?: boolean; frontendPath?: string } = {}) {
  const worker = options.worker === false ? null : startExtractionWorker(store);
  const frontend = options.frontendPath ?? path.join(projectRoot, 'frontend/dist');
  const server = createServer(async (req, res) => {
    const json = (status: number, value: unknown) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value)); };
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    try {
      requireLocalRequest(req);
      const url = new URL(req.url ?? '/', 'http://localhost');
      const p = url.pathname, method = req.method;
      if (!p.startsWith('/api/')) {
        if (method !== 'GET' && method !== 'HEAD') fail('Not found', 404);
        let file = path.resolve(frontend, '.' + decodeURIComponent(p));
        if (file !== frontend && !file.startsWith(frontend + path.sep)) fail('Not found', 404);
        if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(frontend, 'index.html');
        if (!fs.existsSync(file)) fail('Build the frontend first', 503);
        const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png' };
        res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
        res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; frame-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
        return res.end(method === 'HEAD' ? undefined : fs.readFileSync(file));
      }
      // Keep the discovery identifier understood by existing installed desktop shells.
      if (method === 'GET' && p === '/api/health') return json(200, { ok: true, service: 'openwrite-sync', product: 'OpenWrite Records', version: 1 });
      const actor = req.headers['x-openwrite-actor'] ? string(req.headers['x-openwrite-actor'], 'actor', 200) : 'household';
      if (method === 'GET' && p === '/api/records/stats') return json(200, store.stats());
      if (method === 'GET' && p === '/api/records') return json(200, store.search(Object.fromEntries(url.searchParams) as any));
      if (method === 'POST' && p === '/api/records') {
        const files = await readMultipartFiles(req);
        if (!files.length) fail('Choose at least one file');
        const results = files.map(file => store.ingest(file.data, file.name, mimeFor(file.name), actor));
        worker?.kick(); return json(201, { results });
      }
      if (method === 'POST' && p === '/api/records/upload') {
        const filename = string(url.searchParams.get('filename'), 'filename', 1000);
        const result = store.ingest(await readRawBody(req), filename, mimeFor(filename), actor);
        worker?.kick(); return json(201, result);
      }
      if (method === 'POST' && p === '/api/links') {
        const body = await readJsonBody(req);
        return json(201, store.link(string(body.sourceId, 'sourceId'), string(body.targetId, 'targetId'), string(body.type, 'type'), body.note ?? '', actor));
      }
      const link = /^\/api\/links\/([^/]+)$/.exec(p);
      if (link && method === 'DELETE') return json(200, store.unlink(link[1], actor));
      const record = /^\/api\/records\/([^/]+)(?:\/(original|content|artifacts|retry))?(?:\/([^/]+))?$/.exec(p);
      if (record) {
        const [, id, action, artifactId] = record;
        if (!action && method === 'GET') return json(200, store.detail(id));
        if (!action && method === 'PATCH') return json(200, store.update(id, await readJsonBody(req), actor));
        if (action === 'original' && method === 'GET') {
          const { record: r, data } = store.original(id);
          const preview = url.searchParams.get('preview') === '1' && ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'text/plain', 'audio/mpeg', 'video/mp4'].includes(r.mime);
          res.setHeader('Content-Type', r.mime);
          res.setHeader('Content-Length', data.length);
          res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");
          res.setHeader('Content-Disposition', `${preview ? 'inline' : 'attachment'}; filename="original${path.extname(r.filename).replace(/[^.a-zA-Z0-9]/g, '')}"; filename*=UTF-8''${encodeURIComponent(r.filename).replace(/'/g, '%27')}`);
          res.setHeader('X-Content-SHA256', r.sha256);
          return res.end(data);
        }
        if (action === 'content' && method === 'GET') return json(200, store.content(id, integer(url.searchParams.get('offset'), 0, 1000000), integer(url.searchParams.get('limit'), 100, 100) || 100));
        if (action === 'content' && method === 'POST') {
          const body = await readJsonBody(req);
          const kind = body.kind ?? 'note';
          if (!['note', 'extraction'].includes(kind)) fail('Use note or extraction content');
          const text = string(body.text, 'text', 20_000_000);
          return json(201, store.addArtifact(id, text, kind, actor, kind === 'extraction' ? chunkPages([text]) : []));
        }
        if (action === 'artifacts' && artifactId && method === 'GET') {
          store.get(id);
          const artifact = store.db.prepare('SELECT * FROM artifacts WHERE id=? AND recordId=?').get(artifactId, id);
          if (!artifact) fail('Content version not found', 404);
          return json(200, artifact);
        }
        if (action === 'retry' && method === 'POST') { const r = store.retry(id); worker?.kick(); return json(200, r); }
      }
      fail('Not found', 404);
    } catch (error: any) {
      if (!res.headersSent) json(error.statusCode ?? (error instanceof SyntaxError ? 400 : 500), { error: error.statusCode || error instanceof SyntaxError ? error.message : 'Unable to complete this operation. Check the local server log.' });
      else res.end();
      if (!error.statusCode && !(error instanceof SyntaxError)) console.error(error);
    }
  });
  return { server, async close() { await worker?.stop(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); } };
}
