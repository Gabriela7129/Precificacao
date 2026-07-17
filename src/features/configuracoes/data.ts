/**
 * Dados da tela de Configurações.
 *
 * O contrato da Fatia 0 expõe `useSettings()` (lista, pois settings é uma
 * coleção) + `upsertSettings`/`createSettings`. Como settings é um doc único
 * por workspace, este módulo oferece o atalho tipado `useWorkspaceSettings`
 * e um `saveSettings` que atualiza ou cria o doc conforme necessário.
 */

import {
  createSettings,
  updateMarketplace,
  upsertSettings,
  useSettings,
} from '../../services/firestore'
import { DEFAULT_LIGHT_MAINTENANCE_RATE } from '../../lib/calculations'
import type { Marketplace, WithId, WorkspaceSettings } from '../../types'

export function useWorkspaceSettings(): {
  settings: WithId<WorkspaceSettings> | null
  loading: boolean
  error: Error | null
} {
  const { data, loading, error } = useSettings()
  return { settings: data[0] ?? null, loading, error }
}

/** Atualiza o doc de settings; cria um com defaults se ainda não existir. */
export async function saveSettings(
  wsId: string,
  settingsId: string | null,
  data: Partial<WorkspaceSettings>,
): Promise<void> {
  if (settingsId) {
    await upsertSettings(wsId, settingsId, data)
    return
  }
  await createSettings(wsId, {
    desiredSalary: 0,
    productiveHoursPerWeek: 0,
    hourlyOperational: 0,
    hourlyCreative: 0,
    electricityRate: null,
    lightMaintenanceRate: DEFAULT_LIGHT_MAINTENANCE_RATE,
    updatedAt: null,
    ...data,
  } as Omit<WorkspaceSettings, 'workspaceId'>)
}

/**
 * Garante um único marketplace "Padrão": ao marcar `defaultId` como padrão,
 * desmarca todos os outros.
 */
export async function ensureSingleDefaultMarketplace(
  wsId: string,
  marketplaces: WithId<Marketplace>[],
  defaultId: string,
): Promise<void> {
  await Promise.all(
    marketplaces
      .filter((m) => m.id !== defaultId && m.isDefault)
      .map((m) => updateMarketplace(wsId, m.id, { isDefault: false })),
  )
}
