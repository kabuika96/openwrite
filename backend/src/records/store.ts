import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

export const sha256 = (data: Buffer | string) => createHash('sha256').update(data).digest('hex');
export const fail = (message: string, statusCode = 400): never => { throw Object.assign(new Error(message), { statusCode }); };
export function string(value: unknown, name: string, max = 1000) {
  if (typeof value !== 'string' || value.length > max) fail(`${name} must be text of at most ${max} characters`);
  return value as string;
}
function names(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.length > 100) fail(`${field} must be a list of at most 100 names`);
  return [...new Set((value as unknown[]).map(v => string(v, field, 200).trim()).filter(Boolean))];
}
export type RecordEntry = {
  id: string; sha256: string; filename: string; mime: string; size: number; title: string;
  members: string[]; tags: string[]; category: string; notes: string; status: 'active' | 'archived' | 'invalid';
  statusReason: string; expiresOn: string; revision: number; createdAt: string; updatedAt: string;
  extractionState: string; extractionError: string;
};
export type ChunkInput = { text: string; page?: number; start?: number; end?: number };
export type SearchInput = { q?: string; status?: string; member?: string; tag?: string; category?: string; limit?: number; offset?: number };
const now = () => new Date().toISOString();

export class RecordStore {
  db: DatabaseSync;
  root: string;
  constructor(root: string) {
    this.root = path.resolve(root);
    fs.mkdirSync(path.join(this.root, 'objects'), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path.join(this.root, 'records.sqlite'));
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS records (
        id TEXT PRIMARY KEY, sha256 TEXT UNIQUE NOT NULL, filename TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL,
        title TEXT NOT NULL, members TEXT NOT NULL DEFAULT '[]', tags TEXT NOT NULL DEFAULT '[]', category TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived','invalid')),
        statusReason TEXT NOT NULL DEFAULT '', expiresOn TEXT NOT NULL DEFAULT '', revision INTEGER NOT NULL DEFAULT 1,
        createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, extractionState TEXT NOT NULL DEFAULT 'pending', extractionError TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS sources (source TEXT NOT NULL, sha256 TEXT NOT NULL, recordId TEXT NOT NULL REFERENCES records(id),
        metadata TEXT NOT NULL, PRIMARY KEY(source,sha256));
      CREATE TABLE IF NOT EXISTS artifacts (id TEXT PRIMARY KEY, recordId TEXT NOT NULL REFERENCES records(id), kind TEXT NOT NULL,
        text TEXT NOT NULL, provider TEXT NOT NULL, createdAt TEXT NOT NULL, sourceHash TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS artifacts_record ON artifacts(recordId,createdAt);
      CREATE TABLE IF NOT EXISTS chunks (id TEXT PRIMARY KEY, artifactId TEXT NOT NULL REFERENCES artifacts(id),
        recordId TEXT NOT NULL REFERENCES records(id), ordinal INTEGER NOT NULL, page INTEGER, start INTEGER, end INTEGER, text TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS chunks_record ON chunks(recordId,ordinal);
      CREATE TABLE IF NOT EXISTS links (id TEXT PRIMARY KEY, sourceId TEXT NOT NULL REFERENCES records(id),
        targetId TEXT NOT NULL REFERENCES records(id), type TEXT NOT NULL, note TEXT NOT NULL, createdAt TEXT NOT NULL,
        UNIQUE(sourceId,targetId,type));
      CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY, recordId TEXT NOT NULL REFERENCES records(id), action TEXT NOT NULL,
        actor TEXT NOT NULL, detail TEXT NOT NULL, createdAt TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS runtime_lock (name TEXT PRIMARY KEY, pid INTEGER NOT NULL, token TEXT NOT NULL);
      CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(id UNINDEXED,title,metadata,content,tokenize='unicode61 remove_diacritics 2');
      PRAGMA user_version=1;`);
  }
  close() { this.db.close(); }
  transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  objectPath(hash: string) {
    if (!/^[a-f0-9]{64}$/.test(hash)) fail('Invalid object hash');
    return path.join(this.root, 'objects', hash.slice(0, 2), hash);
  }
  get(id: string): RecordEntry {
    const row = this.db.prepare('SELECT * FROM records WHERE id=?').get(id) as any;
    if (!row) fail('Record not found', 404);
    return { ...row, members: JSON.parse(row.members), tags: JSON.parse(row.tags) };
  }
  audit(id: string, action: string, actor: string, detail: unknown) {
    this.db.prepare('INSERT INTO audit(recordId,action,actor,detail,createdAt) VALUES(?,?,?,?,?)')
      .run(id, action, string(actor, 'actor', 200), JSON.stringify(detail), now());
  }
  reindex(id: string) {
    const r = this.get(id);
    const sourceNames = this.db.prepare('SELECT source FROM sources WHERE recordId=?').all(id).map(x => x.source).join(' ');
    const extraction = this.db.prepare("SELECT text FROM artifacts WHERE recordId=? AND kind='extraction' ORDER BY rowid DESC LIMIT 1").get(id);
    const notes = this.db.prepare("SELECT text FROM artifacts WHERE recordId=? AND kind!='extraction' ORDER BY rowid").all(id).map(x => x.text).join('\n');
    this.db.prepare('DELETE FROM search_index WHERE id=?').run(id);
    this.db.prepare('INSERT INTO search_index(id,title,metadata,content) VALUES(?,?,?,?)').run(id, r.title,
      [r.filename, ...r.members, ...r.tags, r.category, r.notes, sourceNames].join(' '), `${extraction?.text ?? ''}\n${notes}`);
  }
  ingest(data: Buffer, filename: string, mime = 'application/octet-stream', actor = 'household', source?: string, metadata: unknown = {}) {
    filename = path.basename(string(filename, 'filename', 1000).replaceAll('\\', '/')).replace(/[\x00-\x1f]/g, '').trim();
    if (!filename) fail('Filename is required');
    if (data.length > 200 * 1024 * 1024) fail('Maximum file size is 200 MB', 413);
    mime = string(mime, 'mime', 200);
    const hash = sha256(data), dest = this.objectPath(hash);
    fs.mkdirSync(path.dirname(dest), { recursive: true, mode: 0o700 });
    if (!fs.existsSync(dest)) {
      const temp = `${dest}.${randomUUID()}.tmp`;
      const fd = fs.openSync(temp, 'wx', 0o600);
      try { fs.writeFileSync(fd, data); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
      try { fs.linkSync(temp, dest); } catch (e: any) { if (e.code !== 'EEXIST') throw e; }
      finally { fs.unlinkSync(temp); }
      const dir = fs.openSync(path.dirname(dest), 'r');
      try { fs.fsyncSync(dir); } finally { fs.closeSync(dir); }
    }
    if (sha256(fs.readFileSync(dest)) !== hash) fail('Stored original failed its integrity check', 500);
    return this.transaction(() => {
      const existing = this.db.prepare('SELECT id FROM records WHERE sha256=?').get(hash);
      const id = existing ? String(existing.id) : randomUUID();
      if (!existing) {
        const date = now();
        this.db.prepare('INSERT INTO records(id,sha256,filename,mime,size,title,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?)')
          .run(id, hash, filename, mime, data.length, filename.replace(/\.[^.]+$/, '') || filename, date, date);
        this.audit(id, 'uploaded', actor, { filename, sha256: hash });
      }
      if (source) this.db.prepare('INSERT OR IGNORE INTO sources(source,sha256,recordId,metadata) VALUES(?,?,?,?)')
        .run(source, hash, id, JSON.stringify(metadata));
      this.reindex(id);
      return { record: this.get(id), duplicate: !!existing };
    });
  }
  original(id: string) {
    const record = this.get(id), data = fs.readFileSync(this.objectPath(record.sha256));
    if (sha256(data) !== record.sha256) fail('Original failed its integrity check', 500);
    return { record, data };
  }
  update(id: string, input: Record<string, unknown>, actor = 'household') {
    return this.transaction(() => {
      const r = this.get(id);
      const before = { ...r };
      if (input.revision !== r.revision) fail('Record changed. Reload it before saving.', 409);
      const fields = ['title', 'members', 'tags', 'category', 'notes', 'status', 'statusReason', 'expiresOn'];
      if (Object.keys(input).some(k => k !== 'revision' && !fields.includes(k))) fail('Unknown record field');
      for (const field of fields) if (input[field] !== undefined) {
        (r as any)[field] = field === 'members' || field === 'tags' ? names(input[field], field) : string(input[field], field, field === 'notes' ? 100000 : 1000).trim();
      }
      if (!r.title) fail('Title is required');
      if (!['active', 'archived', 'invalid'].includes(r.status)) fail('Invalid status');
      if (input.status && input.status !== before.status && (typeof input.statusReason !== 'string' || !input.statusReason.trim())) fail('A fresh reason is required for a status change');
      if (r.expiresOn && (!/^\d{4}-\d{2}-\d{2}$/.test(r.expiresOn) || !Number.isFinite(Date.parse(r.expiresOn)) || new Date(r.expiresOn).toISOString().slice(0, 10) !== r.expiresOn)) fail('Expiry must be a valid YYYY-MM-DD date');
      this.db.prepare(`UPDATE records SET title=?,members=?,tags=?,category=?,notes=?,status=?,statusReason=?,expiresOn=?,revision=revision+1,updatedAt=? WHERE id=?`)
        .run(r.title, JSON.stringify(r.members), JSON.stringify(r.tags), r.category, r.notes, r.status, r.statusReason, r.expiresOn, now(), id);
      this.audit(id, 'updated', actor, { before, changes: input });
      this.reindex(id);
      return this.get(id);
    });
  }
  addArtifact(id: string, text: string, kind = 'note', provider = 'household', chunks: ChunkInput[] = []) {
    string(text, 'content', 20_000_000); string(provider, 'provider', 200);
    if (!['note', 'extraction', 'legacy-digest'].includes(kind)) fail('Invalid content kind');
    return this.transaction(() => {
      const r = this.get(id), artifactId = randomUUID();
      this.db.prepare('INSERT INTO artifacts(id,recordId,kind,text,provider,createdAt,sourceHash) VALUES(?,?,?,?,?,?,?)')
        .run(artifactId, id, kind, text, provider, now(), r.sha256);
      if (kind === 'extraction') {
        for (const [i, chunk] of chunks.entries()) this.db.prepare('INSERT INTO chunks(id,artifactId,recordId,ordinal,page,start,end,text) VALUES(?,?,?,?,?,?,?,?)')
          .run(`${artifactId}:${i}`, artifactId, id, i, chunk.page ?? null, chunk.start ?? null, chunk.end ?? null, chunk.text);
        this.db.prepare("UPDATE records SET extractionState='ready',extractionError='' WHERE id=?").run(id);
      }
      this.audit(id, 'content-added', provider, { artifactId, kind, sourceHash: r.sha256 });
      this.reindex(id);
      return this.db.prepare('SELECT * FROM artifacts WHERE id=?').get(artifactId);
    });
  }
  content(id: string, offset = 0, limit = 100) {
    this.get(id);
    const artifact = this.db.prepare("SELECT * FROM artifacts WHERE recordId=? AND kind='extraction' ORDER BY rowid DESC LIMIT 1").get(id);
    const chunks = artifact ? this.db.prepare('SELECT * FROM chunks WHERE artifactId=? ORDER BY ordinal LIMIT ? OFFSET ?').all(artifact.id, limit, offset) : [];
    const total = artifact ? Number(this.db.prepare('SELECT count(*) AS n FROM chunks WHERE artifactId=?').get(artifact.id).n) : 0;
    return { artifact: artifact ? { id: String(artifact.id), recordId: String(artifact.recordId), kind: String(artifact.kind), provider: String(artifact.provider), createdAt: String(artifact.createdAt), sourceHash: String(artifact.sourceHash) } : null, chunks, total, offset, limit };
  }
  detail(id: string) {
    return { record: this.get(id), sources: this.db.prepare('SELECT * FROM sources WHERE recordId=?').all(id),
      artifacts: this.db.prepare('SELECT id,kind,provider,createdAt,sourceHash,length(text) AS length FROM artifacts WHERE recordId=? ORDER BY rowid DESC').all(id),
      links: this.db.prepare(`SELECT l.*,s.title AS sourceTitle,t.title AS targetTitle FROM links l JOIN records s ON s.id=l.sourceId JOIN records t ON t.id=l.targetId WHERE sourceId=? OR targetId=? ORDER BY l.createdAt`).all(id, id),
      audit: this.db.prepare('SELECT * FROM audit WHERE recordId=? ORDER BY id DESC LIMIT 100').all(id) };
  }
  link(sourceId: string, targetId: string, type: string, note: string, actor = 'household') {
    if (sourceId === targetId) fail('A record cannot link to itself');
    if (!['related', 'supersedes', 'supports', 'attachment'].includes(type)) fail('Invalid link type');
    string(note, 'note', 10000);
    return this.transaction(() => {
      this.get(sourceId); this.get(targetId);
      this.db.prepare('INSERT OR IGNORE INTO links(id,sourceId,targetId,type,note,createdAt) VALUES(?,?,?,?,?,?)')
        .run(randomUUID(), sourceId, targetId, type, note, now());
      this.audit(sourceId, 'linked', actor, { targetId, type, note });
      return this.detail(sourceId).links;
    });
  }
  unlink(id: string, actor = 'household') {
    return this.transaction(() => {
      const link = this.db.prepare('SELECT * FROM links WHERE id=?').get(id);
      if (!link) fail('Link not found', 404);
      this.db.prepare('DELETE FROM links WHERE id=?').run(id);
      this.audit(String(link.sourceId), 'unlinked', actor, link);
      return { removed: id };
    });
  }
  search(input: SearchInput = {}) {
    const q = string(input.q ?? '', 'query', 2000).trim(), status = input.status ?? 'active';
    if (!['active', 'archived', 'invalid', 'all'].includes(status)) fail('Invalid status filter');
    const limit = Math.max(1, Math.min(100, Math.floor(Number(input.limit) || 40)));
    const offset = Math.max(0, Math.floor(Number(input.offset) || 0));
    const terms = q.match(/[\p{L}\p{N}_]+/gu)?.slice(0, 40) ?? [];
    const match = terms.map(t => `"${t}"*`).join(' AND ');
    const where: string[] = [], args: (string | number)[] = [];
    if (q && !match) return { records: [], total: 0, limit, offset };
    if (match) { where.push('search_index MATCH ?'); args.push(match); }
    if (status !== 'all') { where.push('r.status=?'); args.push(status); }
    for (const [key, column] of [['member', 'members'], ['tag', 'tags']] as const) if (input[key]) {
      where.push(`EXISTS(SELECT 1 FROM json_each(r.${column}) WHERE value=?)`); args.push(input[key]);
    }
    if (input.category) { where.push('r.category=?'); args.push(input.category); }
    const from = `FROM records r ${match ? 'JOIN search_index ON search_index.id=r.id' : ''} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}`;
    const total = Number(this.db.prepare(`SELECT count(*) AS n ${from}`).get(...args).n);
    const rows = this.db.prepare(`SELECT r.id ${match ? ",snippet(search_index,3,'','', ' … ',36) AS snippet" : ",'' AS snippet"} ${from}
      ORDER BY ${match ? 'bm25(search_index,0,8,4,1),' : ''}r.createdAt DESC,r.id LIMIT ? OFFSET ?`).all(...args, limit, offset);
    return { records: rows.map(x => ({ ...this.get(String(x.id)), snippet: x.snippet })), total, limit, offset };
  }
  stats() {
    return { total: Number(this.db.prepare('SELECT count(*) AS n FROM records').get().n),
      statuses: this.db.prepare('SELECT status,count(*) AS count FROM records GROUP BY status').all(),
      extraction: this.db.prepare('SELECT extractionState AS state,count(*) AS count FROM records GROUP BY extractionState').all(),
      members: this.db.prepare('SELECT DISTINCT value FROM records,json_each(members) ORDER BY value').all().map(x => x.value),
      tags: this.db.prepare('SELECT DISTINCT value FROM records,json_each(tags) ORDER BY value').all().map(x => x.value) };
  }
  retry(id: string) {
    this.get(id);
    this.db.prepare("UPDATE records SET extractionState='pending',extractionError='' WHERE id=? AND extractionState!='running'").run(id);
    return this.get(id);
  }
  verify() {
    const integrity = this.db.prepare('PRAGMA integrity_check').all();
    const foreignKeys = this.db.prepare('PRAGMA foreign_key_check').all();
    const failures: string[] = [];
    for (const row of this.db.prepare('SELECT id,sha256 FROM records').all()) {
      try { if (sha256(fs.readFileSync(this.objectPath(String(row.sha256)))) !== row.sha256) failures.push(String(row.id)); }
      catch { failures.push(String(row.id)); }
    }
    return { valid: integrity.every(row => row.integrity_check === 'ok') && !foreignKeys.length && !failures.length, integrity, foreignKeys, failures, records: this.stats().total };
  }
  backup(destination: string) {
    const dest = path.resolve(destination);
    if (fs.existsSync(dest)) fail('Backup destination must not exist');
    fs.mkdirSync(dest, { recursive: true, mode: 0o700 });
    this.db.prepare('VACUUM INTO ?').run(path.join(dest, 'records.sqlite'));
    const snapshot = new RecordStore(dest);
    try {
      snapshot.db.prepare('DELETE FROM runtime_lock').run();
      for (const row of snapshot.db.prepare('SELECT sha256 FROM records').all()) {
        const target = snapshot.objectPath(String(row.sha256));
        fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
        fs.copyFileSync(this.objectPath(String(row.sha256)), target);
      }
      const report = snapshot.verify();
      if (!report.valid) fail('Backup integrity check failed', 500);
      fs.writeFileSync(path.join(dest, 'manifest.json'), JSON.stringify({ createdAt: now(), ...report }, null, 2), { mode: 0o600 });
      return report;
    } finally { snapshot.close(); }
  }
}
