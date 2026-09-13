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

  // F2 CORRIGIDO: o preço sem taxas passa a ser a base real do cálculo (o
  // líquido desejado) e a margem exibida é a efetiva — o breakdown fecha.
  // (Antes: exibia precoSemTaxas da margem (70) + taxa (25) ≠ salePrice (105).)
  it('[F2 corrigido] breakdown fecha no modo reverso: preço sem taxas + taxa = preço de venda', () => {
    const r = computePricing({ directCost: 50, profitMargin: 40, marketplace: shopee, desiredNetValue: 80 })
    expect(r.modoReverso).toBe(true)
    close(r.precoSemTaxas, 80) // a base real, não os 70 da margem
    close(r.margemValor, 30) // margem efetiva: 80 − 50
    close(r.precoSemTaxasMargem, 70) // referência preservada para a nota da UI
    close(r.precoSemTaxas + r.taxaMarketplace, r.salePrice) // 80 + 25 = 105 ✓
  })

  it('modo reverso só ativa com líquido desejado E marketplace', () => {
    const semMarketplace = computePricing({ directCost: 50, profitMargin: 40, marketplace: null, desiredNetValue: 80 })
    expect(semMarketplace.modoReverso).toBe(false)
    const semLiquido = computePricing({ directCost: 50, profitMargin: 40, marketplace: shopee, desiredNetValue: null })
    expect(semLiquido.modoReverso).toBe(false)
    close(semLiquido.precoSemTaxas, 70) // caminho normal: base da margem
  })

  // AUDITORIA M6: líquido desejado SEM marketplace segue ignorado
  // silenciosamente (sem aviso). O F2 não muda isso — decisão de escopo.
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
