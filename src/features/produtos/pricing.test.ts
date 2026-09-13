/**
 * Testes de `computePricing` — camada de precificação do produto.
 *
 * Modelo de taxa (decisão set/2026): a porcentagem incide "por dentro" sobre o
 * líquido e a taxa fixa é SOMADA DEPOIS (a % não incide sobre a fixa):
 *   preço = líquido / (1 − %/100) + taxa fixa
 *   taxa  = (preço − taxa fixa) × %/100 + taxa fixa
 *
 * F2 (corrigido): com líquido desejado, `precoSemTaxas` É o líquido desejado —
 * a identidade do breakdown (preço sem taxas + taxa = preço de venda) fecha em
 * todos os caminhos. M4/M6 seguem caracterizados (comportamento atual).
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

  it('marketplace com taxa fixa (Shopee): 70/0,8 + 4 = 91,50 (fixa somada DEPOIS da %)', () => {
    const r = computePricing({ directCost: 50, profitMargin: 40, marketplace: shopee, desiredNetValue: null })
    close(r.salePrice, 91.5)
    // taxa = (91,50 − 4) × 20% + 4 = 21,50 — a % NÃO incide sobre a taxa fixa.
    close(r.taxaMarketplace, 21.5)
    close(r.salePrice - r.taxaMarketplace, r.precoSemTaxas) // líquido = 70 ✓
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
  it('líquido desejado + marketplace: preço = líquido / (1 − %/100) + taxa fixa', () => {
    // 80/0,8 + 4 = 104 — o líquido desejado vence a margem como base.
    const r = computePricing({ directCost: 50, profitMargin: 40, marketplace: shopee, desiredNetValue: 80 })
    close(r.salePrice, 104)
    close(r.taxaMarketplace, 24) // (104 − 4) × 20% + 4
    close(r.salePrice - r.taxaMarketplace, 80) // líquido real = o desejado ✓
    close(r.precoSemTaxas, 80) // F2: preço sem taxas É o líquido desejado
  })

  // F2 CORRIGIDO: a identidade do breakdown agora fecha também com líquido
  // desejado — precoSemTaxas (= o líquido) + taxaMarketplace = salePrice.
  it('[F2 corrigido] breakdown fecha: preço sem taxas + taxa = preço de venda', () => {
    const r = computePricing({ directCost: 50, profitMargin: 40, marketplace: shopee, desiredNetValue: 80 })
    close(r.precoSemTaxas + r.taxaMarketplace, r.salePrice) // 80 + 24 = 104 ✓
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
