/**
 * Cálculo de precificação do produto — camada fina sobre `src/lib/calculations.ts`.
 * Nenhuma fórmula vive aqui; apenas orquestração dos parâmetros do módulo.
 */
import {
  marketplaceFee,
  priceWithoutFees,
} from '../../lib/calculations'
import { resolveSalePriceFromBase } from '../../lib/marketplaceTiers'
import type { Marketplace, MarketplaceFeeTier } from '../../types'

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
  /** Marketplace com "Taxa por valor": faixa usada no cálculo (null = sem faixas). */
  feeTier: MarketplaceFeeTier | null
  /**
   * true quando o preço de venda não cai em nenhuma faixa configurada — a
   * taxa usada é a da faixa mais próxima e a UI deve avisar o usuário.
   */
  feeOutOfRange: boolean
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
 * Taxa por valor (faixas): quando o marketplace tem `feeTiers`, a faixa é
 * escolhida pelo PREÇO DE VENDA (o valor do item na plataforma), não pelo
 * preço sem taxas — resolve-se por auto-consistência em `marketplaceTiers.ts`.
 * Ex.: produto com base R$ 75 pela faixa até R$ 79,99 daria preço R$ 80+;
 * como 80 já cai na faixa seguinte, a taxa usada é a da faixa R$ 80–99,99.
 *
 * A base é o preço sem taxas (custo × (1 + margem/100)); com
 * `desiredNetValue` preenchido E marketplace selecionado, o líquido desejado
 * substitui essa base (modo reverso, F2) e passa a ser o preço sem taxas
 * efetivo — o líquido É o preço sem taxas (fora de plataforma não há taxa).
 */
export function computePricing(args: {
  directCost: number
  profitMargin: number
  marketplace: Pick<Marketplace, 'feePercentage' | 'fixedFee' | 'feeTiers'> | null | undefined
  desiredNetValue: number | null
}): PricingResult {
  const { directCost, profitMargin, marketplace, desiredNetValue } = args
  const precoSemTaxasMargem = priceWithoutFees(directCost, profitMargin)

  // Base líquida efetiva: líquido desejado vence a margem (com marketplace).
  const modoReverso = desiredNetValue != null && marketplace != null
  const base = modoReverso ? (desiredNetValue as number) : precoSemTaxasMargem

  const { salePrice, resolved } = marketplace
    ? resolveSalePriceFromBase(marketplace, base)
    : { salePrice: base, resolved: null }

  const taxaMarketplace = resolved
    ? marketplaceFee(salePrice, resolved.feePercentage, resolved.fixedFee)
    : 0

  return {
    margemValor: base - directCost,
    precoSemTaxas: base,
    taxaMarketplace,
    salePrice,
    modoReverso,
    precoSemTaxasMargem,
    feeTier: resolved?.tier ?? null,
    feeOutOfRange: resolved?.outOfRange ?? false,
  }
}
