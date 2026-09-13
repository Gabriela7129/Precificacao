/**
 * Fórmulas de negócio do Precificador de Artesanato.
 * Fonte de verdade: docs/documento-requisitos.md (seções 4 e 5).
 * Todas as funções são puras e testáveis — nenhuma regra de cálculo deve
 * viver em componentes de UI.
 */

import type { ComponentSupplyLine, ProductComponentLine, ProductLightToolLine, ProductMachineLine, ProductPackagingLine, ProductSupplyLine } from '../types'

// ---------------------------------------------------------------------------
// Constantes de negócio
// ---------------------------------------------------------------------------

/** Semanas por mês usadas na projeção de horas (regra do documento). */
export const WEEKS_PER_MONTH = 4.33

/** Fator padrão da Hora Operacional sobre o valor hora base. */
export const OPERATIONAL_HOUR_FACTOR = 1.0

/** Fator padrão da Hora Criativa sobre o valor hora base (faixa 1,3–1,5). */
export const CREATIVE_HOUR_FACTOR = 1.4

/** Taxa padrão de manutenção de materiais leves (%). */
export const DEFAULT_LIGHT_MAINTENANCE_RATE = 7

// ---------------------------------------------------------------------------
// Calculadora de valor hora (Módulo 1)
// ---------------------------------------------------------------------------

/** horas/mês = horas produtivas/semana × 4,33 */
export function monthlyProductiveHours(productiveHoursPerWeek: number): number {
  return productiveHoursPerWeek * WEEKS_PER_MONTH
}

/** valor hora base = salário líquido desejado / horas por mês */
export function baseHourlyRate(desiredSalary: number, productiveHoursPerWeek: number): number {
  const hours = monthlyProductiveHours(productiveHoursPerWeek)
  if (hours <= 0) return 0
  return desiredSalary / hours
}

/** Hora Operacional = valor hora base × fator (padrão 1,0) */
export function operationalHourlyRate(
  desiredSalary: number,
  productiveHoursPerWeek: number,
  factor: number = OPERATIONAL_HOUR_FACTOR,
): number {
  return baseHourlyRate(desiredSalary, productiveHoursPerWeek) * factor
}

/** Hora Criativa = valor hora base × fator (padrão 1,3 a 1,5) */
export function creativeHourlyRate(
  desiredSalary: number,
  productiveHoursPerWeek: number,
  factor: number = CREATIVE_HOUR_FACTOR,
): number {
  return baseHourlyRate(desiredSalary, productiveHoursPerWeek) * factor
}

// ---------------------------------------------------------------------------
// Materiais leves (Módulo 1)
// ---------------------------------------------------------------------------

/** Manutenção mensal do item = valor do item × (taxa / 100) */
export function lightToolMonthlyMaintenance(purchaseValue: number, maintenanceRatePct: number): number {
  return purchaseValue * (maintenanceRatePct / 100)
}

// Modelo vigente (decisão F3, set/2026): materiais leves NÃO usam rateio por
// hora produtiva. Cada material entra como custo fixo por uso
// (manutenção mensal = valor × taxa %), contado 1× por produto via dedução
// de compartilhamento. A antiga lightMaintenancePerHour foi removida.

// ---------------------------------------------------------------------------
// Ativos pesados (Módulo 2)
// ---------------------------------------------------------------------------

/** depreciação/hora = valor pago / (vida útil em meses × horas produtivas/mês) */
export function heavyAssetDepreciationPerHour(
  purchaseValue: number,
  usefulLifeMonths: number,
  productiveHoursPerWeek: number,
): number {
  const hours = monthlyProductiveHours(productiveHoursPerWeek)
  if (usefulLifeMonths <= 0 || hours <= 0) return 0
  return purchaseValue / (usefulLifeMonths * hours)
}

/** energia/hora = (potência Watts × tarifa kWh) / 1000 */
export function heavyAssetEnergyPerHour(powerWatts: number, electricityRate: number | null): number {
  if (electricityRate == null || electricityRate <= 0 || powerWatts <= 0) return 0
  return (powerWatts * electricityRate) / 1000
}

/** custo/hora do ativo = depreciação/hora + energia/hora */
export function heavyAssetTotalCostPerHour(
  purchaseValue: number,
  usefulLifeMonths: number,
  productiveHoursPerWeek: number,
  powerWatts: number,
  electricityRate: number | null,
): number {
  return (
    heavyAssetDepreciationPerHour(purchaseValue, usefulLifeMonths, productiveHoursPerWeek) +
    heavyAssetEnergyPerHour(powerWatts, electricityRate)
  )
}

// ---------------------------------------------------------------------------
// Insumos — Custo Médio Ponderado (Módulo 3)
// ---------------------------------------------------------------------------

/**
 * novo custo médio =
 *   (estoque atual × custo médio atual + quantidade comprada × valor unitário)
 *   / (estoque atual + quantidade comprada)
 */
export function weightedAverageCost(
  currentStock: number,
  currentAverageCost: number,
  purchasedQuantity: number,
  purchasedTotalValue: number,
): number {
  const newStock = currentStock + purchasedQuantity
  if (newStock <= 0) return 0
  return (currentStock * currentAverageCost + purchasedTotalValue) / newStock
}

// ---------------------------------------------------------------------------
// Componentes semi-acabados (Módulo 4)
// ---------------------------------------------------------------------------

export interface ComponentCostInput {
  /** Linhas de insumo com custo unitário atual (será salvo como snapshot). */
  supplies: ComponentSupplyLine[]
  /** Linhas de máquina pesada com tempo em horas. */
  machineAssets: { assetId: string; timeHours: number; costPerHour: number }[]
  /** Linhas de material leve com custo fixo (manutenção mensal do item). */
  lightTools: { toolId: string; cost: number }[]
  /** Tempo de mão de obra em horas. */
  humanTimeHours: number
  /** Valor hora do perfil selecionado (operacional ou criativo). */
  humanHourlyRate: number
}

/**
 * custo unitário = Σ(insumo × quantidade × custo médio)
 *                + Σ(tempo máquina × custo/hora do ativo)
 *                + Σ(custo fixo de cada material leve)  ← taxa de manutenção mensal, sem tempo
 *                + (tempo humano × valor hora)
 */
export function componentUnitCost(input: ComponentCostInput): number {
  const suppliesCost = input.supplies.reduce(
    (sum, line) => sum + line.quantity * line.unitCostSnapshot,
    0,
  )
  const machineCost = input.machineAssets.reduce(
    (sum, line) => sum + line.timeHours * line.costPerHour,
    0,
  )
  const lightToolCost = input.lightTools.reduce((sum, line) => sum + line.cost, 0)
  const humanCost = input.humanTimeHours * input.humanHourlyRate
  return suppliesCost + machineCost + lightToolCost + humanCost
}

// ---------------------------------------------------------------------------
// Produtos finais (Módulo 5)
// ---------------------------------------------------------------------------

export interface DirectCostInput {
  components: ProductComponentLine[]
  packaging: ProductPackagingLine[]
  /** Insumos extras adicionados diretamente ao produto. */
  supplies?: ProductSupplyLine[]
  /** Ativos pesados adicionados diretamente ao produto (tempo × custo/hora). */
  machineAssets?: ProductMachineLine[]
  /** Materiais leves adicionados diretamente ao produto (custo fixo; entram na dedução de repetição). */
  lightTools?: ProductLightToolLine[]
  finalHumanTimeHours: number
  finalHumanHourlyRate: number
  /** Dedução dos materiais leves compartilhados entre componentes (contados 1× no produto). */
  lightToolDeduction?: number
}

/**
 * custo direto = Σ(componentes × quantidade × custo unitário)
 *              + Σ(embalagens × quantidade × custo)
 *              + Σ(insumos extras × quantidade × custo médio)
 *              + Σ(ativos pesados diretos × minutos/60 × custo/hora)
 *              + Σ(materiais leves diretos × custo fixo)
 *              + (tempo humano final × valor hora)
 *              − dedução de materiais leves compartilhados (contados 1×)
 */
export function productDirectCost(input: DirectCostInput): number {
  const componentsCost = input.components.reduce(
    (sum, line) => sum + line.quantity * line.unitCostSnapshot,
    0,
  )
  const packagingCost = input.packaging.reduce(
    (sum, line) => sum + line.quantity * line.unitCostSnapshot,
    0,
  )
  const suppliesCost = (input.supplies ?? []).reduce(
    (sum, line) => sum + line.quantity * line.unitCostSnapshot,
    0,
  )
  const machineCost = (input.machineAssets ?? []).reduce(
    (sum, line) => sum + (line.timeMinutes / 60) * line.costPerHourSnapshot,
    0,
  )
  const directLightToolsCost = (input.lightTools ?? []).reduce(
    (sum, line) => sum + line.costSnapshot,
    0,
  )
  const humanCost = input.finalHumanTimeHours * input.finalHumanHourlyRate
  return (
    componentsCost +
    packagingCost +
    suppliesCost +
    machineCost +
    directLightToolsCost +
    humanCost -
    (input.lightToolDeduction ?? 0)
  )
}

/** preço sem taxas = custo direto × (1 + margem de lucro / 100) */
export function priceWithoutFees(directCost: number, profitMarginPct: number): number {
  return directCost * (1 + profitMarginPct / 100)
}

// ---------------------------------------------------------------------------
// Marketplace — taxas e cálculo reverso
// ---------------------------------------------------------------------------

/**
 * Taxa total cobrada pelo marketplace sobre um preço de venda.
 * Modelo (decisão set/2026): a taxa % incide sobre o preço SEM a taxa fixa;
 * a taxa fixa é somada POR FORA (a porcentagem não incide sobre ela).
 * taxa = (preço de venda − taxa fixa) × %/100 + taxa fixa
 */
export function marketplaceFee(salePrice: number, feePercentage: number, fixedFee: number | null = null): number {
  const fixed = fixedFee ?? 0
  return (salePrice - fixed) * (feePercentage / 100) + fixed
}

/** Valor líquido recebido = preço de venda − taxas do marketplace. */
export function netValueFromSalePrice(
  salePrice: number,
  feePercentage: number,
  fixedFee: number | null = null,
): number {
  return salePrice - marketplaceFee(salePrice, feePercentage, fixedFee)
}

/**
 * Cálculo reverso: valor líquido desejado → preço de venda.
 *
 * Modelo (decisão set/2026): a porcentagem é aplicada "por dentro" sobre o
 * líquido e a taxa fixa é SOMADA DEPOIS, sem a porcentagem incidir sobre ela:
 *
 * preço = líquido / (1 − taxa%/100) + taxa fixa
 *
 * Assim: preço − taxaFixa = líquido/(1−taxa%) e o marketplace cobra
 * taxa% sobre (preço − taxaFixa) + taxaFixa, devolvendo exatamente o líquido.
 */
export function salePriceFromDesiredNet(
  desiredNetValue: number,
  feePercentage: number,
  fixedFee: number | null = null,
): number {
  const rate = 1 - feePercentage / 100
  if (rate <= 0) return 0
  return desiredNetValue / rate + (fixedFee ?? 0)
}
