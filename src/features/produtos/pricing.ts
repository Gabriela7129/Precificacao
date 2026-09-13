/**
 * Cálculo de precificação do produto — camada fina sobre `src/lib/calculations.ts`.
 * Nenhuma fórmula vive aqui; apenas orquestração dos parâmetros do módulo.
 */
import {
  marketplaceFee,
  priceWithoutFees,
  salePriceFromDesiredNet,
} from '../../lib/calculations'
import type { Marketplace } from '../../types'

export interface PricingResult {
  /**
   * Margem efetiva em R$ (preço sem taxas − custo direto). No modo reverso
   * (F2) é a margem real obtida, não a margem % configurada no formulário.
   */
  margemValor: number
  /**
   * Preço sem taxas (design.md §8: preço mínimo de venda fora das plataformas).
   * F2: no modo reverso é o líquido desejado — a base real do cálculo — e não
   * o preço derivado da margem %. Assim o breakdown sempre fecha:
   * preço sem taxas + taxa do marketplace = preço de venda.
   */
  precoSemTaxas: number
  /** Taxa total do marketplace sobre o preço de venda (R$). */
  taxaMarketplace: number
  /** Preço de venda no marketplace selecionado. */
  salePrice: number
  /** F2: true quando o líquido desejado substituiu a margem como base do cálculo. */
  modoReverso: boolean
  /** Preço sem taxas derivado da margem % (referência no modo reverso). */
  precoSemTaxasMargem: number
}

/**
 * Regra: preço de venda = base + taxa do marketplace, com a taxa percentual
 * incidindo sobre o preço de venda: base = (preço + taxaFixa) / (1 − taxa%/100)
 * resolvido em `salePriceFromDesiredNet`.
 *
 * A base é o preço sem taxas (custo × (1 + margem/100)); com
 * `desiredNetValue` preenchido E marketplace selecionado, o líquido desejado
 * substitui essa base (modo reverso, F2) e passa a ser o preço sem taxas
 * efetivo — o líquido É o preço sem taxas (fora de plataforma não há taxa).
 */
export function computePricing(args: {
  directCost: number
  profitMargin: number
  marketplace: Pick<Marketplace, 'feePercentage' | 'fixedFee'> | null | undefined
  desiredNetValue: number | null
}): PricingResult {
  const { directCost, profitMargin, marketplace, desiredNetValue } = args
  const precoSemTaxasMargem = priceWithoutFees(directCost, profitMargin)
  const feePct = marketplace?.feePercentage ?? 0
  const fixedFee = marketplace?.fixedFee ?? null

  // Base sobre a qual a taxa do marketplace é aplicada.
  const modoReverso = desiredNetValue != null && marketplace != null
  const base = modoReverso ? (desiredNetValue as number) : precoSemTaxasMargem

  let salePrice: number
  if (marketplace) {
    // preço de venda = base + taxa; como a taxa % incide sobre o preço de
    // venda, resolve-se por: (base + taxaFixa) / (1 − taxa%/100).
    salePrice = salePriceFromDesiredNet(base, feePct, fixedFee)
  } else {
    salePrice = base
  }

  const taxaMarketplace = marketplace ? marketplaceFee(salePrice, feePct, fixedFee) : 0

  return {
    margemValor: base - directCost,
    precoSemTaxas: base,
    taxaMarketplace,
    salePrice,
    modoReverso,
    precoSemTaxasMargem,
  }
}
