'use client'

import { useMemo, useState } from 'react'

type Row = {
  id: string
  source: string
  rowRef: string
  label: string
  description: string
  url: string
  issues: string[]
}

export default function HomePage() {
  const [rows, setRows] = useState<Row[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [fileName, setFileName] = useState('Aucun fichier')
  const [fileType, setFileType] = useState('')
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [blobBase64, setBlobBase64] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const selected = rows.find(r => r.id === selectedId) || null
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r => `${r.label} ${r.description} ${r.url}`.toLowerCase().includes(q))
  }, [rows, search])

  const onFile = async (file?: File | null) => {
    if (!file) return
    setBusy(true)
    setMessage('Analyse en cours…')
    const form = new FormData()
    form.append('file', file)
    const res = await fetch('/api/analyze', { method: 'POST', body: form })
    const data = await res.json()
    setBusy(false)
    if (!res.ok) {
      setMessage(data?.error || 'Erreur analyse')
      return
    }
    setRows(data.rows || [])
    setSelectedId(data.rows?.[0]?.id || null)
    setFileName(data.fileName)
    setFileType(data.fileType)
    setBlobBase64(data.fileBase64 || null)
    setMessage('Analyse terminée')
  }

  const updateSelected = (patch: Partial<Row>) => {
    setRows(prev => prev.map(r => r.id === selectedId ? { ...r, ...patch } : r))
  }

  const exportSame = async () => {
    if (!blobBase64 || !fileType) return
    setBusy(true)
    setMessage('Export en cours…')
    const res = await fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName, fileType, fileBase64: blobBase64, rows })
    })
    setBusy(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setMessage(data?.error || 'Erreur export')
      return
    }
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = fileName.replace(/\.(pdf|xlsx|xls|csv)$/i, '') + '_maj.' + fileType
    a.click()
    URL.revokeObjectURL(a.href)
    setMessage('Export terminé')
  }

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'postelink-analyse.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <main className="wrap">
      <div className="top card">
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          <img src="/logo.png" alt="Logo" style={{width:64,height:64,objectFit:'contain',borderRadius:18,background:'linear-gradient(145deg,#fff8d4,#fff)',padding:6}} onError={(e)=>{(e.currentTarget as HTMLImageElement).style.display='none'}} />
          <div>
            <h1 style={{margin:'0 0 4px 0',color:'var(--blue)'}}>PosteLink Studio</h1>
            <div className="muted">Analyse des liens PDF, Excel et CSV</div>
          </div>
        </div>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          <button className="btn btn-ghost" onClick={exportJson}>Exporter JSON</button>
          <button className="btn btn-primary" onClick={exportSame} disabled={busy || !rows.length}>Exporter fichier</button>
        </div>
      </div>

      <section className="card hero">
        <div>
          <span className="pill">Excel recommandé</span>
          <h2 style={{fontSize:'clamp(1.9rem,3vw,3rem)',lineHeight:'1.05',margin:'16px 0 12px 0',color:'var(--blue)',maxWidth:'18ch'}}>Importer, analyser, corriger, exporter.</h2>
          <p className="muted" style={{lineHeight:'1.65'}}>Le projet est prêt pour Vercel et Git. Les secrets restent côté serveur via variables d’environnement, et l’export garde le même format que l’import.</p>
          <div className="stats" style={{marginTop:20}}>
            <div className="stat"><span className="muted">Fichier</span><strong>{fileName}</strong></div>
            <div className="stat"><span className="muted">Lignes</span><strong>{rows.length}</strong></div>
            <div className="stat"><span className="muted">Problèmes</span><strong>{rows.reduce((n, r) => n + (r.issues?.length || 0), 0)}</strong></div>
          </div>
        </div>
        <div className="drop">
          <div style={{fontSize:42,color:'var(--blue)',fontWeight:900}}>⇪</div>
          <strong style={{display:'block',fontSize:'1.1rem', color:'var(--blue)'}}>Déposer un PDF, Excel ou CSV</strong>
          <div className="muted" style={{marginTop:6}}>ou cliquer pour sélectionner un fichier</div>
          <input type="file" accept=".pdf,.xlsx,.xls,.csv" className="field" style={{marginTop:16}} onChange={(e)=> onFile(e.target.files?.[0])} />
          {message && <div className="muted" style={{marginTop:10}}>{message}</div>}
        </div>
      </section>

      <section className="workspace grid" style={{gridTemplateColumns:'minmax(0,1.3fr) minmax(320px,420px)'}}>
        <div className="card side">
          <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',marginBottom:12,flexWrap:'wrap'}}>
            <div>
              <h3 style={{margin:'0 0 4px 0',color:'var(--blue)'}}>Données détectées</h3>
              <div className="muted">Filtrer et sélectionner une ligne</div>
            </div>
            <input className="field" style={{maxWidth:360}} placeholder="Rechercher un nom, une description ou une URL" value={search} onChange={(e)=>setSearch(e.target.value)} />
          </div>
          <div className="tableWrap">
            <table>
              <thead>
                <tr><th>#</th><th>Nom</th><th>Description</th><th>Origine</th><th>URL</th><th>Problèmes</th><th>Action</th></tr>
              </thead>
              <tbody>
                {!filtered.length ? (
                  <tr><td colSpan={7} style={{textAlign:'center',padding:28,color:'#706F6F'}}>Charge un fichier.</td></tr>
                ) : filtered.map((row, idx) => (
                  <tr key={row.id} style={selectedId === row.id ? {background:'rgba(0,61,165,.08)'} : {}}>
                    <td>{idx + 1}</td>
                    <td title={row.label}>{row.label}</td>
                    <td title={row.description}>{row.description}</td>
                    <td>{row.source}<br/><span className="muted" style={{fontSize:'.82rem'}}>{row.rowRef}</span></td>
                    <td title={row.url} style={{color:'var(--blue)'}}>{row.url}</td>
                    <td>{row.issues?.length ? row.issues.join(' · ') : 'RAS'}</td>
                    <td><button className="btn btn-ghost" style={{padding:'8px 10px'}} onClick={()=>setSelectedId(row.id)}>Éditer</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="card side">
          <h3 style={{margin:'0 0 4px 0',color:'var(--blue)'}}>Édition locale</h3>
          <div className="muted" style={{marginBottom:12}}>Nom, description et URL modifiables</div>
          <div className="stack">
            <label>Nom</label>
            <input className="field" value={selected?.label || ''} onChange={(e)=>updateSelected({ label: e.target.value })} />
            <label>Description</label>
            <textarea className="field" style={{minHeight:110}} value={selected?.description || ''} onChange={(e)=>updateSelected({ description: e.target.value })} />
            <label>Origine</label>
            <input className="field" disabled value={selected ? `${selected.source} • ${selected.rowRef}` : ''} />
            <label>URL</label>
            <textarea className="field" style={{minHeight:160}} value={selected?.url || ''} onChange={(e)=>updateSelected({ url: e.target.value })} />
            <button className="btn btn-primary" onClick={()=>setMessage('Modification prête à exporter')}>Appliquer</button>
          </div>
        </aside>
      </section>
    </main>
  )
}
