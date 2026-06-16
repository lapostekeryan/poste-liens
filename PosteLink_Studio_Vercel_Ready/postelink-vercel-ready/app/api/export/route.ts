import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { exportWorkbookSameFormat, exportPdfSameFormat } from '@/lib/analysis'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const body = await request.json()
  const { fileName, fileType, fileBase64, rows } = body || {}
  if (!fileType || !fileBase64 || !rows) {
    return NextResponse.json({ error: 'Données insuffisantes pour exporter.' }, { status: 400 })
  }

  const buffer = Buffer.from(fileBase64, 'base64')

  if (fileType === 'pdf') {
    const out = await exportPdfSameFormat(buffer, rows)
    return new NextResponse(out, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${(fileName || 'document').replace(/\.pdf$/i, '')}_maj.pdf"`
      }
    })
  }

  if (['xlsx', 'xls', 'csv'].includes(fileType)) {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellStyles: true, cellFormula: true })
    const out = exportWorkbookSameFormat(workbook, rows, fileType)
    const contentType = fileType === 'csv'
      ? 'text/csv;charset=utf-8'
      : fileType === 'xls'
      ? 'application/vnd.ms-excel'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    return new NextResponse(out, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${(fileName || 'document').replace(/\.(xlsx|xls|csv)$/i, '')}_maj.${fileType}"`
      }
    })
  }

  return NextResponse.json({ error: 'Format non pris en charge.' }, { status: 400 })
}
