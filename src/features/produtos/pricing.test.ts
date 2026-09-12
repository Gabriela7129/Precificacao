/**
 * Testes de `computePricing` — camada de precificação do produto.
 *
 * Inclui testes de CARACTERIZAÇÃO dos desvios apontados na auditoria
 * (AUDITORIA.md): eles documentam o comportamento ATUAL do código, não o
 * desejado. Quando F2/M4/M6 forem corrigidos, estes testes devem ser
 * atualizados de propósito (o comentário indica qual achado cada um cobre).
 */
import { describe, expect, it } from 'vitest'
import { computePricing } from './pricing'

const close = (actual: number, expected: number) =>
  expect(Math.abs(actual - expected)).toBeLessThan(1e-9)

const shopee = { feePercentage: 20, fixedFee: 4 } // doc §5: Shopee 20% + R$ 4,00
const ml = { feePercentage: 20, fixedFee: null } // doc §5: Mercado Livre 20%
const nuvemshop = { feePercentage: 1, fixedFee: null } // doc §5: Nuvemshop 1%

describe('computePricing — caminho padrão (sem líquido desejado)', () => {
  it('sem marketplace: preço de venda = preço sem taxas', () => {
    const r = computePricing({ directCost: 50, profitMargin: 40, marketplace: null, desiredNetValue: null })
    close(r.precoSemTaxas, 70)
    close(r.salePrice, 70)
    close(r.taxaMarketplace, 0)
    close(r.margemValor, 20)
  })

  it('marketplace sem taxa fixa: preço = base / (1 − %/100); líquido = preço sem taxas', () => {
    // base 70 → 70/0,8 = 87,50; taxa = 17,50; 87,50 − 17,50 = 70 ✓
    const r = computePricing({ directCost: 50, profitMargin: 40, marketplace: ml, desiredNetValue: null })
    close(r.salePrice, 87.5)
    close(r.taxaMarketplace, 17.5)
    // Identidade do comentário de pricing.ts: líquido É o preço sem taxas.
    close(r.salePrice - r.taxaMarketplace, r.precoSemTaxas)
  })

  it('marketplace com taxa fixa (Shopee): (70 + 4) / 0,8 = 92,50', () => {
    const r = computePricing({ directCost: 50, profitMargin: 40, marketplace: shopee, desiredNetValue: null })
    close(r.salePrice, 92.5)
    close(r.taxaMarketplace, 22.5) // 92,50 × 20% + 4
    close(r.salePrice - r.taxaMarketplace, r.precoSemTaxas)
  })

  it('Nuvemshop 1%: 70 / 0,99', () => {
    const r = computePricing({ directCost: 50, profitMargin: 40, marketplace: nuvemshop, desiredNetValue: null })
    close(r.salePrice, 70 / 0.99)
  })

  it('margem zero: preço sem taxas = custo direto', () => {
    const r = computePricing({ directCost: 50, profitMargin: 0, marketplace: null, desiredNetValue: null })
    close(r.precoSemTaxas, 50)
    close(r.margemValor, 0)
  })

  it('a identidade do breakdown (preço sem taxas + taxa = preço de venda) vale neste caminho', () => {
    const r = computePricing({ directCost: 50, profitMargin: 40, marketplace: shopee, desiredNetValue: null })
    close(r.precoSemTaxas + r.taxaMarketplace, r.salePrice)
  })
})

describe('computePricing — líquido desejado (cálculo reverso, doc §5)', () => {
  it('líquido desejado + marketplace: preço = (líquido + taxa fixa) / (1 − %/100)', () => {
    // (80 + 4) / 0,8 = 105 — o líquido desejado vence a margem como base.
    const r = computePricing({ directCost: 50, profitMargin: 40, marketplace: shopee, desiredNetValue: 80 })
    close(r.salePrice, 105)
    close(r.taxaMarketplace, 25) // 105 × 20% + 4
    close(r.salePrice - r.taxaMarketplace, 80) // líquido real = o desejado ✓
  })

  // AUDITORIA F2: com líquido desejado, o breakdown exibido não fecha —
  // precoSemTaxas (derivado da margem) + taxaMarketplace ≠ salePrice (derivado
  // do líquido). Este teste CARACTERIZA o desvio: 70 + 25 ≠ 105 (diferença 10).
  it('[F2 caracterização] breakdown não fecha: preço sem taxas + taxa ≠ preço de venda', () => {
    const r = computePricing({ directCost: 50, profitMargin: 40, marketplace: shopee, desiredNetValue: 80 })
    const soma = r.precoSemTaxas + r.taxaMarketplace
    expect(Math.abs(soma - r.salePrice)).toBeGreaterThan(1e-9) // 95 ≠ 105
    close(soma - r.salePrice, -10)
  })

  // AUDITORIA M6: líquido desejado SEM marketplace é ignorado silenciosamente —
  // o preço segue sendo custo × (1 + margem), sem nenhum aviso.
  it('[M6 caracterização] líquido desejado sem marketplace é ignorado', () => {
    const r = computePricing({ directCost: 50, profitMargin: 40, marketplace: null, desiredNetValue: 80 })
    close(r.salePrice, 70) // igual ao caso sem desiredNetValue
    close(r.precoSemTaxas, 70)
  })

  // AUDITORIA M4: taxa ≥ 100% zera o preço silenciosamente (propagado de
  // salePriceFromDesiredNet).
  it('[M4 caracterização] marketplace com taxa 100% zera o preço de venda', () => {
    const r = computePricing({
      directCost: 50,
      profitMargin: 40,
      marketplace: { feePercentage: 100, fixedFee: null },
      desiredNetValue: 80,
    })
    expect(r.salePrice).toBe(0)
  })
})
