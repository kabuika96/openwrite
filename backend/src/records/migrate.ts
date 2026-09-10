import fs from 'node:fs';
import path from 'node:path';
import { RecordStore, sha256 } from './store.js';
import { mimeFor } from './extraction.js';

export function inventory(root: string) {
  const files: { relativePath: string; size: number; sha256: string; modifiedAt: string }[] = [];
  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Migration requires explicit handling of symbolic link: ${file}`);
      if (entry.isDirectory()) walk(file);
      else if (entry.isFile()) {
        const stat = fs.statSync(file);
        files.push({ relativePath: path.relative(root, file), size: stat.size, sha256: sha256(fs.readFileSync(file)), modifiedAt: stat.mtime.toISOString() });
      } else throw new Error(`Unsupported filesystem entry: ${file}`);
    }
  }
  walk(root); return files;
}

export function migrateVault(store: RecordStore, sourceRoot: string, options: { snapshot: string; legacyIndex?: string; appData?: string }) {
  sourceRoot = fs.realpathSync(sourceRoot);
  const snapshot = path.resolve(options.snapshot);
  if (snapshot === sourceRoot || snapshot.startsWith(sourceRoot + path.sep) || store.root === sourceRoot || store.root.startsWith(sourceRoot + path.sep)) throw new Error('Migration destination must be outside the original vault');
  const files = inventory(sourceRoot);
  // A complete raw snapshot is retained in addition to the content-addressed library.
  if (!fs.existsSync(snapshot)) {
    fs.mkdirSync(snapshot, { recursive: true, mode: 0o700 });
    fs.cpSync(sourceRoot, path.join(snapshot, 'vault'), { recursive: true, preserveTimestamps: true });
    if (options.appData) {
      for (const name of ['openwrite-state.json', 'openwrite-memory-index.json', 'yjs-cache', 'codex-runs']) {
        const from = path.join(options.appData, name);
        if (fs.existsSync(from)) fs.cpSync(from, path.join(snapshot, 'app-data', name), { recursive: true, preserveTimestamps: true });
      }
    }
  }
  const snapshotFiles = inventory(path.join(snapshot, 'vault'));
  if (JSON.stringify(files.map(({ relativePath, sha256 }) => [relativePath, sha256])) !== JSON.stringify(snapshotFiles.map(({ relativePath, sha256 }) => [relativePath, sha256]))) throw new Error('Snapshot differs from source. Use a new snapshot directory.');
  const mapping = new Map<string, string>();
  let created = 0, duplicates = 0, digests = 0, links = 0;
  const manifest: any[] = [];
  for (const file of files) {
    const data = fs.readFileSync(path.join(snapshot, 'vault', file.relativePath));
    const existingSource = store.db.prepare('SELECT recordId FROM sources WHERE source=? AND sha256=?').get(path.join(sourceRoot, file.relativePath), file.sha256);
    const result = store.ingest(data, path.basename(file.relativePath), mimeFor(file.relativePath), 'migration', path.join(sourceRoot, file.relativePath), file);
    mapping.set(file.relativePath, result.record.id);
    if (result.duplicate) duplicates++; else created++;
    if (!existingSource && !result.duplicate) {
      const internal = file.relativePath.startsWith('.') || file.relativePath.includes('migration-backup') || file.relativePath.includes('migration-report');
      let title = result.record.title;
      if (file.relativePath.endsWith('.md')) {
        const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(data.toString('utf8'))?.[1];
        const parsedTitle = /^title:\s*(.+)$/m.exec(frontmatter ?? '')?.[1]?.trim().replace(/^["']|["']$/g, '');
        if (parsedTitle) title = parsedTitle;
      }
      store.update(result.record.id, { revision: result.record.revision, title,
        category: file.relativePath.includes(path.sep) ? file.relativePath.split(path.sep)[0] : '',
        tags: ['imported'], ...(internal ? { status: 'archived', statusReason: 'Legacy application metadata or migration backup' } : {}) }, 'migration');
    }
    if (sha256(store.original(result.record.id).data) !== file.sha256) throw new Error('Migrated object failed verification');
    manifest.push({ ...file, recordId: result.record.id, duplicate: result.duplicate });
  }
  // Preserve existing model output as explicitly labelled legacy derivations, never as source text.
  let legacy: any = null;
  if (options.legacyIndex && fs.existsSync(options.legacyIndex)) {
    const index = JSON.parse(fs.readFileSync(options.legacyIndex, 'utf8'));
    legacy = Object.entries(index.vaults ?? {}).find(([root]) => {
      try { return fs.realpathSync(root) === sourceRoot; } catch { return false; }
    })?.[1];
    if (legacy) {
      for (const [relativePath, id] of mapping) {
        const spans = (Object.values(legacy.sourceSpans ?? {}) as any[]).filter(s => s.path === relativePath).sort((a, b) => a.index - b.index);
        if (spans.length && !store.db.prepare("SELECT id FROM artifacts WHERE recordId=? AND kind='legacy-digest' AND provider=?").get(id, `legacy:${relativePath}`.slice(0, 200))) {
          store.addArtifact(id, spans.map(s => `[Legacy generated digest; source span ${s.id}; freshness ${s.freshness}]\n${s.text}`).join('\n\n'), 'legacy-digest', `legacy:${relativePath}`.slice(0, 200)); digests++;
        }
      }
      // Keep the previous knowledge graph and caches retrievable, excluding credentials and runtime provider configuration.
      const { config, ...knowledge } = legacy;
      const data = Buffer.from(JSON.stringify({ version: index.version, sourceVault: sourceRoot, knowledge }, null, 2));
      const { record, duplicate } = store.ingest(data, 'Legacy OpenWrite knowledge.json', 'application/json', 'migration', `legacy-index:${sourceRoot}`, { kind: 'legacy-derived-index', notAuthoritative: true });
      if (!duplicate) {
        store.update(record.id, { revision: record.revision, status: 'archived', statusReason: 'Preserved legacy generated knowledge; use original documents for evidence', tags: ['legacy', 'generated'], category: 'Migration' }, 'migration');
        store.db.prepare("UPDATE records SET extractionState='unsupported',extractionError='Legacy derived index preserved for agent retrieval; excluded from automatic extraction.' WHERE id=?").run(record.id);
      }
    }
  }
  for (const [relativePath, id] of mapping) {
    if (!relativePath.endsWith('.md')) continue;
    const text = fs.readFileSync(path.join(snapshot, 'vault', relativePath), 'utf8');
    const targets = [...text.matchAll(/\]\(([^)]+)\)|\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)].map(m => m[1] ?? m[2]);
    for (let target of targets) {
      target = target.replace(/^<|>$/g, '').split('#')[0].split('?')[0];
      try { target = decodeURIComponent(target); } catch { continue; }
      if (!target || /^[a-z]+:/i.test(target)) continue;
      const candidates = [path.normalize(path.join(path.dirname(relativePath), target)), target, target + '.md'];
      let targetId = candidates.map(c => mapping.get(c)).find(Boolean);
      if (!targetId) {
        const byName = [...mapping].filter(([p]) => path.basename(p, path.extname(p)) === target);
        if (byName.length === 1) targetId = byName[0][1];
      }
      if (targetId && targetId !== id && !store.db.prepare("SELECT id FROM links WHERE sourceId=? AND targetId=? AND type='attachment'").get(id, targetId)) {
        store.link(id, targetId, 'attachment', `Imported explicit Markdown link: ${target}`, 'migration'); links++;
      }
    }
  }
  const after = inventory(sourceRoot);
  if (JSON.stringify(files) !== JSON.stringify(after)) throw new Error('Source changed during migration; retained snapshot and partial import. Run again with a fresh snapshot.');
  const verification = store.verify();
  if (!verification.valid) throw new Error('Library integrity check failed');
  const report = { version: 1, completedAt: new Date().toISOString(), sourceRoot, snapshot, sourceFiles: files.length,
    sourceBytes: files.reduce((sum, f) => sum + f.size, 0), created, duplicates, digests, links, legacyKnowledgePreserved: !!legacy,
    verification, files: manifest };
  fs.writeFileSync(path.join(snapshot, 'migration-manifest.json'), JSON.stringify(report, null, 2), { mode: 0o600 });
  return report;
}
