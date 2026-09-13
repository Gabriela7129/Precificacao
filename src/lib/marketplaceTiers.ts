/**
 * Resolução de faixas de taxa por valor ("Taxa por valor" do marketplace).
 *
 * Modelo (decisão set/2026): a faixa é escolhida pelo PREÇO DE VENDA (o valor
 * do item na plataforma), não pelo preço sem taxas. Como o preço de venda
 * depende da taxa e a taxa depende do preço, resolve-se por consistência:
 * para cada faixa calcula-se o preço candidato e verifica-se se ele cai
 * dentro da própria faixa. Se nenhuma faixa for consistente, usa-se a faixa
 * mais próxima do preço e o cálculo é sinalizado como "fora das faixas".
 *
 * Fórmulas (mesmo modelo de `calculations.ts`):
 *   preço = líquido / (1 − %/100) + taxa fixa
 *   taxa  = (preço − taxa fixa) × %/100 + taxa fixa
 */
import type { Marketplace, MarketplaceFeeTier } from '../types'

export interface ResolvedFee {
  feePercentage: number
  fixedFee: number | null
  /** Faixa utilizada (null quando o marketplace não usa faixas). */
  tier: MarketplaceFeeTier | null
  /** true quando nenhuma faixa cobre o preço de venda — a UI deve avisar. */
  outOfRange: boolean
  /** true quando o marketplace tem faixas configuradas. */
  usingTiers: boolean
}

/** Marketplace usa faixas de taxa? */
export function hasFeeTiers(m: Pick<Marketplace, 'feeTiers'> | null | undefined): boolean {
  return Array.isArray(m?.feeTiers) && (m?.feeTiers?.length ?? 0) > 0
}

/** Preço está dentro da faixa? Limites nulos = abertos. */
export function priceInTier(tier: MarketplaceFeeTier, price: number): boolean {
  if (tier.minValue != null && price < tier.minValue) return false
  if (tier.maxValue != null && price > tier.maxValue) return false
  return true
}

/**
 * Faixa mais próxima de um preço (para o aviso de "valor fora das faixas").
 * Compara a distância aos limites; empate favorece a faixa anterior.
 */
export function nearestTier(tiers: MarketplaceFeeTier[], price: number): MarketplaceFeeTier {
  let best = tiers[0]
  let bestDist = Infinity
  for (const tier of tiers) {
    const min = tier.minValue ?? -Infinity
    const max = tier.maxValue ?? Infinity
    let dist: number
    if (price < min) dist = min - price
    else if (price > max) dist = price - max
    else dist = 0
    if (dist < bestDist) {
      bestDist = dist
      best = tier
    }
  }
  return best
}

/**
 * Resolve a taxa para um PREÇO DE VENDA já conhecido.
 * Sem faixas: usa feePercentage/fixedFee do marketplace.
 * Com faixas: a que cobre o preço; se nenhuma cobrir, a mais próxima + outOfRange.
 */
export function resolveFeeForPrice(
  marketplace: Pick<Marketplace, 'feePercentage' | 'fixedFee' | 'feeTiers'> | null | undefined,
  salePrice: number,
): ResolvedFee {
  if (!marketplace) {
    return { feePercentage: 0, fixedFee: null, tier: null, outOfRange: false, usingTiers: false }
  }
  const tiers = marketplace.feeTiers ?? []
  if (tiers.length === 0) {
    return {
      feePercentage: marketplace.feePercentage,
      fixedFee: marketplace.fixedFee,
      tier: null,
      outOfRange: false,
      usingTiers: false,
    }
  }
  const match = tiers.find((t) => priceInTier(t, salePrice))
  if (match) {
    return {
      feePercentage: match.feePercentage,
      fixedFee: match.fixedFee,
      tier: match,
      outOfRange: false,
      usingTiers: true,
    }
  }
  const near = nearestTier(tiers, salePrice)
  return {
    feePercentage: near.feePercentage,
    fixedFee: near.fixedFee,
    tier: near,
    outOfRange: true,
    usingTiers: true,
  }
}

/** preço de venda a partir de uma base líquida com uma taxa específica. */
export function salePriceWith(base: number, feePercentage: number, fixedFee: number | null): number {
  const rate = 1 - feePercentage / 100
  if (rate <= 0) return 0
  return base / rate + (fixedFee ?? 0)
}

/**
 * Resolve o preço de venda com faixas: a faixa é escolhida pelo próprio preço
 * de venda, então testa cada faixa e mantém a que é auto-consistente
 * (o preço calculado cai dentro dela). Se várias forem consistentes, usa a
 * primeira em ordem de faixa mínima; se nenhuma for, usa a faixa mais próxima
 * do preço da primeira faixa e sinaliza outOfRange.
 */
export function resolveSalePriceFromBase(
  marketplace: Pick<Marketplace, 'feePercentage' | 'fixedFee' | 'feeTiers'> | null | undefined,
  base: number,
): { salePrice: number; resolved: ResolvedFee } {
  if (!marketplace) {
    return {
      salePrice: base,
      resolved: { feePercentage: 0, fixedFee: null, tier: null, outOfRange: false, usingTiers: false },
    }
  }
  const tiers = marketplace.feeTiers ?? []
  if (tiers.length === 0) {
    const salePrice = salePriceWith(base, marketplace.feePercentage, marketplace.fixedFee)
    return {
      salePrice,
      resolved: {
        feePercentage: marketplace.feePercentage,
        fixedFee: marketplace.fixedFee,
        tier: null,
        outOfRange: false,
        usingTiers: false,
      },
    }
  }

  // Candidatos por faixa. A faixa é escolhida pelo PREÇO DE VENDA, que depende
  // da própria faixa — então cada faixa gera um preço candidato e medimos a
  // distância dele ao intervalo da faixa (0 = auto-consistente). Escolhe-se o
  // candidato com menor distância; empate favorece a faixa mais baixa. Isso
  // cobre o "salto" entre faixas: base 75 pela faixa até 79,99 daria 97,75,
  // que já cai na faixa seguinte — o preço passa a ser o da faixa coerente.
  const candidates = [...tiers]
    .sort((a, b) => (a.minValue ?? -Infinity) - (b.minValue ?? -Infinity))
    .map((tier) => ({
      tier,
      price: salePriceWith(base, tier.feePercentage, tier.fixedFee),
      dist: tierDistance(tier, salePriceWith(base, tier.feePercentage, tier.fixedFee)),
    }))
    .sort((a, b) => a.dist - b.dist)

  const pick = candidates[0]
  return {
    salePrice: pick.price,
    resolved: {
      feePercentage: pick.tier.feePercentage,
      fixedFee: pick.tier.fixedFee,
      tier: pick.tier,
      outOfRange: pick.dist > 0,
      usingTiers: true,
    },
  }
}

/** Distância de um preço ao intervalo da faixa (0 se dentro). */
function tierDistance(tier: MarketplaceFeeTier, price: number): number {
  if (tier.minValue != null && price < tier.minValue) return tier.minValue - price
  if (tier.maxValue != null && price > tier.maxValue) return price - tier.maxValue
  return 0
}
