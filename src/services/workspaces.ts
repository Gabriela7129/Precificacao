/**
 * Serviços de workspace: criação, membros e seeds iniciais.
 */

import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { DEFAULT_LIGHT_MAINTENANCE_RATE } from '../lib/calculations'
import type { SupplyCategory } from '../types'

/** Categorias padrão de insumos (documento de requisitos, Módulo 3). */
export const DEFAULT_SUPPLY_CATEGORIES = [
  'Papéis',
  'Fios e linhas',
  'Cola',
  'Tecidos',
  'Ferragens',
  'Embalagens',
  'Tinta e vernizes',
  'Laminações',
]

/** Marketplaces pré-semente (documento de requisitos, Módulo 5). */
export const DEFAULT_MARKETPLACES = [
  { name: 'Shopee', feePercentage: 20, fixedFee: 4, isDefault: true },
  { name: 'Mercado Livre', feePercentage: 20, fixedFee: null, isDefault: false },
  { name: 'Nuvemshop', feePercentage: 1, fixedFee: null, isDefault: false },
]

/**
 * Cria um workspace com:
 * - doc `workspaces/{id}` (com memberIds para regras/queries)
 * - membro owner na subcoleção `workspaces/{id}/members`
 * - doc `settings` com defaults
 * - categorias de insumo padrão
 * - marketplaces pré-semente
 *
 * Retorna o id do workspace criado.
 */
export async function createWorkspace(name: string, ownerId: string): Promise<string> {
  const workspaceRef = await addDoc(collection(db, 'workspaces'), {
    name,
    ownerId,
    memberIds: [ownerId],
    createdAt: serverTimestamp(),
  })
  const workspaceId = workspaceRef.id

  const batch = writeBatch(db)

  // Membro owner (MVP: todos os membros são administradores).
  batch.set(doc(db, 'workspaces', workspaceId, 'members', ownerId), {
    userId: ownerId,
    role: 'owner',
    joinedAt: serverTimestamp(),
  })

  // Settings com defaults (calculadora de hora começa zerada).
  batch.set(doc(collection(db, 'settings')), {
    workspaceId,
    desiredSalary: 0,
    productiveHoursPerWeek: 0,
    hourlyOperational: 0,
    hourlyCreative: 0,
    electricityRate: null,
    lightMaintenanceRate: DEFAULT_LIGHT_MAINTENANCE_RATE,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  })

  // Categorias padrão de insumos.
  DEFAULT_SUPPLY_CATEGORIES.forEach((categoryName, index) => {
    const category: Omit<SupplyCategory, 'workspaceId'> & { workspaceId?: string } = {
      name: categoryName,
      isDefault: true,
      order: index,
    }
    batch.set(doc(collection(db, 'supplyCategories')), {
      ...category,
      workspaceId,
      createdAt: serverTimestamp(),
    })
  })

  // Marketplaces pré-semente.
  DEFAULT_MARKETPLACES.forEach((marketplace) => {
    batch.set(doc(collection(db, 'marketplaces')), {
      ...marketplace,
      workspaceId,
      createdAt: serverTimestamp(),
    })
  })

  await batch.commit()
  return workspaceId
}

/**
 * Convida um membro pelo userId (MVP: papel administrador).
 * O e-mail → uid é resolvido na fatia de onboarding; este helper apenas grava.
 */
export async function addWorkspaceMember(workspaceId: string, userId: string): Promise<void> {
  await setDoc(doc(db, 'workspaces', workspaceId, 'members', userId), {
    userId,
    role: 'admin',
    joinedAt: serverTimestamp(),
  })
}
