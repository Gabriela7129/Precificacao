/**
 * Camada de dados do módulo Componentes.
 *
 * Consome SOMENTE o contrato de `src/services/firestore.ts` (hooks tipados +
 * create/update tipados). O que o contrato não cobre — settings como doc
 * único e o recálculo ao vivo da composição — é implementado aqui.
 */

import {
  createComponent,
  deleteComponent,
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
  /**
   * Linhas em edição. F1 (integridade histórica): quando `unitCostSnapshot`
   * está presente (edição de linha existente), ele é preservado; `null`
   * (linha nova ou entidade trocada) resolve para o custo médio ATUAL.
   */
  supplies: { supplyId: string; quantity: number; unitCostSnapshot?: number | null }[]
  /** Lista de ativos pesados + tempo em minutos (mesma regra de snapshot). */
  machineAssets: { assetId: string; timeMinutes: number; costPerHourSnapshot?: number | null }[]
  /** Lista de materiais leves — custo fixo = manutenção mensal (mesma regra de snapshot). */
  lightTools: { toolId: string; costPerHourSnapshot?: number | null }[]
  humanProfile: HumanProfile
  humanTimeMinutes: number
  /**
   * F1: snapshot do valor-hora salvo no documento (edição). `null`/ausente
   * (criação, legado ou perfil trocado) resolve para o valor hora das settings.
   */
  humanHourlyRate?: number | null
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
  /** Valor-hora efetivamente usado (snapshot preservado ou settings) — persistir. */
  humanHourlyRate: number
}

/**
 * Recalcula o custo da composição. F1 (integridade histórica): snapshots
 * salvos são PRESERVADOS na edição — só linhas novas (ou com entidade
 * trocada) usam os custos atuais de insumos, ativos, materiais leves e
 * settings. "Reavaliar custos" (reavaliarComponente) é a única porta que
 * ignora snapshots e usa tudo de hoje. Toda a matemática passa por
 * `calculations.ts`; aqui só resolvemos as referências e convertemos
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

  const settingsHourlyRate =
    input.humanProfile === 'creative'
      ? (settings?.hourlyCreative ?? 0)
      : (settings?.hourlyOperational ?? 0)
  // F1: preserva o valor-hora da composição; fallback (criação/legado sem
  // snapshot) usa as settings atuais.
  const humanHourlyRate = input.humanHourlyRate ?? settingsHourlyRate

  // F1: snapshot preservado na edição; linha nova usa o custo médio atual.
  const lines: ComponentSupplyLine[] = input.supplies
    .filter((l) => l.supplyId !== '')
    .map((l) => ({
      supplyId: l.supplyId,
      quantity: l.quantity,
      unitCostSnapshot:
        l.unitCostSnapshot ?? supplies.find((s) => s.id === l.supplyId)?.averageCost ?? 0,
    }))

  // Ativos pesados: tempo em minutos → horas + snapshot preservado/atual.
  const machineLines: ComponentMachineLine[] = input.machineAssets
    .filter((l) => l.assetId !== '')
    .map((l) => {
      const asset = heavyAssets.find((a) => a.id === l.assetId)
      return {
        assetId: l.assetId,
        timeMinutes: l.timeMinutes,
        costPerHourSnapshot: l.costPerHourSnapshot ?? asset?.totalCostPerHour ?? 0,
      }
    })

  // Materiais leves: custo FIXO por item = manutenção mensal (valor pago × taxa %).
  // `timeMinutes` é salvo como 0 (legado); o custo não depende de tempo.
  const lightToolLines: ComponentLightToolLine[] = input.lightTools
    .filter((l) => l.toolId !== '')
    .map((l) => {
      const tool = lightTools.find((t) => t.id === l.toolId)
      return {
        toolId: l.toolId,
        timeMinutes: 0,
        costPerHourSnapshot: l.costPerHourSnapshot ?? tool?.monthlyMaintenanceCost ?? 0,
      }
    })

  const suppliesCost = lines.reduce((sum, l) => sum + l.quantity * l.unitCostSnapshot, 0)
  const machineCost = machineLines.reduce(
    (sum, l) => sum + (l.timeMinutes / 60) * l.costPerHourSnapshot,
    0,
  )
  const lightToolCost = lightToolLines.reduce((sum, l) => sum + l.costPerHourSnapshot, 0)
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
      cost: l.costPerHourSnapshot,
    })),
    humanTimeHours,
    humanHourlyRate,
  })

  return { lines, machineLines, lightToolLines, suppliesCost, machineCost, lightToolCost, humanCost, unitCost, humanTimeHours, humanHourlyRate }
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
    ...(origem.humanHourlyRate != null ? { humanHourlyRate: origem.humanHourlyRate } : {}),
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
  // F1: Reavaliar é a única porta que ignora snapshots — sem passar os
  // snapshots salvos, tudo resolve para os custos de HOJE (comportamento
  // previsto no documento de requisitos §5).
  const custo = calcularCustoComposicao(
    {
      supplies: (atual.supplies ?? []).map((l) => ({ supplyId: l.supplyId, quantity: l.quantity })),
      machineAssets: (atual.machineAssets ?? []).map((l) => ({ assetId: l.assetId, timeMinutes: l.timeMinutes })),
      lightTools: (atual.lightTools ?? []).map((l) => ({ toolId: l.toolId })),
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
    humanHourlyRate: custo.humanHourlyRate,
    unitCost: custo.unitCost,
    version: atual.version + 1,
    isArchived: false,
  })
}

// ---------------------------------------------------------------------------
// Exclusão: remove o componente e TODAS as suas versões (mesmo nome)
// ---------------------------------------------------------------------------

/**
 * Exclui um componente e todas as suas versões arquivadas (documentos com o
 * mesmo `name`). Produtos que o referenciam passam a exibir "Componente
 * removido" (o custo fica preservado no snapshot). Retorna quantos documentos
 * foram removidos.
 */
export async function excluirComponente(
  wsId: string,
  componente: WithId<SemiFinishedComponent>,
  todos: WithId<SemiFinishedComponent>[],
): Promise<number> {
  const versoes = todos.filter((c) => c.name === componente.name)
  const alvos = versoes.length > 0 ? versoes : [componente]
  await Promise.all(alvos.map((v) => deleteComponent(wsId, v.id)))
  return alvos.length
}
