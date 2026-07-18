import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

export interface WorksheetColumn<T> {
  header: string
  key: keyof T | string
  width?: number
  parse?: (value: unknown) => unknown
  format?: (value: unknown) => string | number | boolean | null | undefined
}

export function downloadExcel<T extends object>(
  filename: string,
  sheetName: string,
  rows: T[],
  columns: WorksheetColumn<T>[],
): void {
  const data = rows.map((row) =>
    Object.fromEntries(
      columns.map((col) => {
        const raw = (row as Record<string, unknown>)[col.key as string]
        const value = col.format ? col.format(raw) : raw
        return [col.header, value ?? '']
      }),
    ),
  )

  const ws = XLSX.utils.json_to_sheet(data)
  ws['!cols'] = columns.map((col) => ({ wch: col.width ?? 20 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  const blob = new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  saveAs(blob, filename)
}

export async function parseExcelFile<T extends object>(
  file: File,
  columns: WorksheetColumn<T>[],
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const json = XLSX.utils.sheet_to_json(sheet, { header: columns.map((c) => c.header) }) as Record<
          string,
          unknown
        >[]
        // Remove a primeira linha quando o cabeçalho coincide com os dados (XLSX inclui header como linha 0).
        const hasHeader = json.length > 0 && columns.every((c) => json[0][c.header] === c.header)
        const rows = (hasHeader ? json.slice(1) : json).map((row) =>
          Object.fromEntries(
            columns.map((col) => {
              const raw = row[col.header]
              const value = col.parse ? col.parse(raw) : raw
              return [col.key as string, value]
            }),
          ),
        ) as T[]
        resolve(rows)
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    }
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'))
    reader.readAsArrayBuffer(file)
  })
}

export function parseCurrency(value: unknown): number {
  if (typeof value === 'number') return value
  if (value == null || value === '') return 0
  const text = String(value).trim()
  if (!text) return 0
  // Aceita "149,23", "R$ 149,23", "149.23", "149.230,50"
  const normalized = text
    .replace(/R\$/g, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
  const n = Number(normalized)
  return Number.isFinite(n) ? n : 0
}

export function parseNumber(value: unknown): number {
  if (typeof value === 'number') return value
  if (value == null || value === '') return 0
  const n = Number(String(value).replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

export function parseDate(value: unknown): string {
  if (value == null || value === '') return ''
  const text = String(value).trim()
  // Tenta detectar datas Excel serializadas (número) e converter.
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value)
    if (date) return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`
  }
  // Formato brasileiro dd/mm/yyyy
  const brMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (brMatch) {
    return `${brMatch[3]}-${String(brMatch[2]).padStart(2, '0')}-${String(brMatch[1]).padStart(2, '0')}`
  }
  // Já está em yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text
  return ''
}

export function formatDateBR(value: unknown): string {
  if (!value || value === '') return ''
  const text = String(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [y, m, d] = text.split('-')
    return `${d}/${m}/${y}`
  }
  return text
}

export function formatCurrency(value: unknown): number | string {
  if (typeof value === 'number') return value
  return value == null ? '' : String(value)
}
