/**
 * Modelos Firestore do Precificador de Artesanato.
 * Fonte de verdade: docs/documento-requisitos.md (seção 6).
 *
 * Convenções:
 * - Todas as coleções de dados têm o campo `workspaceId` (escopo de workspace).
 * - Datas de formulário (purchaseDate, date) são strings ISO "yyyy-mm-dd".
 * - Campos `createdAt`/`updatedAt` são timestamps do servidor (Firestore).
 * - `WithId<T>` é o tipo retornado pelos serviços/hooks (doc id + dados).
 */

export type WithId<T> = T & { id: string }

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------
export interface AppUser {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
  createdAt: unknown // serverTimestamp
}

// ---------------------------------------------------------------------------
// workspaces (workspace único compartilhado por todos os usuários autorizados)
// ---------------------------------------------------------------------------
export interface Workspace {
  name: string
  createdAt: unknown // serverTimestamp
}

// ---------------------------------------------------------------------------
// settings (um doc por workspace)
// ---------------------------------------------------------------------------
export interface WorkspaceSettings {
  workspaceId: string
  desiredSalary: number
  productiveHoursPerWeek: number
  hourlyOperational: number
  hourlyCreative: number
  /** R$/kWh. `null` = não calcular energia. */
  electricityRate: number | null
  /** Taxa % de manutenção de materiais leves (padrão 7). */
  lightMaintenanceRate: number
  updatedAt: unknown
}

// ---------------------------------------------------------------------------
// lightTools (materiais leves, itens até R$ 500)
// ---------------------------------------------------------------------------
export interface LightTool {
  workspaceId: string
  name: string
  purchaseValue: number
  /** "yyyy-mm-dd" */
  purchaseDate: string
  /** purchaseValue × lightMaintenanceRate/100 (snapshot do cadastro). */
  monthlyMaintenanceCost: number
  isActive: boolean
}

// ---------------------------------------------------------------------------
// heavyAssets (ativos pesados, itens acima de R$ 500)
// ---------------------------------------------------------------------------
export interface HeavyAsset {
  workspaceId: string
  name: string
  purchaseValue: number
  /** "yyyy-mm-dd" */
  purchaseDate: string
  usefulLifeMonths: number
  powerWatts: number
  /** R$/kWh no momento do cadastro. `null` = energia/hora = 0. */
  electricityRate: number | null
  depreciationPerHour: number
  energyCostPerHour: number
  totalCostPerHour: number
}

// ---------------------------------------------------------------------------
// supplyCategories
// ---------------------------------------------------------------------------
export interface SupplyCategory {
  workspaceId: string
  name: string
  isDefault: boolean
  order: number
}

// ---------------------------------------------------------------------------
// supplies (insumos / consumíveis)
// ---------------------------------------------------------------------------
export interface Supply {
  workspaceId: string
  name: string
  /** Unidade de medida livre (ex.: "folha", "cm", "g", "unidade"). */
  unit: string
  categoryId: string
  currentStock: number
  /** Custo médio ponderado por unidade. */
  averageCost: number
  /** currentStock × averageCost. */
  totalStockValue: number
  isActive: boolean
}

// ---------------------------------------------------------------------------
// supplyEntries (entradas de estoque / compras)
// ---------------------------------------------------------------------------
export interface SupplyEntry {
  workspaceId: string
  supplyId: string
  quantity: number
  totalValue: number
  /** totalValue / quantity. */
  unitCost: number
  /** "yyyy-mm-dd" — data da compra. */
  date: string
  note: string
}

// ---------------------------------------------------------------------------
// marketplaces
// ---------------------------------------------------------------------------
export interface Marketplace {
  workspaceId: string
  name: string
  /** Taxa percentual (ex.: 20 = 20%). */
  feePercentage: number
  /** Taxa fixa em R$ (ex.: 4). `null`/ausente = sem taxa fixa. */
  fixedFee: number | null
  isDefault: boolean
}

// ---------------------------------------------------------------------------
// semiFinishedComponents (componentes semi-acabados)
// ---------------------------------------------------------------------------
export type HumanProfile = 'operational' | 'creative'

export interface ComponentSupplyLine {
  supplyId: string
  quantity: number
  /** Snapshot do custo médio do insumo na data da composição. */
  unitCostSnapshot: number
}

export interface ComponentMachineLine {
  assetId: string
  timeMinutes: number
  /** Snapshot do custo/hora do ativo na data da composição. */
  costPerHourSnapshot: number
}

export interface ComponentLightToolLine {
  toolId: string
  timeMinutes: number
  /** Snapshot do custo/hora de mão de obra + material leve na data da composição. */
  costPerHourSnapshot: number
}

export interface SemiFinishedComponent {
  workspaceId: string
  name: string
  supplies: ComponentSupplyLine[]
  /** Lista de ativos pesados utilizados neste componente. */
  machineAssets: ComponentMachineLine[]
  /** Lista de materiais leves utilizados neste componente. */
  lightTools: ComponentLightToolLine[]
  humanProfile: HumanProfile
  /** Tempo de mão de obra em horas. */
  humanTimeHours: number
  /** Custo unitário calculado (snapshot). */
  unitCost: number
  version: number
  isArchived: boolean
}

// ---------------------------------------------------------------------------
// products (produtos finais)
// ---------------------------------------------------------------------------
export interface ProductComponentLine {
  componentId: string
  quantity: number
  /** Snapshot do custo unitário do componente na data da montagem. */
  unitCostSnapshot: number
}

export interface ProductPackagingLine {
  supplyId: string
  quantity: number
  /** Snapshot do custo médio do insumo de embalagem na data da montagem. */
  unitCostSnapshot: number
}

export interface Product {
  workspaceId: string
  name: string
  components: ProductComponentLine[]
  packaging: ProductPackagingLine[]
  finalHumanTimeHours: number
  finalHumanProfile: HumanProfile
  directCost: number
  /** Margem de lucro em % (ex.: 40 = 40%). */
  profitMargin: number
  marketplaceId: string | null
  /** Valor líquido desejado (cálculo reverso), em R$. */
  desiredNetValue: number | null
  salePrice: number
  version: number
  isArchived: boolean
  createdAt: unknown
  updatedAt: unknown
}
