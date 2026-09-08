/**
 * Dados do módulo de Produtos.
 *
 * Leituras usam os hooks tipados de `src/services/firestore.ts` (contrato da
 * Fatia 0). Este arquivo só adiciona derivados locais que o contrato não
 * expõe diretamente: settings como doc único, produto por id e o valor hora
 * do perfil de mão de obra.
 */

import { useMemo } from 'react'
import { createProduct, deleteProduct, useProducts, useSettings } from '../../services/firestore'
import type {
  HumanProfile,
  LightTool,
  Product,
  ProductComponentLine,
  ProductPackagingLine,
  SemiFinishedComponent,
  WithId,
  WorkspaceSettings,
} from '../../types'

/** Settings do workspace como doc único (o contrato retorna uma coleção). */
export function useSettingsDoc(): { settings: WithId<WorkspaceSettings> | null; loading: boolean } {
  const { data, loading } = useSettings()
  const settings = useMemo(() => data[0] ?? null, [data])
  return { settings, loading }
}

/** Valor hora (R$/h) do perfil de mão de obra segundo as configurações. */
export function hourlyRateForProfile(
  settings: WithId<WorkspaceSettings> | null,
  profile: HumanProfile,
): number {
  if (!settings) return 0
  return profile === 'creative' ? settings.hourlyCreative : settings.hourlyOperational
}

/** Produto por id (derivado do listener em tempo real da coleção). */
export function useProduct(id: string | undefined): {
  product: WithId<Product> | null
  loading: boolean
} {
  const { data, loading } = useProducts()
  const product = useMemo(() => data.find((p) => p.id === id) ?? null, [data, id])
  return { product, loading }
}

/**
 * Versões do mesmo produto (mesmo nome, mesmo workspace), ordenadas por
 * versão decrescente. O modelo não tem groupId — o nome é a chave de
 * agrupamento (renomear cria um novo "histórico").
 */
export function useProductVersions(product: WithId<Product> | null): WithId<Product>[] {
  const { data } = useProducts()
  return useMemo(() => {
    if (!product) return []
    return data
      .filter((p) => p.name === product.name)
      .sort((a, b) => b.version - a.version)
  }, [data, product])
}

// ---------------------------------------------------------------------------
// Materiais leves compartilhados entre componentes/embalagens do produto
// ---------------------------------------------------------------------------

export interface SharedLightToolInfo {
  toolId: string
  /** Nome do material leve ('Material removido' se saiu do cadastro). */
  toolName: string
  /** Total de aparições (Σ quantidades das linhas que usam o material). */
  occurrences: number
  /** Custo fixo mantido no produto (snapshot da primeira aparição). */
  unitCost: number
  /** Economia: custo total embutido nos componentes − 1× o custo fixo. */
  deduction: number
}

export interface SharedLightToolsResult {
  /** Materiais que aparecem mais de uma vez (occurrences > 1). */
  infos: SharedLightToolInfo[]
  /** Dedução total a subtrair do custo direto do produto. */
  deduction: number
}

/**
 * Analisa os materiais leves usados pelos componentes e embalagens do
 * produto. Cada material é contabilizado UMA única vez no produto, mesmo
 * aparecendo em vários componentes (ou em quantidade > 1): a dedução remove
 * as repetições do custo direto. O custo mantido é o snapshot da primeira
 * aparição; a dedução é a soma de todos os custos embutidos menos esse valor.
 */
export function analisarLevesCompartilhados(
  componentLines: Pick<ProductComponentLine, 'componentId' | 'quantity'>[],
  packagingLines: Pick<ProductPackagingLine, 'componentId' | 'quantity'>[],
  componentsById: Map<string, WithId<SemiFinishedComponent>>,
  lightToolsById: Map<string, WithId<LightTool>>,
): SharedLightToolsResult {
  // toolId → { occurrences, firstUnitCost, totalCost } somando todas as linhas.
  const acc = new Map<
    string,
    { occurrences: number; firstUnitCost: number; totalCost: number }
  >()

  const addLine = (componentId: string | undefined, quantity: number) => {
    if (!componentId) return
    const componente = componentsById.get(componentId)
    for (const line of componente?.lightTools ?? []) {
      if (!line.toolId) continue
      const qty = Number.isFinite(quantity) && quantity > 0 ? quantity : 1
      const cost = line.costPerHourSnapshot ?? 0
      const current = acc.get(line.toolId)
      if (current) {
        current.occurrences += qty
        current.totalCost += qty * cost
      } else {
        acc.set(line.toolId, {
          occurrences: qty,
          firstUnitCost: cost,
          totalCost: qty * cost,
        })
      }
    }
  }

  for (const l of componentLines) addLine(l.componentId, l.quantity)
  for (const l of packagingLines) addLine(l.componentId ?? undefined, l.quantity)

  const infos: SharedLightToolInfo[] = []
  let deduction = 0
  for (const [toolId, { occurrences, firstUnitCost, totalCost }] of acc) {
    if (occurrences <= 1) continue
    const ded = totalCost - firstUnitCost
    deduction += ded
    infos.push({
      toolId,
      toolName: lightToolsById.get(toolId)?.name ?? 'Material removido',
      occurrences,
      unitCost: firstUnitCost,
      deduction: ded,
    })
  }
  infos.sort((a, b) => a.toolName.localeCompare(b.toolName, 'pt-BR'))
  return { infos, deduction }
}

// ---------------------------------------------------------------------------
// Duplicação e exclusão
// ---------------------------------------------------------------------------

/**
 * Cria uma cópia do produto como NOVO documento: mesma composição,
 * snapshots, margem, marketplace e preço de venda, nome com sufixo "(cópia)",
 * `version: 1` e histórico independente. Retorna o id da cópia.
 */
export async function duplicarProduto(
  wsId: string,
  origem: WithId<Product>,
): Promise<string> {
  return createProduct(wsId, {
    name: `${origem.name} (cópia)`,
    components: (origem.components ?? []).map((l) => ({ ...l })),
    packaging: (origem.packaging ?? []).map((l) => ({ ...l })),
    finalHumanTimeHours: origem.finalHumanTimeHours,
    finalHumanProfile: origem.finalHumanProfile,
    directCost: origem.directCost,
    lightToolDeduction: origem.lightToolDeduction ?? 0,
    profitMargin: origem.profitMargin,
    marketplaceId: origem.marketplaceId,
    desiredNetValue: origem.desiredNetValue,
    salePrice: origem.salePrice,
    version: 1,
    isArchived: false,
  })
}

/**
 * Exclui um produto e todas as suas versões (documentos com o mesmo `name`),
 * inclusive arquivadas. Retorna quantos documentos foram removidos.
 */
export async function excluirProduto(
  wsId: string,
  produto: WithId<Product>,
  todos: WithId<Product>[],
): Promise<number> {
  const versoes = todos.filter((p) => p.name === produto.name)
  const alvos = versoes.length > 0 ? versoes : [produto]
  await Promise.all(alvos.map((v) => deleteProduct(wsId, v.id)))
  return alvos.length
}
