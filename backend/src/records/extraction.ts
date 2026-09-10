import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import type { ChunkInput, RecordEntry } from './store.js';
import { RecordStore } from './store.js';

const exec = promisify(execFile);
const textExtensions = new Set(['.md', '.txt', '.csv', '.json', '.yaml', '.yml', '.xml', '.html', '.htm', '.eml', '.ics', '.vcf', '.log', '.canvas', '.svg']);
export function mimeFor(filename: string) {
  const extension = path.extname(filename).toLowerCase();
  return ({ '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
    '.tiff': 'image/tiff', '.tif': 'image/tiff', '.gif': 'image/gif', '.md': 'text/markdown', '.txt': 'text/plain', '.csv': 'text/csv',
    '.json': 'application/json', '.zip': 'application/zip', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.svg': 'image/svg+xml',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation' } as Record<string, string>)[extension] ?? 'application/octet-stream';
}
export function chunkPages(pages: string[]): ChunkInput[] {
  const chunks: ChunkInput[] = [];
  for (const [pageIndex, text] of pages.entries()) {
    for (let start = 0; start < text.length; start += 1800) {
      const end = Math.min(text.length, start + 2000);
      if (text.slice(start, end).trim()) chunks.push({ text: text.slice(start, end), page: pageIndex + 1, start, end });
      if (end === text.length) break;
    }
  }
  return chunks;
}
async function command(file: string, args: string[], timeout = 120000) {
  return (await exec(file, args, { timeout, maxBuffer: 25 * 1024 * 1024, env: { ...process.env, OMP_THREAD_LIMIT: '2' } })).stdout;
}
export async function extract(record: RecordEntry, originalPath: string) {
  const ext = path.extname(record.filename.replace(/\.md\.bak$/i, '.md')).toLowerCase();
  if (textExtensions.has(ext)) {
    const buffer = await fs.readFile(originalPath);
    let text = buffer.toString('utf8');
    if (buffer[0] === 0xff && buffer[1] === 0xfe) text = buffer.subarray(2).toString('utf16le');
    return { pages: [text], provider: 'local-text-v1' };
  }
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'openwrite-extract-'));
  try {
    if (ext === '.pdf') {
      const raw = await command('pdftotext', ['-layout', originalPath, '-']);
      const pages = raw.split('\f');
      if (pages.at(-1) === '') pages.pop();
      let usedOcr = false;
      for (let i = 0; i < pages.length; i++) if (pages[i].trim().length < 30) {
        const prefix = path.join(temp, `page-${i + 1}`);
        await command('pdftoppm', ['-f', String(i + 1), '-l', String(i + 1), '-r', '150', '-singlefile', '-png', originalPath, prefix]);
        const ocr = await command('tesseract', [`${prefix}.png`, 'stdout', '-l', process.env.OPENWRITE_OCR_LANGUAGES || 'eng']);
        if (ocr.trim().length > pages[i].trim().length) pages[i] = ocr;
        await fs.unlink(`${prefix}.png`);
        usedOcr = true;
      }
      return { pages, provider: usedOcr ? 'poppler+tesseract-v1' : 'poppler-v1' };
    }
    if (['.png', '.jpg', '.jpeg', '.tif', '.tiff', '.webp', '.bmp', '.gif'].includes(ext)) {
      // Tesseract treats unrecognized input as a list of local image paths. Reject it before invoking OCR.
      const handle = await fs.open(originalPath, 'r');
      const header = Buffer.alloc(16);
      try { await handle.read(header, 0, header.length, 0); } finally { await handle.close(); }
      const signature = header.toString('hex');
      const image = signature.startsWith('89504e470d0a1a0a') || signature.startsWith('ffd8ff') || signature.startsWith('47494638')
        || signature.startsWith('49492a00') || signature.startsWith('4d4d002a') || signature.startsWith('424d')
        || (header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP');
      if (!image) throw Object.assign(new Error('The uploaded file is labelled as an image but does not contain a recognized image. Original preserved.'), { safeMessage: true });
      return { pages: [await command('tesseract', [originalPath, 'stdout', '-l', process.env.OPENWRITE_OCR_LANGUAGES || 'eng'])], provider: 'tesseract-v1' };
    }
    // Docling is optional: keep the original available even when a converter is unavailable.
    if (process.env.OPENWRITE_DOCLING_COMMAND) {
      const input = path.join(temp, `input${ext}`);
      await fs.copyFile(originalPath, input);
      await command(process.env.OPENWRITE_DOCLING_COMMAND, [input, '--to', 'md', '--output', temp], 600000);
      return { pages: [await fs.readFile(path.join(temp, 'input.md'), 'utf8')], provider: 'docling-local' };
    }
    if (['.docx', '.xlsx', '.pptx', '.odt', '.ods', '.odp', '.zip'].includes(ext)) {
      const script = `import sys,zipfile,xml.etree.ElementTree as E
with zipfile.ZipFile(sys.argv[1]) as z:
 names=z.namelist()
 if sys.argv[2]=='.zip': print('Archive contents:\\n'+'\\n'.join(names))
 else:
  selected=[n for n in names if (n.startswith('word/') and n.endswith('.xml') and ('document' in n or 'header' in n or 'footer' in n)) or n=='xl/sharedStrings.xml' or (n.startswith('xl/worksheets/') and n.endswith('.xml')) or (n.startswith('ppt/slides/slide') and n.endswith('.xml')) or n=='content.xml']
  if sum(z.getinfo(n).file_size for n in selected)>25000000: raise ValueError('Expanded document exceeds extraction limit')
  shared=[]
  if 'xl/sharedStrings.xml' in names:
   shared=[''.join(e.itertext()) for e in E.fromstring(z.read('xl/sharedStrings.xml'))]
  for n in sorted(selected):
   root=E.fromstring(z.read(n))
   if n.startswith('xl/worksheets/'):
    for row in root.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row'):
     values=[]
     for cell in row:
      value=''.join(cell.itertext())
      if cell.get('t')=='s' and value.isdigit(): value=shared[int(value)]
      values.append(value)
     print(' | '.join(values))
   elif n!='xl/sharedStrings.xml':
    for e in root.iter():
     if e.tag.split('}')[-1] in ['p','h']: print(''.join(e.itertext()))
   print('\\f')`;
      return { pages: (await command('python3', ['-c', script, originalPath, ext])).split('\f'), provider: ext === '.zip' ? 'archive-inventory-v1' : 'office-xml-v1' };
    }
    return null;
  } finally { await fs.rm(temp, { recursive: true, force: true }); }
}

export function startExtractionWorker(store: RecordStore) {
  let stopped = false, running: Promise<void> | null = null;
  const token = randomUUID();
  store.transaction(() => {
    const owner = store.db.prepare("SELECT pid FROM runtime_lock WHERE name='extraction'").get();
    if (owner) {
      let alive = true;
      try { process.kill(Number(owner.pid), 0); } catch (error: any) { if (error.code === 'ESRCH') alive = false; }
      if (alive) throw new Error('This library already has an extraction worker. Stop the existing records server before starting another.');
    }
    store.db.prepare("INSERT OR REPLACE INTO runtime_lock(name,pid,token) VALUES('extraction',?,?)").run(process.pid, token);
  });
  // There is one worker, owned by the HTTP server; MCP delegates to that server.
  store.db.prepare("UPDATE records SET extractionState='pending' WHERE extractionState='running'").run();
  async function drain() {
    while (!stopped) {
      const next = store.db.prepare("SELECT id FROM records WHERE extractionState='pending' ORDER BY createdAt LIMIT 1").get();
      if (!next) break;
      const record = store.get(String(next.id));
      store.db.prepare("UPDATE records SET extractionState='running',extractionError='' WHERE id=?").run(record.id);
      try {
        const result = await extract(record, store.objectPath(record.sha256));
        if (!result) store.db.prepare("UPDATE records SET extractionState='unsupported',extractionError=? WHERE id=?")
          .run('Original retained. Add agent content or configure a local Docling converter for this format.', record.id);
        else {
          const text = result.pages.join('\n\n');
          if (!text.trim()) store.db.prepare("UPDATE records SET extractionState='empty',extractionError=? WHERE id=?")
            .run('No readable text found. The original is available for inspection.', record.id);
          else store.addArtifact(record.id, text, 'extraction', result.provider, chunkPages(result.pages));
        }
      } catch (error: any) {
        const message = error.safeMessage ? error.message : error.code === 'ENOENT' ? 'A local converter is missing. Install Poppler/Tesseract or configure Docling, then retry.'
          : error.killed ? 'Local conversion exceeded its time limit. Original preserved; inspect it or retry with another converter.'
          : 'Local conversion failed. The file may be damaged, encrypted or mislabeled. Original preserved; inspect it or retry with another converter.';
        store.db.prepare("UPDATE records SET extractionState='failed',extractionError=? WHERE id=?").run(message, record.id);
      }
    }
  }
  const kick = () => { if (!stopped && !running) running = drain().finally(() => { running = null; }); };
  const timer = setInterval(kick, 1000); timer.unref(); kick();
  return { kick, async stop() {
    stopped = true; clearInterval(timer); await running;
    store.db.prepare("DELETE FROM runtime_lock WHERE name='extraction' AND token=?").run(token);
  } };
}
