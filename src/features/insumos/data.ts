/**
 * Helpers de dados locais do módulo de Insumos.
 *
 * Complementa o contrato de `src/services/firestore.ts` com a operação
 * composta "registrar entrada de estoque" (atualiza insumo + cria
 * supplyEntry em batch atômico). Não edita `src/services/`.
 */

import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { weightedAverageCost } from '../../lib/calculations'
import { COLLECTIONS } from '../../services/firestore'
import type { Supply, WithId } from '../../types'

export interface SupplyEntryInput {
  quantity: number
  totalValue: number
  /** "yyyy-mm-dd" — data da compra. */
  date: string
  note: string
}

export interface SupplyEntryResult {
  unitCost: number
  newAverageCost: number
  newStock: number
}

/**
 * Registra uma entrada de estoque em batch atômico:
 * - recalcula o custo médio ponderado (fórmula de `src/lib/calculations.ts`)
 * - atualiza `currentStock`, `averageCost` e `totalStockValue` do insumo
 * - cria o documento em `supplyEntries`
 */
export async function registerSupplyEntry(
  workspaceId: string,
  supply: WithId<Supply>,
  input: SupplyEntryInput,
): Promise<SupplyEntryResult> {
  const unitCost = input.totalValue / input.quantity
  const newAverageCost = weightedAverageCost(
    supply.currentStock,
    supply.averageCost,
    input.quantity,
    input.totalValue,
  )
  const newStock = supply.currentStock + input.quantity

  const batch = writeBatch(db)
  batch.update(doc(db, COLLECTIONS.supplies, supply.id), {
    currentStock: newStock,
    averageCost: newAverageCost,
    totalStockValue: newStock * newAverageCost,
    updatedAt: serverTimestamp(),
  })
  batch.set(doc(collection(db, COLLECTIONS.supplyEntries)), {
    workspaceId,
    supplyId: supply.id,
    quantity: input.quantity,
    totalValue: input.totalValue,
    unitCost,
    date: input.date,
    note: input.note,
    createdAt: serverTimestamp(),
  })
  await batch.commit()

  return { unitCost, newAverageCost, newStock }
}

/** Data local de hoje como "yyyy-mm-dd" (fuso do usuário, não UTC). */
export function todayYmd(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}
