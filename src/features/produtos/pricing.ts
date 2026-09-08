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
  /** Margem de lucro em R$ (preço sem taxas − custo direto). */
  margemValor: number
  /** Preço sem taxas = custo direto × (1 + margem/100). */
  precoSemTaxas: number
  /** Taxa total do marketplace sobre o preço de venda (R$). */
  taxaMarketplace: number
  /** Preço de venda no marketplace selecionado. */
  salePrice: number
}

/**
 * Regra: preço de venda = preço sem taxas + taxa do marketplace.
 * A taxa percentual incide sobre o preço de venda, de modo que
 * preço de venda − taxa = preço sem taxas (o líquido É o preço sem taxas —
 * por isso não há linha de "valor líquido" no breakdown).
 *
 * Com `desiredNetValue` preenchido E marketplace selecionado, o líquido
 * desejado substitui o preço sem taxas como base do cálculo reverso:
 * preço = (líquido + taxaFixa) / (1 − taxa%/100).
 */
export function computePricing(args: {
  directCost: number
  profitMargin: number
  marketplace: Pick<Marketplace, 'feePercentage' | 'fixedFee'> | null | undefined
  desiredNetValue: number | null
}): PricingResult {
  const { directCost, profitMargin, marketplace, desiredNetValue } = args
  const precoSemTaxas = priceWithoutFees(directCost, profitMargin)
  const feePct = marketplace?.feePercentage ?? 0
  const fixedFee = marketplace?.fixedFee ?? null

  // Base sobre a qual a taxa do marketplace é aplicada.
  const base = desiredNetValue != null && marketplace ? desiredNetValue : precoSemTaxas

  let salePrice: number
  if (marketplace) {
    // preço de venda = base + taxa; como a taxa % incide sobre o preço de
    // venda, resolve-se por: (base + taxaFixa) / (1 − taxa%/100).
    salePrice = salePriceFromDesiredNet(base, feePct, fixedFee)
  } else {
    salePrice = precoSemTaxas
  }

  const taxaMarketplace = marketplace ? marketplaceFee(salePrice, feePct, fixedFee) : 0

  return {
    margemValor: precoSemTaxas - directCost,
    precoSemTaxas,
    taxaMarketplace,
    salePrice,
  }
}
