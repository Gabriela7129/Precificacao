/**
 * Dados locais do módulo Materiais Leves & Ativos Pesados.
 * Consome o contrato de `src/services/firestore.ts` (sem editá-lo).
 */

import { useSettings } from '../../services/firestore'
import type { WithId, WorkspaceSettings } from '../../types'

export interface WorkspaceSettingsState {
  /** Doc único de settings do workspace ativo (null enquanto não existir). */
  settings: WithId<WorkspaceSettings> | null
  loading: boolean
  error: Error | null
}

/**
 * Settings do workspace ativo. A coleção `settings` tem um doc por workspace
 * (seed da criação do workspace) — este hook devolve o primeiro doc.
 */
export function useWorkspaceSettings(): WorkspaceSettingsState {
  const { data, loading, error } = useSettings()
  return { settings: data[0] ?? null, loading, error }
}

/** Data de hoje como "yyyy-mm-dd" (fuso local) — default de formulários. */
export function todayYMD(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Converte valores de formulário possivelmente vazios/NaN em número seguro. */
export function safeNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}
