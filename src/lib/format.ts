/**
 * Formatação centralizada (pt-BR). Nunca formatar moeda/data fora daqui.
 */

const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

/** R$ 4.500,00 */
export function formatBRL(value: number): string {
  return brlFormatter.format(value)
}

/** "250 folhas" — número localizado + unidade opcional. */
export function formatNumber(value: number, options?: { unit?: string }): string {
  const formatted = value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
  return options?.unit ? `${formatted} ${options.unit}` : formatted
}

/** "40%" — recebe o número como armazenado (40, não 0,4). */
export function formatPercent(value: number): string {
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
}

const dateFormatter = new Intl.DateTimeFormat('pt-BR')

/**
 * dd/mm/aaaa. Aceita Date, string ISO ("yyyy-mm-dd" ou completa) ou
 * timestamp Firestore ({ toDate() }).
 */
export function formatDate(date: Date | string | { toDate: () => Date } | null | undefined): string {
  if (!date) return '—'
  if (typeof date === 'string') {
    // "yyyy-mm-dd" é interpretado como UTC; normaliza para data local.
    const [ymd] = date.split('T')
    const [y, m, d] = ymd.split('-').map(Number)
    if (y && m && d) return dateFormatter.format(new Date(y, m - 1, d))
    return dateFormatter.format(new Date(date))
  }
  if (date instanceof Date) return dateFormatter.format(date)
  return dateFormatter.format(date.toDate())
}

/** "20 min" / "1h30" */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

/**
 * Parse tolerante de entrada monetária pt-BR:
 * aceita "4500", "4.500", "4.500,00", "4500,5". Retorna `null` se vazio/inválido.
 */
export function parseBRLInput(text: string): number | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  const normalized = trimmed.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.')
  const value = Number(normalized)
  return Number.isFinite(value) ? value : null
}
