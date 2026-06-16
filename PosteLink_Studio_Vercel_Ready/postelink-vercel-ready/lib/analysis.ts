import * as XLSX from 'xlsx'
import { PDFDocument, PDFName, PDFString, PDFArray } from 'pdf-lib'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf'

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs'

export type Row = {
  id: string
  source: string
  rowRef: string
  label: string
  description: string
  url: string
  issues: string[]
  meta?: Record<string, any>
}

export function analyzeIssues(rows: Row[]): Row[] {
  const urlCount = new Map<string, number>()
  const labelCount = new Map<string, number>()
  rows.forEach((row) => {
    const url = (row.url || '').trim()
    const label = (row.label || '').trim().toLowerCase()
    if (url) urlCount.set(url, (urlCount.get(url) || 0) + 1)
    if (label) labelCount.set(label, (labelCount.get(label) || 0) + 1)
  })
  return rows.map((row) => {
    const issues: string[] = []
    const url = (row.url || '').trim()
    const label = (row.label || '').trim()
    if (!label) issues.push('Nom manquant')
    if (!url) issues.push('Lien manquant')
    if (url && !/^https?:\/\//i.test(url)) {
      if (/^(file:\/\/|[A-Za-z]:\\|[A-Za-z]:\/|\\\\)/.test(url)) issues.push('Chemin local détecté')
      else issues.push('Format URL suspect')
    }
    if (url && (urlCount.get(url) || 0) > 1) issues.push('URL en doublon')
    if (label && (labelCount.get(label.toLowerCase()) || 0) > 1) issues.push('Nom en doublon')
    return { ...row, issues }
  })
}

export function buildRowsFromWorkbook(buffer: ArrayBuffer) {
  const workbook = XLSX.read(buffer, { type: 'array', cellStyles: true, cellFormula: true })
  const rows: Row[] = []
  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName]
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][]
    if (!matrix.length) return
    const headers = matrix[0].map(v => String(v).trim().toLowerCase())
    const findCol = (names: string[]) => names.map(n => headers.findIndex(h => h.includes(n))).find(i => i >= 0) ?? -1
    const labelCol = findCol(['nom', 'label', 'titre']) >= 0 ? findCol(['nom', 'label', 'titre']) : 0
    const descCol = findCol(['description', 'desc'])
    const urlCol = findCol(['url', 'lien', 'liens', 'lien complet', 'liens complets'])
    for (let r = 1; r < matrix.length; r++) {
      const row = matrix[r]
      let label = row[labelCol] ?? ''
      let description = descCol >= 0 ? row[descCol] ?? '' : ''
      let url = urlCol >= 0 ? row[urlCol] ?? '' : ''
      const labelRef = XLSX.utils.encode_cell({ r, c: labelCol })
      const urlRef = urlCol >= 0 ? XLSX.utils.encode_cell({ r, c: urlCol }) : null
      const descRef = descCol >= 0 ? XLSX.utils.encode_cell({ r, c: descCol }) : null
      const labelCell = sheet[labelRef]
      const urlCell = urlRef ? sheet[urlRef] : null
      if (!url && urlCell?.l?.Target) url = urlCell.l.Target
      if (!url && labelCell?.l?.Target) url = labelCell.l.Target
      if (!label && !description && !url) continue
      rows.push({
        id: `${sheetName}-${r}`,
        source: sheetName,
        rowRef: `Ligne ${r + 1}`,
        label: String(label || ''),
        description: String(description || ''),
        url: String(url || ''),
        issues: [],
        meta: { type: 'excel', sheetName, rowIndex: r, labelCol, descCol, urlCol, labelRef, descRef, urlRef }
      })
    }
  })
  return { workbook, rows: analyzeIssues(rows) }
}

function groupTextLines(items: any[]) {
  const prepared = items.filter(it => String(it.str || '').trim()).map(it => ({ text: String(it.str || '').trim(), x: it.transform[4], y: it.transform[5] }))
  prepared.sort((a, b) => Math.abs(b.y - a.y) < 2 ? a.x - b.x : b.y - a.y)
  const groups: any[] = []
  for (const item of prepared) {
    let g = groups.find(line => Math.abs(line.y - item.y) < 2.5)
    if (!g) { g = { y: item.y, parts: [] }; groups.push(g) }
    g.parts.push(item)
  }
  groups.forEach(g => g.parts.sort((a: any, b: any) => a.x - b.x))
  return groups.map(g => g.parts.map((p: any) => p.text).join(' ').replace(/\s+/g, ' ').trim())
}

export async function buildRowsFromPdf(buffer: ArrayBuffer) {
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  const rows: Row[] = []
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const textContent = await page.getTextContent()
    const annotations = await page.getAnnotations()
    const lines = groupTextLines(textContent.items || [])
    let started = false
    const cleaned: string[] = []
    for (const line of lines) {
      if (line === 'Description') { started = true; continue }
      if (!started) continue
      if (/^C1\s*-\s*Interne/i.test(line) || /^Page\s+\d+/i.test(line) || /^\d{2}\/\d{2}\/\d{4}$/.test(line)) break
      if (['Nom','Infos pratiques :','DRH-G DDIEC · Pôle Handicap'].includes(line)) continue
      cleaned.push(line)
    }
    const annots = annotations.filter((a: any) => a.url)
    for (let i = 0; i < cleaned.length; i += 2) {
      const idx = Math.floor(i / 2)
      const label = cleaned[i] || ''
      const description = cleaned[i + 1] || ''
      if (!label && !description) continue
      rows.push({
        id: `p${p}-${idx + 1}`,
        source: `Page ${p}`,
        rowRef: `Lien ${idx + 1}`,
        label,
        description,
        url: annots[idx]?.url || '',
        issues: [],
        meta: { type: 'pdf', pageIndex: p - 1, annotIndex: idx }
      })
    }
  }
  return { rows: analyzeIssues(rows) }
}

export function exportWorkbookSameFormat(workbook: any, rows: Row[], ext: string) {
  for (const row of rows) {
    const meta = row.meta
    if (!meta || meta.type !== 'excel') continue
    const sheet = workbook.Sheets[meta.sheetName]
    if (!sheet) continue
    if (meta.labelRef) {
      sheet[meta.labelRef] = sheet[meta.labelRef] || { t: 's', v: '' }
      sheet[meta.labelRef].v = row.label || ''
      sheet[meta.labelRef].w = row.label || ''
    }
    if (meta.descRef) {
      sheet[meta.descRef] = sheet[meta.descRef] || { t: 's', v: '' }
      sheet[meta.descRef].v = row.description || ''
      sheet[meta.descRef].w = row.description || ''
    }
    const targetRef = meta.urlRef || meta.labelRef
    if (targetRef) {
      sheet[targetRef] = sheet[targetRef] || { t: 's', v: '' }
      if (meta.urlRef) {
        sheet[targetRef].v = row.url || ''
        sheet[targetRef].w = row.url || ''
      }
      if (row.url) sheet[targetRef].l = { Target: row.url }
      else delete sheet[targetRef].l
    }
  }
  const outType = ext === 'csv' ? 'csv' : (ext === 'xls' ? 'biff8' : 'xlsx')
  return XLSX.write(workbook, { type: 'buffer', bookType: outType })
}

export async function exportPdfSameFormat(buffer: ArrayBuffer, rows: Row[]) {
  const pdfDoc = await PDFDocument.load(buffer)
  const pages = pdfDoc.getPages()
  for (const row of rows) {
    const meta = row.meta
    if (!meta || meta.type !== 'pdf') continue
    const page = pages[meta.pageIndex]
    if (!page) continue
    const annots = page.node.lookup(PDFName.of('Annots'), PDFArray)
    if (!annots) continue
    const ref = annots.get(meta.annotIndex)
    if (!ref) continue
    const annot = pdfDoc.context.lookup(ref)
    if (!annot) continue
    let action: any = null
    try { action = annot.lookup(PDFName.of('A')) } catch { action = null }
    if (action) action.set(PDFName.of('URI'), PDFString.of(row.url || ''))
  }
  return Buffer.from(await pdfDoc.save())
}
