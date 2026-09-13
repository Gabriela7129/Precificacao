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
  /** Margem de lucro em R$ sobre o custo direto (base efetiva − custo direto). */
  margemValor: number
  /**
   * Preço sem taxas = base líquida efetiva do cálculo (F2).
   * Sem líquido desejado: custo direto × (1 + margem/100).
   * Com líquido desejado + marketplace: o próprio líquido desejado — assim a
   * identidade do breakdown (preço sem taxas + taxa = preço de venda) fecha
   * em todos os caminhos, e o líquido É o preço sem taxas.
   */
  precoSemTaxas: number
  /** Taxa total do marketplace sobre o preço de venda (R$). */
  taxaMarketplace: number
  /** Preço de venda no marketplace selecionado. */
  salePrice: number
}

/**
 * Regra: preço de venda = preço sem taxas + taxa do marketplace.
 * Modelo de taxa (decisão set/2026): a porcentagem incide "por dentro" sobre
 * o líquido (preço sem taxas) e a taxa fixa é SOMADA DEPOIS, sem a
 * porcentagem incidir sobre ela:
 *   preço = líquido / (1 − taxa%/100) + taxa fixa
 *   taxa  = (preço − taxa fixa) × taxa%/100 + taxa fixa
 * Com isso preço − taxa = líquido (o líquido É o preço sem taxas — sem linha
 * separada no breakdown).
 *
 * F2: com `desiredNetValue` preenchido E marketplace selecionado, o líquido
 * desejado substitui o preço-da-margem como base — e é ele que aparece como
 * "preço sem taxas" no breakdown, mantendo a identidade visível.
 */
export function computePricing(args: {
  directCost: number
  profitMargin: number
  marketplace: Pick<Marketplace, 'feePercentage' | 'fixedFee'> | null | undefined
  desiredNetValue: number | null
}): PricingResult {
  const { directCost, profitMargin, marketplace, desiredNetValue } = args
  const precoMargem = priceWithoutFees(directCost, profitMargin)
  const feePct = marketplace?.feePercentage ?? 0
  const fixedFee = marketplace?.fixedFee ?? null

  // Base líquida efetiva: líquido desejado vence a margem (com marketplace).
  const base = desiredNetValue != null && marketplace ? desiredNetValue : precoMargem

  let salePrice: number
  if (marketplace) {
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
  }
}
