/**
 * Cálculo de precificação do produto — camada fina sobre `src/lib/calculations.ts`.
 * Nenhuma fórmula vive aqui; apenas orquestração dos parâmetros do módulo.
 */

import {
  marketplaceFee,
  netValueFromSalePrice,
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
  /** Valor líquido estimado após taxas. */
  valorLiquido: number
}

/**
 * Regras:
 * - Com `desiredNetValue` preenchido E marketplace selecionado → cálculo
 *   reverso: preço = (líquido + taxaFixa) / (1 − taxa%/100).
 * - Caso contrário → preço de venda = preço sem taxas; o valor líquido
 *   exibido é o líquido estimado sobre esse preço no marketplace selecionado.
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

  let salePrice: number
  if (desiredNetValue != null && marketplace) {
    salePrice = salePriceFromDesiredNet(desiredNetValue, feePct, fixedFee)
  } else {
    salePrice = precoSemTaxas
  }

  const taxaMarketplace = marketplace ? marketplaceFee(salePrice, feePct, fixedFee) : 0
  const valorLiquido = marketplace
    ? netValueFromSalePrice(salePrice, feePct, fixedFee)
    : salePrice

  return {
    margemValor: precoSemTaxas - directCost,
    precoSemTaxas,
    taxaMarketplace,
    salePrice,
    valorLiquido,
  }
}
