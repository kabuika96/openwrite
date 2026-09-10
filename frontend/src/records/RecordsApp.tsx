import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Archive, ArrowLeft, Check, ChevronLeft, ChevronRight, Download, FileText, FolderOpen, Link2, Plus, Search, Upload, X } from 'lucide-react';
import './records.css';

type RecordFile = {
  id: string; title: string; filename: string; mime: string; size: number; sha256: string; revision: number;
  status: string; statusReason: string; members: string[]; tags: string[]; category: string; notes: string;
  expiresOn: string; extractionState: string; extractionError: string; createdAt: string; snippet?: string;
};
type RecordLink = { id: string; sourceId: string; targetId: string; sourceTitle: string; targetTitle: string; type: string; note: string };
type Artifact = { id: string; kind: string; provider: string; createdAt: string; length: number };
type Detail = { record: RecordFile; links: RecordLink[]; artifacts: Artifact[]; sources: { source: string }[]; audit: { id: number; action: string; actor: string; createdAt: string; detail: string }[] };
type Stats = { total: number; statuses: { status: string; count: number }[]; extraction: { state: string; count: number }[]; members: string[]; tags: string[] };
type Content = { artifact: { id: string; sourceHash: string; provider: string } | null; total: number; offset: number; chunks: { id: string; page: number; text: string }[] };
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { ...(init?.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...init?.headers } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'The local server could not complete this request.');
  return body;
}
const size = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const comma = (text: string) => text.split(',').map(x => x.trim()).filter(Boolean);

export function RecordsApp() {
  const [q, setQ] = useState(''), [status, setStatus] = useState('active'), [member, setMember] = useState(''), [tag, setTag] = useState('');
  const [records, setRecords] = useState<RecordFile[]>([]), [total, setTotal] = useState(0), [offset, setOffset] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null), [selected, setSelected] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [uploading, setUploading] = useState(false), [loading, setLoading] = useState(true);
  const uploadRef = useRef<HTMLInputElement>(null);
  useEffect(() => { document.title = 'OpenWrite · Household records'; }, []);
  useEffect(() => {
    const abort = new AbortController();
    api<Stats>('/api/records/stats', { signal: abort.signal }).then(setStats).catch(e => { if (!abort.signal.aborted) setError(e.message); });
    return () => abort.abort();
  }, [refresh]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const timer = window.setTimeout(() => {
      api<{ records: RecordFile[]; total: number }>(`/api/records?${new URLSearchParams({ q, status, member, tag, offset: String(offset), limit: '40' })}`, { signal: controller.signal })
        .then(result => { setRecords(result.records); setTotal(result.total); setError(''); })
        .catch(e => { if (!controller.signal.aborted) setError(e.message); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 180);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [q, status, member, tag, offset, refresh]);
  const pending = stats?.extraction.filter(x => ['pending', 'running'].includes(x.state)).reduce((n, x) => n + x.count, 0) ?? 0;
  useEffect(() => {
    if (!pending) return;
    const timer = window.setInterval(() => setRefresh(n => n + 1), 4000);
    return () => clearInterval(timer);
  }, [pending]);
  async function upload(files: FileList | File[]) {
    if (uploading || !files.length) return;
    setUploading(true); setError(''); setNotice('');
    let added = 0, duplicates = 0;
    try {
      for (const file of Array.from(files)) {
        if (file.size > 200 * 1024 * 1024) throw new Error(`${file.name} exceeds the 200 MB file limit.`);
        const body = new FormData(); body.append('document', file);
        const result = await api<{ results: { duplicate: boolean; record: RecordFile }[] }>('/api/records', { method: 'POST', body });
        for (const item of result.results) item.duplicate ? duplicates++ : added++;
      }
      setNotice(`${added} file${added === 1 ? '' : 's'} added${duplicates ? ` · ${duplicates} already in your library` : ''}.`);
    } catch (e) { setError(`${(e as Error).message}${added ? ` ${added} files were already saved.` : ''}`); }
    finally { setUploading(false); setRefresh(n => n + 1); if (uploadRef.current) uploadRef.current.value = ''; }
  }
  return <div className="records-app" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void upload(e.dataTransfer.files); }}>
    <header className="records-header"><a className="records-brand" href="/" aria-label="OpenWrite home"><FolderOpen size={22} /><span>OpenWrite<small>Household records</small></span></a>
      <div className="records-header-actions"><span className="records-local">On this machine</span><button className="records-primary" onClick={() => uploadRef.current?.click()} disabled={uploading}><Upload size={16} />{uploading ? 'Saving…' : 'Add files'}</button></div>
      <input ref={uploadRef} aria-label="Upload documents" type="file" multiple hidden onChange={e => e.target.files && void upload(e.target.files)} />
    </header>
    <div className="records-layout">
      <aside className="records-sidebar"><div className="records-nav-label">LIBRARY</div>
        {['active', 'archived', 'invalid', 'all'].map(value => <button key={value} className={`records-nav ${status === value ? 'is-selected' : ''}`} onClick={() => { setStatus(value); setOffset(0); setSelected(null); }}>
          {value === 'archived' ? <Archive size={17} /> : <FileText size={17} />}<span>{value === 'all' ? 'All records' : value[0].toUpperCase() + value.slice(1)}</span><small>{value === 'all' ? stats?.total ?? 0 : stats?.statuses.find(s => s.status === value)?.count ?? 0}</small>
        </button>)}
        <div className="records-sidebar-filters"><label>Family member<select value={member} onChange={e => { setMember(e.target.value); setOffset(0); }}><option value="">Everyone</option>{stats?.members.map(m => <option key={m}>{m}</option>)}</select></label>
          <label>Tag<select value={tag} onChange={e => { setTag(e.target.value); setOffset(0); }}><option value="">Any tag</option>{stats?.tags.map(t => <option key={t}>{t}</option>)}</select></label></div>
        <details className="records-agent-help"><summary>Connect a local agent</summary><p>Start the MCP server from this project:</p><code>npm run mcp --workspace backend</code><p>Tools can search, read originals and extracted text, add notes, update status, and connect records.</p><a href="/api/health" target="_blank" rel="noreferrer">Check local API</a></details>
        <p className="records-storage-note">Original files stay intact.<br />Archive and invalidation are reversible.</p>
      </aside>
      <main className={`records-main ${selected ? 'has-detail' : ''}`}>
        <section className="records-list-pane" aria-label="Record library">
          <div className="records-list-heading"><div><h1>{status === 'all' ? 'All records' : status === 'active' ? 'Your records' : status[0].toUpperCase() + status.slice(1)}</h1><p>{loading ? 'Finding records…' : `${total} record${total === 1 ? '' : 's'}`}{pending > 0 ? ` · Reading ${pending} file${pending === 1 ? '' : 's'}` : ''}</p></div></div>
          <label className="records-search"><Search size={19} /><input type="search" placeholder="Find a document, name, or detail…" value={q} onChange={e => { setQ(e.target.value); setOffset(0); }} aria-label="Search records" />{q && <button aria-label="Clear search" onClick={() => setQ('')}><X size={16} /></button>}</label>
          {error && <p role="alert" className="records-error">{error}<button onClick={() => setRefresh(n => n + 1)}>Retry</button></p>}
          {notice && <p role="status" className="records-notice"><Check size={16} />{notice}</p>}
          {!loading && !records.length && <div className="records-empty"><FolderOpen size={36} /><h2>{q || member || tag ? 'No matching records' : 'A place for household paperwork'}</h2><p>{q || member || tag ? 'Try fewer keywords, another member, or All records.' : 'Drop files here, or add PDFs, scans, photos, notes and other documents.'}</p>{!q && <button onClick={() => uploadRef.current?.click()}>Add your first files</button>}</div>}
          <div className="records-list" aria-busy={loading}>{records.map(record => <button className={`records-row ${selected === record.id ? 'is-selected' : ''}`} key={record.id} onClick={() => setSelected(record.id)}>
            <span className="records-file-icon"><FileText size={21} /><small>{record.filename.split('.').pop()?.slice(0, 5).toUpperCase()}</small></span>
            <span className="records-row-body"><strong>{record.title}</strong><span>{[record.members.join(', '), record.category, size(record.size)].filter(Boolean).join(' · ')}</span>{record.snippet && <p>{record.snippet}</p>}<span className="records-row-tags">{record.status !== 'active' && <em>{record.status}</em>}{record.tags.filter(t => t !== 'imported').slice(0, 3).map(t => <em key={t}>{t}</em>)}{['failed', 'empty', 'unsupported'].includes(record.extractionState) && <em>Original available · {record.extractionState === 'failed' ? 'extraction needs attention' : 'limited text'}</em>}</span></span><ChevronRight size={16} />
          </button>)}</div>
          {total > 40 && <nav className="records-pagination" aria-label="Search pages"><button disabled={offset === 0} onClick={() => setOffset(n => Math.max(0, n - 40))}><ChevronLeft size={16} />Previous</button><span>{offset + 1}–{Math.min(total, offset + 40)} of {total}</span><button disabled={offset + 40 >= total} onClick={() => setOffset(n => n + 40)}>Next<ChevronRight size={16} /></button></nav>}
        </section>
        {selected && <RecordDetail key={selected} id={selected} onClose={() => setSelected(null)} onSelect={setSelected} onChange={() => setRefresh(n => n + 1)} />}
      </main>
    </div>
  </div>;
}

function RecordDetail({ id, onClose, onSelect, onChange }: { id: string; onClose: () => void; onSelect: (id: string) => void; onChange: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null), [content, setContent] = useState<Content | null>(null), [error, setError] = useState('');
  const [tab, setTab] = useState('details'), [busy, setBusy] = useState(false), [refresh, setRefresh] = useState(0), [note, setNote] = useState('');
  const [version, setVersion] = useState<{ text: string; provider: string } | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    Promise.all([api<Detail>(`/api/records/${id}`, { signal: abort.signal }), api<Content>(`/api/records/${id}/content`, { signal: abort.signal })])
      .then(([d, c]) => { setDetail(d); setContent(c); setError(''); }).catch(e => { if (!abort.signal.aborted) setError(e.message); });
    return () => abort.abort();
  }, [id, refresh]);
  useEffect(() => {
    if (!detail || !['pending', 'running'].includes(detail.record.extractionState)) return;
    const timer = window.setTimeout(() => setRefresh(n => n + 1), 4000); return () => clearTimeout(timer);
  }, [detail]);
  async function mutate(url: string, method: string, body?: unknown) {
    setBusy(true); setError('');
    try { await api(url, { method, ...(body ? { body: JSON.stringify(body) } : {}) }); setRefresh(n => n + 1); onChange(); return true; }
    catch (e) { setError((e as Error).message); return false; }
    finally { setBusy(false); }
  }
  const r = detail?.record;
  return <section className="records-detail" aria-label="Record details"><header className="records-detail-header"><button onClick={onClose}><ArrowLeft size={17} />Library</button>{r && <a className="records-button" href={`/api/records/${id}/original`} download><Download size={16} />Original</a>}</header>
    {error && <p className="records-error" role="alert">{error}<button onClick={() => setRefresh(n => n + 1)}>Reload</button></p>}
    {!r ? <p>Loading record…</p> : <><div className="records-detail-title"><span className="records-eyebrow">{r.status} · {size(r.size)}</span><h2>{r.title}</h2><p>{r.filename}</p></div>
      <nav className="records-tabs" aria-label="Record view">{['details', 'contents', 'connections', 'history'].map(t => <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>)}</nav>
      {tab === 'details' && <MetadataForm key={`${r.id}:${r.revision}`} record={r} busy={busy} save={body => mutate(`/api/records/${id}`, 'PATCH', body)} />}
      {tab === 'contents' && <div className="records-detail-body"><p className="records-caption">Text extraction: {r.extractionState}{content?.artifact ? ` · ${content.artifact.provider}` : ''}</p>
        {r.extractionError && <p className="records-caption">{r.extractionError}</p>}
        <button disabled={busy || ['running', 'pending'].includes(r.extractionState)} onClick={() => void mutate(`/api/records/${id}/retry`, 'POST')}>Read file again</button>
        {(r.mime === 'application/pdf' || ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(r.mime)) && <details className="records-preview"><summary>Preview original</summary>{r.mime === 'application/pdf' ? <iframe title="Original PDF" src={`/api/records/${id}/original?preview=1`} /> : <img alt={r.title} src={`/api/records/${id}/original?preview=1`} />}</details>}
        {content?.chunks.map(chunk => <article className="records-chunk" key={chunk.id}><small>{r.mime === 'application/pdf' ? 'Page' : 'Section'} {chunk.page} <span title={chunk.id}>· source {chunk.id.slice(-8)}</span></small><pre>{chunk.text}</pre></article>)}
        {!!content?.total && <div className="records-pagination"><button disabled={content.offset === 0} onClick={() => void api<Content>(`/api/records/${id}/content?offset=${Math.max(0, content.offset - 100)}`).then(setContent).catch(e => setError(e.message))}>Previous text</button><span>{content.offset + 1}–{Math.min(content.total, content.offset + 100)} / {content.total}</span><button disabled={content.offset + 100 >= content.total} onClick={() => void api<Content>(`/api/records/${id}/content?offset=${content.offset + 100}`).then(setContent).catch(e => setError(e.message))}>More text</button></div>}
        {!content?.chunks.length && <p>No extracted text yet. You can retrieve the original or add a transcription below.</p>}
        <h3>Content versions</h3><p className="records-caption">Originals, extracted text and agent work are kept separately.</p>
        {detail.artifacts.map(a => <button className="records-version" key={a.id} onClick={() => void api<{ text: string; provider: string }>(`/api/records/${id}/artifacts/${a.id}`).then(setVersion).catch(e => setError(e.message))}><span>{a.kind === 'legacy-digest' ? 'Legacy generated digest' : a.kind === 'extraction' ? 'Extracted text' : 'Note / agent work'}</span><small>{a.provider} · {new Date(a.createdAt).toLocaleDateString()}</small></button>)}
        {version && <div className="records-version-text"><button onClick={() => setVersion(null)}>Close version</button><pre>{version.text.slice(0, 200000)}</pre>{version.text.length > 200000 && <p>Preview limited to 200,000 characters. The full version is available through the agent API.</p>}</div>}
        <form onSubmit={async e => { e.preventDefault(); if (await mutate(`/api/records/${id}/content`, 'POST', { text: note, kind: 'note' })) setNote(''); }}><label>Add a note or derived content<textarea rows={5} value={note} onChange={e => setNote(e.target.value)} placeholder="A summary, transcription, translation, or other work on this document…" /></label><button disabled={busy || !note.trim()}><Plus size={16} />Save content version</button></form>
      </div>}
      {tab === 'connections' && <div className="records-detail-body"><h3>Connected records</h3>{!detail.links.length && <p className="records-caption">Connect a renewal, related document, attachment or supporting record.</p>}{detail.links.map(link => <div className="records-link" key={link.id}><button onClick={() => onSelect(link.sourceId === id ? link.targetId : link.sourceId)}><Link2 size={16} /><span>{link.sourceId === id ? link.targetTitle : link.sourceTitle}<small>{link.sourceId === id ? link.type : `Incoming: ${link.type}`}{link.note ? ` · ${link.note}` : ''}</small></span></button><button aria-label="Remove connection" disabled={busy} onClick={() => void mutate(`/api/links/${link.id}`, 'DELETE')}><X size={15} /></button></div>)}<ConnectForm id={id} busy={busy} connect={body => mutate('/api/links', 'POST', body)} /></div>}
      {tab === 'history' && <div className="records-detail-body"><h3>Source and integrity</h3><p className="records-caption">Record ID</p><code className="records-hash">{r.id}</code><p className="records-caption">Original SHA-256</p><code className="records-hash">{r.sha256}</code>{detail.sources.map(s => <p className="records-source-path" key={s.source}>{s.source}</p>)}<h3>Activity</h3>{detail.audit.map(a => <details className="records-audit" key={a.id}><summary>{a.action} · {a.actor}<small>{new Date(a.createdAt).toLocaleString()}</small></summary><pre>{JSON.stringify(JSON.parse(a.detail), null, 2)}</pre></details>)}</div>}
    </>}
  </section>;
}

function MetadataForm({ record: r, busy, save }: { record: RecordFile; busy: boolean; save: (body: unknown) => Promise<boolean> }) {
  const [draft, setDraft] = useState({ title: r.title, members: r.members.join(', '), tags: r.tags.join(', '), category: r.category, notes: r.notes, status: r.status, statusReason: r.statusReason, expiresOn: r.expiresOn });
  const [saved, setSaved] = useState(false);
  const field = (name: keyof typeof draft, value: string) => { setDraft(d => ({ ...d, [name]: value })); setSaved(false); };
  return <form className="records-detail-body records-metadata" onSubmit={async e => { e.preventDefault(); setSaved(await save({ ...draft, members: comma(draft.members), tags: comma(draft.tags), revision: r.revision })); }}>
    <label>Title<input required value={draft.title} onChange={e => field('title', e.target.value)} /></label>
    <div className="records-form-pair"><label>Family members<input placeholder="Names, separated by commas" value={draft.members} onChange={e => field('members', e.target.value)} /></label><label>Category<input placeholder="Insurance, home, health…" value={draft.category} onChange={e => field('category', e.target.value)} /></label></div>
    <label>Tags<input placeholder="Separate tags with commas" value={draft.tags} onChange={e => field('tags', e.target.value)} /></label>
    <div className="records-form-pair"><label>Status<select aria-label="Status" value={draft.status} onChange={e => { field('status', e.target.value); field('statusReason', ''); }}><option value="active">Active</option><option value="archived">Archived</option><option value="invalid">Invalid</option></select></label><label>Expiry date<input type="date" value={draft.expiresOn} onChange={e => field('expiresOn', e.target.value)} /></label></div>
    {(draft.status !== r.status || draft.statusReason) && <label>Reason for status<input required={draft.status !== r.status} value={draft.statusReason} onChange={e => field('statusReason', e.target.value)} placeholder="Renewed, expired, replaced, or no longer needed…" /></label>}
    <label>Notes<textarea rows={5} value={draft.notes} onChange={e => field('notes', e.target.value)} /></label>
    <p className="records-caption">Active records appear in search by default. Archived and invalid records remain available in their library views.</p>
    <button className="records-primary" disabled={busy}>{saved ? <><Check size={16} />Saved</> : 'Save changes'}</button>
  </form>;
}

function ConnectForm({ id, busy, connect }: { id: string; busy: boolean; connect: (body: unknown) => Promise<boolean> }) {
  const [query, setQuery] = useState(''), [matches, setMatches] = useState<RecordFile[]>([]), [target, setTarget] = useState(''), [type, setType] = useState('related'), [note, setNote] = useState(''), [error, setError] = useState('');
  useEffect(() => {
    const abort = new AbortController();
    const timer = window.setTimeout(() => api<{ records: RecordFile[] }>(`/api/records?status=all&limit=20&q=${encodeURIComponent(query)}`, { signal: abort.signal }).then(r => setMatches(r.records.filter(x => x.id !== id))).catch(e => { if (!abort.signal.aborted) setError(e.message); }), 250);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [query, id]);
  async function submit(e: FormEvent) { e.preventDefault(); if (await connect({ sourceId: id, targetId: target, type, note })) { setTarget(''); setNote(''); } }
  return <form className="records-connect" onSubmit={submit}><h3>Add a connection</h3>{error && <p role="alert">{error}</p>}<label>Find a record<input value={query} onChange={e => { setQuery(e.target.value); setTarget(''); }} placeholder="Search title or contents" /></label><label>Record<select aria-label="Record" required value={target} onChange={e => setTarget(e.target.value)}><option value="">Choose a record</option>{matches.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}</select></label><label>Relationship<select aria-label="Relationship" value={type} onChange={e => setType(e.target.value)}><option value="related">Related to</option><option value="supersedes">This record supersedes</option><option value="supports">This record supports</option><option value="attachment">Has attachment</option></select></label><label>Connection note<input value={note} onChange={e => setNote(e.target.value)} /></label>{type === 'supersedes' && <p className="records-caption">This adds a link. Change the older record’s status separately if needed.</p>}<button disabled={busy || !target}><Link2 size={16} />Connect records</button></form>;
}
