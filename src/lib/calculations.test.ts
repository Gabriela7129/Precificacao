/**
 * Testes das fórmulas puras de negócio — fonte de verdade: docs/documento-requisitos.md §4/§5.
 *
 * Estes testes travam o comportamento CORRETO das fórmulas (as que a auditoria
 * confirmou bater com o documento). Comportamentos desviantes de outros módulos
 * (pricing.ts, format.ts) são caracterizados nos arquivos de teste respectivos.
 */
import { describe, expect, it } from 'vitest'
import {
  CREATIVE_HOUR_FACTOR,
  DEFAULT_LIGHT_MAINTENANCE_RATE,
  OPERATIONAL_HOUR_FACTOR,
  WEEKS_PER_MONTH,
  baseHourlyRate,
  componentUnitCost,
  creativeHourlyRate,
  heavyAssetDepreciationPerHour,
  heavyAssetEnergyPerHour,
  heavyAssetTotalCostPerHour,
  lightToolMonthlyMaintenance,
  marketplaceFee,
  monthlyProductiveHours,
  netValueFromSalePrice,
  operationalHourlyRate,
  priceWithoutFees,
  productDirectCost,
  salePriceFromDesiredNet,
  weightedAverageCost,
} from './calculations'

// Tolerância para comparações de ponto flutuante (valores em reais).
const close = (actual: number, expected: number) =>
  expect(Math.abs(actual - expected)).toBeLessThan(1e-9)

describe('constantes de negócio (doc §4)', () => {
  it('usa 4,33 semanas/mês', () => {
    expect(WEEKS_PER_MONTH).toBe(4.33)
  })
  it('fator operacional padrão é 1,0', () => {
    expect(OPERATIONAL_HOUR_FACTOR).toBe(1.0)
  })
  it('fator criativo padrão é 1,4 (dentro da faixa 1,3–1,5 do doc)', () => {
    expect(CREATIVE_HOUR_FACTOR).toBe(1.4)
  })
  it('taxa de manutenção leve padrão é 7%', () => {
    expect(DEFAULT_LIGHT_MAINTENANCE_RATE).toBe(7)
  })
})

describe('calculadora de valor hora (doc §4, Módulo 1)', () => {
  it('horas/mês = horas produtivas/semana × 4,33', () => {
    close(monthlyProductiveHours(30), 30 * 4.33)
    expect(monthlyProductiveHours(0)).toBe(0)
  })

  it('valor hora base = salário / horas por mês', () => {
    // R$ 3.000 / (30h × 4,33) = R$ 23,0947...
    close(baseHourlyRate(3000, 30), 3000 / (30 * 4.33))
  })

  it('valor hora base é 0 quando não há horas produtivas (sem divisão por zero)', () => {
    expect(baseHourlyRate(3000, 0)).toBe(0)
  })

  it('hora operacional = base × fator (padrão 1,0)', () => {
    close(operationalHourlyRate(3000, 30), baseHourlyRate(3000, 30))
    close(operationalHourlyRate(3000, 30, 1.2), baseHourlyRate(3000, 30) * 1.2)
  })

  it('hora criativa = base × fator (padrão 1,4)', () => {
    close(creativeHourlyRate(3000, 30), baseHourlyRate(3000, 30) * 1.4)
    close(creativeHourlyRate(3000, 30, 1.5), baseHourlyRate(3000, 30) * 1.5)
  })
})

describe('materiais leves (modelo vigente — decisão F3, set/2026)', () => {
  it('manutenção mensal do item = valor × taxa/100 (custo fixo por uso, sem rateio por hora)', () => {
    // Tesoura R$ 50 × 7% = R$ 3,50
    close(lightToolMonthlyMaintenance(50, 7), 3.5)
    close(lightToolMonthlyMaintenance(50, DEFAULT_LIGHT_MAINTENANCE_RATE), 3.5)
  })
})

describe('ativos pesados (doc §4, Módulo 2)', () => {
  it('depreciação/hora = valor pago / (vida útil em meses × horas/mês)', () => {
    // R$ 1.200 / (24 meses × 30h × 4,33)
    close(heavyAssetDepreciationPerHour(1200, 24, 30), 1200 / (24 * 30 * 4.33))
  })

  it('depreciação é 0 com vida útil ou horas inválidas (sem divisão por zero)', () => {
    expect(heavyAssetDepreciationPerHour(1200, 0, 30)).toBe(0)
    expect(heavyAssetDepreciationPerHour(1200, -5, 30)).toBe(0)
    expect(heavyAssetDepreciationPerHour(1200, 24, 0)).toBe(0)
  })

  it('energia/hora = (W × tarifa) / 1000', () => {
    // 850 W × R$ 0,95/kWh = R$ 0,8075/h
    close(heavyAssetEnergyPerHour(850, 0.95), (850 * 0.95) / 1000)
  })

  it('energia é 0 sem tarifa ou sem potência (campo pode ficar em branco)', () => {
    expect(heavyAssetEnergyPerHour(850, null)).toBe(0)
    expect(heavyAssetEnergyPerHour(850, 0)).toBe(0)
    expect(heavyAssetEnergyPerHour(0, 0.95)).toBe(0)
  })

  it('custo/hora do ativo = depreciação/hora + energia/hora', () => {
    const dep = heavyAssetDepreciationPerHour(1200, 24, 30)
    const ene = heavyAssetEnergyPerHour(850, 0.95)
    close(heavyAssetTotalCostPerHour(1200, 24, 30, 850, 0.95), dep + ene)
  })
})

describe('custo médio ponderado de insumos (doc §4, Módulo 3)', () => {
  it('novo custo médio = (estoque × custo atual + valor comprado) / novo estoque', () => {
    // 10 un @ R$ 2,00 + compra de 5 un por R$ 15,00 → (20 + 15) / 15 = 2,3333
    close(weightedAverageCost(10, 2, 5, 15), 35 / 15)
  })

  it('primeira compra define o custo médio (estoque inicial zero)', () => {
    close(weightedAverageCost(0, 0, 4, 10), 2.5)
  })

  it('retorna 0 quando o estoque resultante é zero ou negativo', () => {
    expect(weightedAverageCost(0, 0, 0, 0)).toBe(0)
  })
})

describe('custo unitário do componente (doc §4, Módulo 4)', () => {
  it('custo = Σ insumos + Σ máquina + Σ leves + mão de obra', () => {
    const cost = componentUnitCost({
      supplies: [
        { supplyId: 'a', quantity: 10, unitCostSnapshot: 2 }, // 20
        { supplyId: 'b', quantity: 0.5, unitCostSnapshot: 8 }, // 4
      ],
      machineAssets: [{ assetId: 'm', timeHours: 0.5, costPerHour: 3 }], // 1,5
      lightTools: [{ toolId: 't', cost: 3.5 }], // 3,5 (custo fixo)
      humanTimeHours: 1.25,
      humanHourlyRate: 20, // 25
    })
    close(cost, 20 + 4 + 1.5 + 3.5 + 25)
  })

  it('composição vazia tem custo zero', () => {
    close(
      componentUnitCost({
        supplies: [],
        machineAssets: [],
        lightTools: [],
        humanTimeHours: 0,
        humanHourlyRate: 20,
      }),
      0,
    )
  })
})

describe('custo direto do produto (doc §4, Módulo 5)', () => {
  const baseInput = {
    components: [{ componentId: 'c', quantity: 2, unitCostSnapshot: 13.75 }], // 27,50
    packaging: [{ componentId: 'e', quantity: 1, unitCostSnapshot: 2 }], // 2,00
    finalHumanTimeHours: 0.5,
    finalHumanHourlyRate: 20, // 10,00
  }

  it('custo direto = componentes + embalagens + mão de obra final', () => {
    close(productDirectCost(baseInput), 27.5 + 2 + 10)
  })

  it('inclui insumos extras diretos (qtd × custo médio)', () => {
    close(productDirectCost({ ...baseInput, supplies: [{ supplyId: 's', quantity: 3, unitCostSnapshot: 1.2 }] }), 39.5 + 3.6)
  })

  it('inclui ativos pesados diretos (minutos/60 × custo/hora)', () => {
    close(
      productDirectCost({ ...baseInput, machineAssets: [{ assetId: 'm', timeMinutes: 90, costPerHourSnapshot: 4 }] }),
      39.5 + 6,
    )
  })

  it('inclui materiais leves diretos e subtrai a dedução de compartilhados', () => {
    // leves diretos 3,50 + dedução 3,50 → efeito líquido zero além do 1× embutido
    close(
      productDirectCost({
        ...baseInput,
        lightTools: [{ toolId: 't', costSnapshot: 3.5 }],
        lightToolDeduction: 3.5,
      }),
      39.5 + 3.5 - 3.5,
    )
  })

  it('campos opcionais ausentes (documentos legados) não quebram o cálculo', () => {
    close(productDirectCost(baseInput), 39.5)
  })
})

describe('margem e taxas (doc §4, Módulo 5)', () => {
  it('preço sem taxas = custo direto × (1 + margem/100)', () => {
    // 50 × 1,4 = 70
    close(priceWithoutFees(50, 40), 70)
    close(priceWithoutFees(50, 0), 50)
  })

  it('taxa do marketplace = (preço − taxa fixa) × %/100 + taxa fixa (% não incide sobre a fixa)', () => {
    close(marketplaceFee(100, 20, 4), (100 - 4) * 0.2 + 4) // 23,20
    close(marketplaceFee(100, 20), 20)
    close(marketplaceFee(100, 1, null), 1)
  })

  it('líquido = preço de venda − taxas', () => {
    // 92,50 − ((92,50 − 4) × 20% + 4) = 92,50 − 21,70 = 70,80
    close(netValueFromSalePrice(92.5, 20, 4), 92.5 - ((92.5 - 4) * 0.2 + 4))
  })

  it('cálculo reverso: preço = líquido / (1 − %/100) + taxa fixa (fixa somada DEPOIS)', () => {
    // líquido R$ 80 na Shopee (20% + R$ 4) → 80/0,8 + 4 = 104
    close(salePriceFromDesiredNet(80, 20, 4), 104)
    close(salePriceFromDesiredNet(80, 20), 100)
  })

  it('round-trip: líquido → preço → líquido preserva o valor', () => {
    const price = salePriceFromDesiredNet(80, 20, 4)
    close(netValueFromSalePrice(price, 20, 4), 80)
  })

  // AUDITORIA M4: taxa ≥ 100% retorna 0 silenciosamente (sem erro).
  // Documenta o comportamento atual; revisar quando M4 for tratado.
  it('[M4 caracterização] taxa ≥ 100% retorna preço 0 em vez de erro', () => {
    expect(salePriceFromDesiredNet(80, 100, null)).toBe(0)
    expect(salePriceFromDesiredNet(80, 150, null)).toBe(0)
  })
})
