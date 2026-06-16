import { NextResponse } from 'next/server'
import { buildRowsFromWorkbook, buildRowsFromPdf } from '@/lib/analysis'

export const runtime = 'nodejs'

function toBase64(buffer: ArrayBuffer) {
  return Buffer.from(buffer).toString('base64')
}

export async function POST(request: Request) {
  const form = await request.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Aucun fichier reçu.' }, { status: 400 })
  const name = file.name
  const ext = name.split('.').pop()?.toLowerCase() || ''
  const arrayBuffer = await file.arrayBuffer()

  if (['xlsx', 'xls', 'csv'].includes(ext)) {
    const { rows } = buildRowsFromWorkbook(arrayBuffer)
    return NextResponse.json({ fileName: name, fileType: ext, rows, fileBase64: toBase64(arrayBuffer) })
  }

  if (ext === 'pdf') {
    const { rows } = await buildRowsFromPdf(arrayBuffer)
    return NextResponse.json({ fileName: name, fileType: ext, rows, fileBase64: toBase64(arrayBuffer) })
  }

  return NextResponse.json({ error: 'Format non pris en charge.' }, { status: 400 })
}
