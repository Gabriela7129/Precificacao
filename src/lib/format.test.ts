/**
 * Testes de formatação pt-BR — `src/lib/format.ts`.
 * Inclui caracterização do desvio M3 (parse de decimal com ponto).
 */
import { describe, expect, it } from 'vitest'
import { formatBRL, formatDate, formatMinutes, formatNumber, formatPercent, parseBRLInput } from './format'

describe('formatBRL', () => {
  // O Intl separa "R$" do número com espaço não quebrável (U+00A0/U+202F,
  // varia por runtime) — normaliza para espaço comum antes de comparar.
  const brl = (v: number) => formatBRL(v).replace(/[\u00a0\u202f]/g, ' ')

  it('formata em pt-BR com símbolo R$', () => {
    expect(brl(4500)).toBe('R$ 4.500,00')
    expect(brl(0)).toBe('R$ 0,00')
    expect(brl(1234.5)).toBe('R$ 1.234,50')
  })
})

describe('formatNumber', () => {
  it('formata com separadores pt-BR e unidade opcional', () => {
    expect(formatNumber(250, { unit: 'folhas' })).toBe('250 folhas')
    expect(formatNumber(1234.567)).toBe('1.234,57') // máx. 2 casas
  })
})

describe('formatPercent', () => {
  it('recebe o número como armazenado (40 = 40%)', () => {
    expect(formatPercent(40)).toBe('40%')
    expect(formatPercent(7.5)).toBe('7,5%')
  })
})

describe('formatDate', () => {
  it('converte "yyyy-mm-dd" para dd/mm/aaaa sem shift de fuso', () => {
    expect(formatDate('2026-09-11')).toBe('11/09/2026')
  })
  it('aceita string ISO completa (usa a data local do fuso)', () => {
    expect(formatDate('2026-09-11T15:00:00')).toBe('11/09/2026')
  })
  it('retorna — para vazio', () => {
    expect(formatDate(null)).toBe('—')
    expect(formatDate(undefined)).toBe('—')
    expect(formatDate('')).toBe('—')
  })
  it('aceita timestamp do Firestore ({ toDate })', () => {
    const ts = { toDate: () => new Date(2026, 8, 11) }
    expect(formatDate(ts)).toBe('11/09/2026')
  })
})

describe('formatMinutes', () => {
  it('< 60 mostra "N min"', () => {
    expect(formatMinutes(45)).toBe('45 min')
  })
  it('múltiplos de 60 mostram "Nh"', () => {
    expect(formatMinutes(120)).toBe('2h')
  })
  it('composto mostra "NhMM"', () => {
    expect(formatMinutes(90)).toBe('1h30')
  })
})

describe('parseBRLInput', () => {
  it('aceita formatos pt-BR', () => {
    expect(parseBRLInput('4500')).toBe(4500)
    expect(parseBRLInput('4.500')).toBe(4500)
    expect(parseBRLInput('4.500,00')).toBe(4500)
    expect(parseBRLInput('4500,5')).toBe(4500.5)
    expect(parseBRLInput('R$ 1.234,56')).toBe(1234.56)
  })
  it('vazio/inválido retorna null', () => {
    expect(parseBRLInput('')).toBeNull()
    expect(parseBRLInput('   ')).toBeNull()
    expect(parseBRLInput('abc')).toBeNull()
  })

  // AUDITORIA M3: ponto é SEMPRE tratado como separador de milhar.
  // "1.5" → 15 (erro de 10× para quem pensa em decimal com ponto).
  it('[M3 caracterização] decimal com ponto é multiplicado por 10', () => {
    expect(parseBRLInput('1.5')).toBe(15)
    expect(parseBRLInput('0.5')).toBe(5)
  })
})
