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
  useLightTools,
  useSettings,
  useSupplies,
} from '../../services/firestore'
import { componentUnitCost } from '../../lib/calculations'
import type {
  ComponentLightToolLine,
  ComponentMachineLine,
  ComponentSupplyLine,
  HeavyAsset,
  HumanProfile,
  LightTool,
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
  lightTools: WithId<LightTool>[]
  settings: WithId<WorkspaceSettings> | null
  loading: boolean
} {
  const suppliesState = useSupplies()
  const assetsState = useHeavyAssets()
  const lightToolsState = useLightTools()
  const { settings, loading: settingsLoading } = useWorkspaceSettings()
  return {
    supplies: suppliesState.data.filter((s) => s.isActive),
    heavyAssets: assetsState.data,
    lightTools: lightToolsState.data.filter((t) => t.isActive),
    settings,
    loading: suppliesState.loading || assetsState.loading || lightToolsState.loading || settingsLoading,
  }
}

// ---------------------------------------------------------------------------
// Recálculo da composição (UI em minutos, cálculo em horas)
// ---------------------------------------------------------------------------

export interface ComposicaoCustoInput {
  /** Linhas em edição (sem snapshot — o custo médio atual é aplicado aqui). */
  supplies: { supplyId: string; quantity: number }[]
  /** Lista de ativos pesados + tempo em minutos. */
  machineAssets: { assetId: string; timeMinutes: number }[]
  /** Lista de materiais leves + tempo em minutos. */
  lightTools: { toolId: string; timeMinutes: number }[]
  humanProfile: HumanProfile
  humanTimeMinutes: number
}

export interface ComposicaoCusto {
  /** Linhas prontas para persistir, com `unitCostSnapshot` do momento. */
  lines: ComponentSupplyLine[]
  machineLines: ComponentMachineLine[]
  lightToolLines: ComponentLightToolLine[]
  suppliesCost: number
  machineCost: number
  lightToolCost: number
  humanCost: number
  unitCost: number
  humanTimeHours: number
}

/**
 * Recalcula o custo da composição com os custos ATUAIS de insumos, ativos
 * pesados, materiais leves e valor hora das settings. Toda a matemática passa
 * por `calculations.ts`; aqui só resolvemos as referências e convertemos
 * minutos → horas.
 */
export function calcularCustoComposicao(
  input: ComposicaoCustoInput,
  supplies: WithId<Supply>[],
  heavyAssets: WithId<HeavyAsset>[],
  lightTools: WithId<LightTool>[],
  settings: WithId<WorkspaceSettings> | null,
): ComposicaoCusto {
  const humanTimeHours = input.humanTimeMinutes / 60

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

  // Ativos pesados: tempo em minutos → horas + snapshot custo/hora.
  const machineLines: ComponentMachineLine[] = input.machineAssets
    .filter((l) => l.assetId !== '')
    .map((l) => {
      const asset = heavyAssets.find((a) => a.id === l.assetId)
      return {
        assetId: l.assetId,
        timeMinutes: l.timeMinutes,
        costPerHourSnapshot: asset?.totalCostPerHour ?? 0,
      }
    })

  // Materiais leves: tempo em minutos → horas + snapshot rateio/hora.
  const lightToolLines: ComponentLightToolLine[] = input.lightTools
    .filter((l) => l.toolId !== '')
    .map((l) => {
      const tool = lightTools.find((t) => t.id === l.toolId)
      return {
        toolId: l.toolId,
        timeMinutes: l.timeMinutes,
        costPerHourSnapshot: tool?.monthlyMaintenanceCost ?? 0,
      }
    })

  const suppliesCost = lines.reduce((sum, l) => sum + l.quantity * l.unitCostSnapshot, 0)
  const machineCost = machineLines.reduce(
    (sum, l) => sum + (l.timeMinutes / 60) * l.costPerHourSnapshot,
    0,
  )
  const lightToolCost = lightToolLines.reduce(
    (sum, l) => sum + (l.timeMinutes / 60) * l.costPerHourSnapshot,
    0,
  )
  const humanCost = humanTimeHours * humanHourlyRate

  const unitCost = componentUnitCost({
    supplies: lines,
    machineAssets: machineLines.map((l) => ({
      assetId: l.assetId,
      timeHours: l.timeMinutes / 60,
      costPerHour: l.costPerHourSnapshot,
    })),
    lightTools: lightToolLines.map((l) => ({
      toolId: l.toolId,
      timeHours: l.timeMinutes / 60,
      costPerHour: l.costPerHourSnapshot,
    })),
    humanTimeHours,
    humanHourlyRate,
  })

  return { lines, machineLines, lightToolLines, suppliesCost, machineCost, lightToolCost, humanCost, unitCost, humanTimeHours }
}

// ---------------------------------------------------------------------------
// Duplicação: cria um componente novo (v1) com a mesma composição e snapshots
// ---------------------------------------------------------------------------

/**
 * Cria uma cópia do componente como NOVO documento: mesma composição,
 * snapshots e custo unitário, nome com sufixo "(cópia)", `version: 1` e
 * histórico independente. O original permanece intacto. Retorna o id da cópia.
 */
export async function duplicarComponente(
  wsId: string,
  origem: WithId<SemiFinishedComponent>,
): Promise<string> {
  return createComponent(wsId, {
    name: `${origem.name} (cópia)`,
    isPackaging: origem.isPackaging ?? false,
    supplies: (origem.supplies ?? []).map((l) => ({ ...l })),
    machineAssets: (origem.machineAssets ?? []).map((l) => ({ ...l })),
    lightTools: (origem.lightTools ?? []).map((l) => ({ ...l })),
    humanTimeHours: origem.humanTimeHours,
    humanProfile: origem.humanProfile,
    unitCost: origem.unitCost,
    version: 1,
    isArchived: false,
  })
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
  lightTools: WithId<LightTool>[],
  settings: WithId<WorkspaceSettings> | null,
): Promise<string> {
  const custo = calcularCustoComposicao(
    {
      supplies: (atual.supplies ?? []).map((l) => ({ supplyId: l.supplyId, quantity: l.quantity })),
      machineAssets: (atual.machineAssets ?? []).map((l) => ({ assetId: l.assetId, timeMinutes: l.timeMinutes })),
      lightTools: (atual.lightTools ?? []).map((l) => ({ toolId: l.toolId, timeMinutes: l.timeMinutes })),
      humanProfile: atual.humanProfile,
      humanTimeMinutes: atual.humanTimeHours * 60,
    },
    supplies,
    heavyAssets,
    lightTools,
    settings,
  )

  await updateComponent(wsId, atual.id, { isArchived: true })
  return createComponent(wsId, {
    name: atual.name,
    isPackaging: atual.isPackaging ?? false,
    supplies: custo.lines,
    machineAssets: custo.machineLines,
    lightTools: custo.lightToolLines,
    humanTimeHours: custo.humanTimeHours,
    humanProfile: atual.humanProfile,
    unitCost: custo.unitCost,
    version: atual.version + 1,
    isArchived: false,
  })
}
