/**
 * Normalização de texto para busca: ignora acentos/diacríticos e maiúsculas.
 * Ex.: buscar "regua" encontra "Régua"; "caderno a5" encontra "Caderno A5".
 */
export function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

/** O termo digitado está contido no texto (ambos normalizados)? Termo vazio = sempre true. */
export function matchesSearch(text: string, term: string): boolean {
  const q = normalizeSearch(term.trim())
  return !q || normalizeSearch(text).includes(q)
}
