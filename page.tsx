'use client'

import { useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs'

type Row = {
  id: string
  source: string
  rowRef: string
  label: string
  description: string
  url: string
  issues: string[]
}

function analyzeRows(rows: Row[]) {
  const urlCount = new Map<string, number>()
  const labelCount = new Map<string, number>()
  rows.forEach((row) => {
    const url = row.url.trim()
    const label = row.label.trim().toLowerCase()
    if (url) urlCount.set(url, (urlCount.get(url) || 0) + 1)
    if (label) labelCount.set(label, (labelCount.get(label) || 0) + 1)
  })
  return rows.map((row) => {
    const issues: string[] = []
    const label = row.label.trim()
    const url = row.url.trim()
    if (!label) issues.push('Nom manquant')
    if (!url) issues.push('Lien manquant')
    if (url && !/^https?:\/\//i.test(url)) {
      if (/^(file:\/\/|[A-Za-z]:\|[A-Za-z]:\/|\\)/.test(url)) issues.push('Chemin local détecté')
      else issues.push('Format URL suspect')
    }
    if (url && (urlCount.get(url) || 0) > 1) issues.push('URL en doublon')
    if (label && (labelCount.get(label.toLowerCase()) || 0) > 1) issues.push('Nom en doublon')
    return { ...row, issues }
  })
}

async function parsePdf(file: File): Promise<Row[]> {
  const buf = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise
  const rows: Row[] = []
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const annotations = await page.getAnnotations()
    const links = annotations.filter((a: any) => a.url)
    links.forEach((a: any, i: number) => {
      rows.push({
        id: `p${p}-${i+1}`,
        source: `Page ${p}`,
        rowRef: `Lien ${i+1}`,
        label: `Lien ${i+1}`,
        description: '',
        url: a.url || '',
        issues: []
      })
    })
  }
  return analyzeRows(rows)
}

async function parseWorkbook(file: File): Promise<Row[]> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const rows: Row[] = []
  wb.SheetNames.forEach((sheetName) => {
    const sheet = wb.Sheets[sheetName]
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][]
    if (!matrix.length) return
    const headers = matrix[0].map(v => String(v).trim().toLowerCase())
    const findCol = (names: string[]) => names.map(n => headers.findIndex(h => h.includes(n))).find(i => i >= 0) ?? -1
    const labelCol = findCol(['nom','label','titre']) >= 0 ? findCol(['nom','label','titre']) : 0
    const descCol = findCol(['description','desc'])
    const urlCol = findCol(['url','lien','liens','lien complet','liens complets'])
    for (let r = 1; r < matrix.length; r++) {
      const line = matrix[r]
      let label = String(line[labelCol] ?? '')
      let description = descCol >= 0 ? String(line[descCol] ?? '') : ''
      let url = urlCol >= 0 ? String(line[urlCol] ?? '') : ''
      const labelRef = XLSX.utils.encode_cell({ r, c: labelCol })
      const urlRef = urlCol >= 0 ? XLSX.utils.encode_cell({ r, c: urlCol }) : null
      const labelCell = sheet[labelRef]
      const urlCell = urlRef ? sheet[urlRef] : null
      if (!url && urlCell?.l?.Target) url = urlCell.l.Target
      if (!url && labelCell?.l?.Target) url = labelCell.l.Target
      if (!label && !description && !url) continue
      rows.push({
        id: `${sheetName}-${r}`,
        source: sheetName,
        rowRef: `Ligne ${r+1}`,
        label, description, url, issues: []
      })
    }
  })
  return analyzeRows(rows)
}

export default function HomePage() {
  const [rows, setRows] = useState<Row[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [fileName, setFileName] = useState('Aucun fichier')
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r => `${r.label} ${r.description} ${r.url}`.toLowerCase().includes(q))
  }, [rows, search])

  const selected = rows.find(r => r.id === selectedId) || null

  const onFile = async (file?: File | null) => {
    if (!file) return
    setMessage('Analyse en cours…')
    setFileName(file.name)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || ''
      const parsed = ext === 'pdf' ? await parsePdf(file) : await parseWorkbook(file)
      setRows(parsed)
      setSelectedId(parsed[0]?.id || null)
      setMessage('Analyse terminée')
    } catch (e) {
      setMessage('Erreur de lecture du fichier')
    }
  }

  const updateSelected = (patch: Partial<Row>) => {
    setRows(prev => prev.map(r => r.id === selectedId ? { ...r, ...patch } : r))
  }

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'posteliens-analyse.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <main className="wrap">
      <div className="top card">
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          <img src="/logo.png" alt="Logo" style={{width:64,height:64,objectFit:'contain',borderRadius:18,background:'linear-gradient(145deg,#fff8d4,#fff)',padding:6}} onError={(e)=>{(e.currentTarget as HTMLImageElement).style.display='none'}} />
          <div>
            <h1 style={{margin:'0 0 4px 0',color:'var(--blue)'}}>PosteLiens</h1>
            <div className="muted">Analyse locale de liens PDF, Excel et CSV</div>
          </div>
        </div>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          <button className="btn btn-ghost" onClick={exportJson} disabled={!rows.length}>Exporter JSON</button>
        </div>
      </div>

      <section className="card hero">
        <div>
          <span className="pill">Excel recommandé</span>
          <h2 style={{fontSize:'clamp(1.9rem,3vw,3rem)',lineHeight:'1.05',margin:'16px 0 12px 0',color:'var(--blue)',maxWidth:'18ch'}}>Importer, analyser et corriger.</h2>
          <p className="muted" style={{lineHeight:'1.65'}}>Version propre pour Vercel. Responsive, légère et stable. Si Vercel affichait 404 auparavant, la cause la plus probable était la structure du dépôt ou le mauvais dossier racine.</p>
          <div className="stats">
            <div className="stat"><span className="muted">Fichier</span><strong>{fileName}</strong></div>
            <div className="stat"><span className="muted">Lignes</span><strong>{rows.length}</strong></div>
            <div className="stat"><span className="muted">Problèmes</span><strong>{rows.reduce((n, r) => n + r.issues.length, 0)}</strong></div>
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

      <section className="workspace">
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
                    <td>{row.label}</td>
                    <td>{row.description}</td>
                    <td>{row.source}<br/><span className="muted" style={{fontSize:'.82rem'}}>{row.rowRef}</span></td>
                    <td style={{color:'var(--blue)'}}>{row.url}</td>
                    <td>{row.issues.length ? row.issues.join(' · ') : 'RAS'}</td>
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
          </div>
        </aside>
      </section>
    </main>
  )
}
