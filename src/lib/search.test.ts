import { describe, expect, it } from 'vitest'
import { matchesSearch, normalizeSearch } from './search'

describe('normalizeSearch', () => {
  it('remove acentos e passa para minúsculas', () => {
    expect(normalizeSearch('Régua')).toBe('regua')
    expect(normalizeSearch('Fita de Cetim Nº5')).toBe('fita de cetim nº5')
    expect(normalizeSearch('Botões')).toBe('botoes')
    expect(normalizeSearch('Canetão')).toBe('canetao')
  })
})

describe('matchesSearch', () => {
  it('encontra com ou sem acento nos dois lados', () => {
    expect(matchesSearch('Régua', 'regua')).toBe(true)
    expect(matchesSearch('Regua', 'régua')).toBe(true)
    expect(matchesSearch('Régua', 'RÉGUA')).toBe(true)
  })

  it('termo vazio casa com tudo', () => {
    expect(matchesSearch('Qualquer coisa', '')).toBe(true)
    expect(matchesSearch('Qualquer coisa', '   ')).toBe(true)
  })

  it('não casa quando não contém', () => {
    expect(matchesSearch('Régua', 'tesoura')).toBe(false)
    expect(matchesSearch('Caderno A5', 'caderno b5')).toBe(false)
  })

  it('casa parte do nome (substring)', () => {
    expect(matchesSearch('Caderno A5 Brochura v2', 'brochura')).toBe(true)
    expect(matchesSearch('Fita de Cetim Rosa 25mm', 'cetim rosa')).toBe(true)
  })
})
