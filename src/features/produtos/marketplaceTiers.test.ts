/**
 * Testes de `marketplaceTiers.ts` — faixas de taxa por valor ("Taxa por valor").
 *
 * Modelo (decisão set/2026): a faixa é escolhida pelo PREÇO DE VENDA (valor do
 * item na plataforma), não pelo preço sem taxas. Como o preço depende da taxa
 * e a taxa depende do preço, resolve-se por auto-consistência: para cada faixa
 * calcula-se o preço candidato e mantém-se a faixa cujo preço cai dentro dela.
 * Fórmula do preço: líquido / (1 − %/100) + taxa fixa (fixa somada DEPOIS).
 */
import { describe, expect, it } from 'vitest'
import { computePricing } from './pricing'
import {
  hasFeeTiers,
  nearestTier,
  priceInTier,
  resolveFeeForPrice,
  resolveSalePriceFromBase,
} from '../../lib/marketplaceTiers'
import type { MarketplaceFeeTier } from '../../types'

const close = (actual: number, expected: number) =>
  expect(Math.abs(actual - expected)).toBeLessThan(1e-9)

// Faixas da Shopee (exemplo real da Gabriela):
// 0–79,99 → 20% + R$ 4 · 80–99,99 → 14% + R$ 16 · 100–199,99 → 14% + R$ 20
const shopeeTiers: MarketplaceFeeTier[] = [
  { minValue: 0, maxValue: 79.99, feePercentage: 20, fixedFee: 4 },
  { minValue: 80, maxValue: 99.99, feePercentage: 14, fixedFee: 16 },
  { minValue: 100, maxValue: 199.99, feePercentage: 14, fixedFee: 20 },
]
const shopee = { feePercentage: 20, fixedFee: 4, feeTiers: shopeeTiers }

describe('hasFeeTiers / priceInTier', () => {
  it('hasFeeTiers: true só com array não vazio', () => {
    expect(hasFeeTiers({ feeTiers: shopeeTiers })).toBe(true)
    expect(hasFeeTiers({ feeTiers: [] })).toBe(false)
    expect(hasFeeTiers({ feeTiers: null })).toBe(false)
    expect(hasFeeTiers(null)).toBe(false)
  })

  it('priceInTier: limites inclusivos; null = aberto', () => {
    const t = shopeeTiers[0]
    expect(priceInTier(t, 0)).toBe(true)
    expect(priceInTier(t, 79.99)).toBe(true)
    expect(priceInTier(t, 80)).toBe(false)
    const open = { minValue: null, maxValue: null, feePercentage: 10, fixedFee: null }
    expect(priceInTier(open, 12345)).toBe(true)
  })

  it('nearestTier: devolve a faixa mais próxima do preço', () => {
    // 250 está acima de todas → mais próxima é a última (100–199,99)
    expect(nearestTier(shopeeTiers, 250)).toBe(shopeeTiers[2])
    expect(nearestTier(shopeeTiers, 85)).toBe(shopeeTiers[1])
  })
})

describe('resolveSalePriceFromBase — auto-consistência da faixa pelo preço de venda', () => {
  it('base pequena (40): faixa 1 → 40/0,8 + 4 = 54, dentro de 0–79,99 ✓', () => {
    const r = resolveSalePriceFromBase(shopee, 40)
    close(r.salePrice, 54)
    expect(r.resolved.tier).toBe(shopeeTiers[0])
    expect(r.resolved.outOfRange).toBe(false)
  })

  it('base 75: faixa 1 daria 97,75 (fora de 0–79,99); faixa 3 é auto-consistente → 107,21', () => {
    // Regra da Gabriela: a taxa é definida pelo PREÇO DE VENDA, não pela base.
    // Faixa 1: 75/0,8 + 4 = 97,75 → cai em 80–99,99 (inconsistente).
    // Faixa 2: 75/0,86 + 16 = 103,07 → cai em 100–199,99 (inconsistente).
    // Faixa 3: 75/0,86 + 20 = 107,21 → cai em 100–199,99 ✓.
    const r = resolveSalePriceFromBase(shopee, 75)
    close(r.salePrice, 75 / 0.86 + 20)
    expect(r.resolved.tier).toBe(shopeeTiers[2])
    expect(r.resolved.outOfRange).toBe(false)
  })

  it('base 68: faixa 2 é auto-consistente (68/0,86 + 16 = 94,98 ∈ 80–99,99)', () => {
    const r = resolveSalePriceFromBase(shopee, 68)
    close(r.salePrice, 68 / 0.86 + 16)
    expect(r.resolved.tier).toBe(shopeeTiers[1])
    expect(r.resolved.outOfRange).toBe(false)
  })

  it('preço acima de todas as faixas: usa a mais próxima e sinaliza outOfRange', () => {
    // base 250: faixa 3 daria 250/0,86 + 20 = 310,81 → fora de 100–199,99.
    const r = resolveSalePriceFromBase(shopee, 250)
    expect(r.resolved.outOfRange).toBe(true)
    expect(r.resolved.tier).toBe(shopeeTiers[2])
  })

  it('sem faixas: comportamento clássico (feePercentage/fixedFee raiz)', () => {
    const simple = { feePercentage: 20, fixedFee: 4, feeTiers: null }
    const r = resolveSalePriceFromBase(simple, 70)
    close(r.salePrice, 91.5) // 70/0,8 + 4
    expect(r.resolved.usingTiers).toBe(false)
    expect(r.resolved.tier).toBeNull()
  })

  it('marketplace nulo: preço = base', () => {
    const r = resolveSalePriceFromBase(null, 70)
    close(r.salePrice, 70)
  })
})

describe('resolveFeeForPrice — faixa pelo preço já conhecido', () => {
  it('preço 79,99 → faixa 1; preço 80 → faixa 2', () => {
    expect(resolveFeeForPrice(shopee, 79.99).tier).toBe(shopeeTiers[0])
    expect(resolveFeeForPrice(shopee, 80).tier).toBe(shopeeTiers[1])
    expect(resolveFeeForPrice(shopee, 80).outOfRange).toBe(false)
  })

  it('preço fora de todas as faixas → mais próxima + outOfRange', () => {
    const r = resolveFeeForPrice(shopee, 500)
    expect(r.outOfRange).toBe(true)
    expect(r.tier).toBe(shopeeTiers[2])
  })
})

describe('computePricing com faixas (integração)', () => {
  it('custo 40, margem 40% → base 56 → faixa 1: 56/0,8 + 4 = 74', () => {
    const r = computePricing({ directCost: 40, profitMargin: 40, marketplace: shopee, desiredNetValue: null })
    close(r.precoSemTaxas, 56)
    close(r.salePrice, 74) // 74 ∈ 0–79,99 ✓
    close(r.taxaMarketplace, (74 - 4) * 0.2 + 4) // 18
    expect(r.feeTier).toBe(shopeeTiers[0])
    expect(r.feeOutOfRange).toBe(false)
    close(r.precoSemTaxas + r.taxaMarketplace, r.salePrice)
  })

  it('líquido desejado 75 com faixas: resolve pela faixa auto-consistente do preço', () => {
    const r = computePricing({ directCost: 40, profitMargin: 40, marketplace: shopee, desiredNetValue: 75 })
    expect(r.modoReverso).toBe(true)
    close(r.salePrice, 75 / 0.86 + 20) // faixa 3 auto-consistente
    expect(r.feeTier).toBe(shopeeTiers[2])
    close(r.precoSemTaxas + r.taxaMarketplace, r.salePrice) // identidade fecha
    close(r.salePrice - r.taxaMarketplace, 75) // líquido real = desejado
  })

  it('sem marketplace: sem faixas envolvidas', () => {
    const r = computePricing({ directCost: 40, profitMargin: 40, marketplace: null, desiredNetValue: null })
    close(r.salePrice, 56)
    expect(r.feeTier).toBeNull()
    expect(r.feeOutOfRange).toBe(false)
  })
})
