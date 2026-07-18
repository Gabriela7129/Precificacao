/**
 * Fórmulas de negócio do Precificador de Artesanato.
 * Fonte de verdade: docs/documento-requisitos.md (seções 4 e 5).
 * Todas as funções são puras e testáveis — nenhuma regra de cálculo deve
 * viver em componentes de UI.
 */

import type { ComponentSupplyLine, ProductComponentLine, ProductPackagingLine } from '../types'

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

/** Limite de valor entre material leve e ativo pesado (R$). */
export const LIGHT_TOOL_MAX_VALUE = 500

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

/** Rateio por hora = Σ manutenções mensais / horas produtivas/mês */
export function lightMaintenancePerHour(
  monthlyMaintenanceCosts: number[],
  productiveHoursPerWeek: number,
): number {
  const total = monthlyMaintenanceCosts.reduce((sum, c) => sum + c, 0)
  const hours = monthlyProductiveHours(productiveHoursPerWeek)
  if (hours <= 0) return 0
  return total / hours
}

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
  /** Linhas de materiais leves com tempo em horas. */
  lightTools: { toolId: string; timeHours: number; costPerHour: number }[]
  /** Tempo de mão de obra em horas. */
  humanTimeHours: number
  /** Valor hora do perfil selecionado (operacional ou criativo). */
  humanHourlyRate: number
}

/**
 * custo unitário = Σ(insumo × quantidade × custo médio)
 *                + Σ(tempo máquina × custo/hora do ativo)
 *                + Σ(tempo material leve × rateio/hora)
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
  const lightToolCost = input.lightTools.reduce(
    (sum, line) => sum + line.timeHours * line.costPerHour,
    0,
  )
  const humanCost = input.humanTimeHours * input.humanHourlyRate
  return suppliesCost + machineCost + lightToolCost + humanCost
}

// ---------------------------------------------------------------------------
// Produtos finais (Módulo 5)
// ---------------------------------------------------------------------------

export interface DirectCostInput {
  components: ProductComponentLine[]
  packaging: ProductPackagingLine[]
  finalHumanTimeHours: number
  finalHumanHourlyRate: number
}

/**
 * custo direto = Σ(componentes × quantidade × custo unitário)
 *              + Σ(embalagens × quantidade × custo)
 *              + (tempo humano final × valor hora)
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
  const humanCost = input.finalHumanTimeHours * input.finalHumanHourlyRate
  return componentsCost + packagingCost + humanCost
}

/** preço sem taxas = custo direto × (1 + margem de lucro / 100) */
export function priceWithoutFees(directCost: number, profitMarginPct: number): number {
  return directCost * (1 + profitMarginPct / 100)
}

// ---------------------------------------------------------------------------
// Marketplace — taxas e cálculo reverso
// ---------------------------------------------------------------------------

/** Taxa total cobrada pelo marketplace sobre um preço de venda. */
export function marketplaceFee(salePrice: number, feePercentage: number, fixedFee: number | null = null): number {
  return salePrice * (feePercentage / 100) + (fixedFee ?? 0)
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
 * líquido = preço × (1 − taxa/100) − taxa fixa
 * preço = (líquido + taxa fixa) / (1 − taxa/100)
 */
export function salePriceFromDesiredNet(
  desiredNetValue: number,
  feePercentage: number,
  fixedFee: number | null = null,
): number {
  const rate = 1 - feePercentage / 100
  if (rate <= 0) return 0
  return (desiredNetValue + (fixedFee ?? 0)) / rate
}
