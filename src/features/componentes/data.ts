/**
 * Camada de dados do módulo Componentes.
 *
 * Consome SOMENTE o contrato de `src/services/firestore.ts` (hooks tipados +
 * create/update tipados). O que o contrato não cobre — settings como doc
 * único e o recálculo ao vivo da composição — é implementado aqui.
 */

import {
  createComponent,
  updateComponent,
  useHeavyAssets,
  useSettings,
  useSupplies,
} from '../../services/firestore'
import { componentUnitCost } from '../../lib/calculations'
import type {
  ComponentSupplyLine,
  HeavyAsset,
  HumanProfile,
  SemiFinishedComponent,
  Supply,
  WithId,
  WorkspaceSettings,
} from '../../types'

// ---------------------------------------------------------------------------
// Hooks de apoio à composição
// ---------------------------------------------------------------------------

/**
 * Settings do workspace ativo. O contrato expõe `settings` como coleção
 * (`useSettings`); na prática há no máximo um doc por workspace.
 */
export function useWorkspaceSettings(): {
  settings: WithId<WorkspaceSettings> | null
  loading: boolean
} {
  const { data, loading } = useSettings()
  return { settings: data[0] ?? null, loading }
}

/** Dados de apoio da composição: insumos ativos, ativos pesados e settings. */
export function useComposicaoData(): {
  supplies: WithId<Supply>[]
  heavyAssets: WithId<HeavyAsset>[]
  settings: WithId<WorkspaceSettings> | null
  loading: boolean
} {
  const suppliesState = useSupplies()
  const assetsState = useHeavyAssets()
  const { settings, loading: settingsLoading } = useWorkspaceSettings()
  return {
    supplies: suppliesState.data.filter((s) => s.isActive),
    heavyAssets: assetsState.data,
    settings,
    loading: suppliesState.loading || assetsState.loading || settingsLoading,
  }
}

// ---------------------------------------------------------------------------
// Recálculo da composição (UI em minutos, cálculo em horas)
// ---------------------------------------------------------------------------

export interface ComposicaoCustoInput {
  /** Linhas em edição (sem snapshot — o custo médio atual é aplicado aqui). */
  supplies: { supplyId: string; quantity: number }[]
  /** `null`/vazio = sem tempo de máquina. */
  machineAssetId: string | null
  machineTimeMinutes: number
  humanProfile: HumanProfile
  humanTimeMinutes: number
}

export interface ComposicaoCusto {
  /** Linhas prontas para persistir, com `unitCostSnapshot` do momento. */
  lines: ComponentSupplyLine[]
  suppliesCost: number
  machineCost: number
  humanCost: number
  unitCost: number
  machineTimeHours: number
  humanTimeHours: number
}

/**
 * Recalcula o custo da composição com os custos ATUAIS de insumos, ativo e
 * valor hora das settings. Toda a matemática passa por `calculations.ts`;
 * aqui só resolvemos as referências (insumo → custo médio, ativo →
 * custo/hora, perfil → valor hora) e convertemos minutos → horas.
 */
export function calcularCustoComposicao(
  input: ComposicaoCustoInput,
  supplies: WithId<Supply>[],
  heavyAssets: WithId<HeavyAsset>[],
  settings: WithId<WorkspaceSettings> | null,
): ComposicaoCusto {
  const machineTimeHours = input.machineTimeMinutes / 60
  const humanTimeHours = input.humanTimeMinutes / 60

  const asset = input.machineAssetId
    ? heavyAssets.find((a) => a.id === input.machineAssetId)
    : undefined
  const machineCostPerHour = asset?.totalCostPerHour ?? 0

  const humanHourlyRate =
    input.humanProfile === 'creative'
      ? (settings?.hourlyCreative ?? 0)
      : (settings?.hourlyOperational ?? 0)

  // Snapshot do custo médio de cada insumo neste momento.
  const lines: ComponentSupplyLine[] = input.supplies
    .filter((l) => l.supplyId !== '')
    .map((l) => ({
      supplyId: l.supplyId,
      quantity: l.quantity,
      unitCostSnapshot: supplies.find((s) => s.id === l.supplyId)?.averageCost ?? 0,
    }))

  const suppliesCost = lines.reduce((sum, l) => sum + l.quantity * l.unitCostSnapshot, 0)
  const machineCost = machineTimeHours * machineCostPerHour
  const humanCost = humanTimeHours * humanHourlyRate

  const unitCost = componentUnitCost({
    supplies: lines,
    machineTimeHours,
    machineCostPerHour,
    humanTimeHours,
    humanHourlyRate,
  })

  return { lines, suppliesCost, machineCost, humanCost, unitCost, machineTimeHours, humanTimeHours }
}

// ---------------------------------------------------------------------------
// Reavaliação (integridade histórica): arquiva a versão atual e cria a próxima
// ---------------------------------------------------------------------------

/**
 * Marca o documento atual como `isArchived: true` e cria uma NOVA versão
 * (`version + 1`) com a mesma composição, mas com snapshots e custo unitário
 * recalculados com os custos de hoje. Retorna o id da nova versão.
 */
export async function reavaliarComponente(
  wsId: string,
  atual: WithId<SemiFinishedComponent>,
  supplies: WithId<Supply>[],
  heavyAssets: WithId<HeavyAsset>[],
  settings: WithId<WorkspaceSettings> | null,
): Promise<string> {
  const custo = calcularCustoComposicao(
    {
      supplies: atual.supplies.map((l) => ({ supplyId: l.supplyId, quantity: l.quantity })),
      machineAssetId: atual.machineAssetId,
      machineTimeMinutes: atual.machineTimeHours * 60,
      humanProfile: atual.humanProfile,
      humanTimeMinutes: atual.humanTimeHours * 60,
    },
    supplies,
    heavyAssets,
    settings,
  )

  await updateComponent(wsId, atual.id, { isArchived: true })
  return createComponent(wsId, {
    name: atual.name,
    supplies: custo.lines,
    machineTimeHours: custo.machineTimeHours,
    machineAssetId: atual.machineAssetId,
    humanTimeHours: custo.humanTimeHours,
    humanProfile: atual.humanProfile,
    unitCost: custo.unitCost,
    version: atual.version + 1,
    isArchived: false,
  })
}
