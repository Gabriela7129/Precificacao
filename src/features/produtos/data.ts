/**
 * Dados do módulo de Produtos.
 *
 * Leituras usam os hooks tipados de `src/services/firestore.ts` (contrato da
 * Fatia 0). Este arquivo só adiciona derivados locais que o contrato não
 * expõe diretamente: settings como doc único, produto por id e o valor hora
 * do perfil de mão de obra.
 */

import { useMemo } from 'react'
import { useProducts, useSettings } from '../../services/firestore'
import type { HumanProfile, Product, WithId, WorkspaceSettings } from '../../types'

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
