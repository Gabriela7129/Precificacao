/**
 * Serviço Firestore com escopo de workspace — CONTRATO DA FATIA 0.
 *
 * Todos os módulos (workers das próximas fatias) devem usar ESTAS funções
 * para ler e escrever dados. Nunca usar `collection(db, ...)` diretamente
 * nas páginas/hooks de módulo.
 *
 * Padrão de uso:
 *
 *   // Leitura em tempo real (listener) — dentro de um componente/hook:
 *   const { data: tools, loading } = useLightTools()
 *
 *   // Escrita — o workspaceId é injetado automaticamente:
 *   const wsId = useActiveWorkspaceId()
 *   await createLightTool(wsId, { name: 'Tesoura', purchaseValue: 45, ... })
 *   await updateLightTool(wsId, toolId, { name: 'Tesoura grande' })
 *   await deleteLightTool(wsId, toolId)
 *
 * Regras:
 * - Toda coleção é raiz (`/{collection}/{docId}`) com campo `workspaceId`.
 * - `createDoc` injeta `workspaceId` e `createdAt` (serverTimestamp).
 * - `updateDoc` injeta `updatedAt` (serverTimestamp).
 * - O hook `useWorkspaceCollection` mantém listener em tempo real e retorna
 *   `WithId<T>[]` (doc id + dados). Recargas do listener são silenciosas.
 */

import { useEffect, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc as fsDeleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc as fsUpdateDoc,
  where,
  type CollectionReference,
  type DocumentData,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useWorkspaceStore } from '../stores/workspaceStore'
import type {
  HeavyAsset,
  LightTool,
  Marketplace,
  Product,
  SemiFinishedComponent,
  Supply,
  SupplyCategory,
  SupplyEntry,
  WithId,
  WorkspaceSettings,
} from '../types'

// ---------------------------------------------------------------------------
// Catálogo de coleções (nomes canônicos do Firestore)
// ---------------------------------------------------------------------------
export const COLLECTIONS = {
  settings: 'settings',
  lightTools: 'lightTools',
  heavyAssets: 'heavyAssets',
  supplyCategories: 'supplyCategories',
  supplies: 'supplies',
  supplyEntries: 'supplyEntries',
  marketplaces: 'marketplaces',
  semiFinishedComponents: 'semiFinishedComponents',
  products: 'products',
} as const

export type WorkspaceCollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS]

// ---------------------------------------------------------------------------
// Helpers de referência
// ---------------------------------------------------------------------------
export function collectionRef(
  name: WorkspaceCollectionName,
): CollectionReference<DocumentData> {
  return collection(db, name)
}

// ---------------------------------------------------------------------------
// CRUD genérico com escopo de workspace
// ---------------------------------------------------------------------------

/** Cria um doc injetando `workspaceId` e `createdAt`. Retorna o id gerado. */
export async function createDoc<T extends object>(
  workspaceId: string,
  name: WorkspaceCollectionName,
  data: T,
): Promise<string> {
  const ref = await addDoc(collectionRef(name), {
    ...data,
    workspaceId,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

/** Atualização parcial; injeta `updatedAt`. */
export async function updateDoc<T extends object>(
  workspaceId: string,
  name: WorkspaceCollectionName,
  docId: string,
  data: Partial<T>,
): Promise<void> {
  void workspaceId // escopo já garantido pelo docId; mantido na assinatura por simetria
  await fsUpdateDoc(doc(db, name, docId), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

/** Remove o doc definitivamente. */
export async function deleteDoc(
  workspaceId: string,
  name: WorkspaceCollectionName,
  docId: string,
): Promise<void> {
  void workspaceId
  await fsDeleteDoc(doc(db, name, docId))
}

// ---------------------------------------------------------------------------
// Hook genérico de coleção (listener em tempo real)
// ---------------------------------------------------------------------------

export interface WorkspaceCollectionState<T> {
  data: WithId<T>[]
  loading: boolean
  error: Error | null
}

/**
 * Escuta em tempo real os docs de uma coleção filtrados pelo workspace ativo.
 * Se não houver workspace ativo, retorna lista vazia sem erro.
 */
export function useWorkspaceCollection<T>(
  name: WorkspaceCollectionName,
): WorkspaceCollectionState<T> {
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace)
  const workspaceId = activeWorkspace?.id ?? null
  const [state, setState] = useState<WorkspaceCollectionState<T>>({
    data: [],
    loading: true,
    error: null,
  })

  useEffect(() => {
    if (!workspaceId) {
      setState({ data: [], loading: false, error: null })
      return
    }
    setState((s) => ({ ...s, loading: true }))
    const q = query(collectionRef(name), where('workspaceId', '==', workspaceId))
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setState({
          data: snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) })),
          loading: false,
          error: null,
        })
      },
      (err) => setState({ data: [], loading: false, error: err }),
    )
    return unsubscribe
  }, [name, workspaceId])

  return state
}

/** Atalho: id do workspace ativo (null se não houver). */
export function useActiveWorkspaceId(): string | null {
  return useWorkspaceStore((s) => s.activeWorkspace?.id ?? null)
}

// ---------------------------------------------------------------------------
// Hooks tipados por coleção (atalhos para os módulos)
// ---------------------------------------------------------------------------
export const useSettings = () => useWorkspaceCollection<WorkspaceSettings>(COLLECTIONS.settings)
export const useLightTools = () => useWorkspaceCollection<LightTool>(COLLECTIONS.lightTools)
export const useHeavyAssets = () => useWorkspaceCollection<HeavyAsset>(COLLECTIONS.heavyAssets)
export const useSupplyCategories = () =>
  useWorkspaceCollection<SupplyCategory>(COLLECTIONS.supplyCategories)
export const useSupplies = () => useWorkspaceCollection<Supply>(COLLECTIONS.supplies)
export const useSupplyEntries = () => useWorkspaceCollection<SupplyEntry>(COLLECTIONS.supplyEntries)
export const useMarketplaces = () => useWorkspaceCollection<Marketplace>(COLLECTIONS.marketplaces)
export const useSemiFinishedComponents = () =>
  useWorkspaceCollection<SemiFinishedComponent>(COLLECTIONS.semiFinishedComponents)
export const useProducts = () => useWorkspaceCollection<Product>(COLLECTIONS.products)

// ---------------------------------------------------------------------------
// Funções CRUD tipadas por coleção (atalhos para os módulos)
// ---------------------------------------------------------------------------
export const createLightTool = (wsId: string, data: Omit<LightTool, 'workspaceId'>) =>
  createDoc(wsId, COLLECTIONS.lightTools, data)
export const updateLightTool = (wsId: string, id: string, data: Partial<LightTool>) =>
  updateDoc<LightTool>(wsId, COLLECTIONS.lightTools, id, data)
export const deleteLightTool = (wsId: string, id: string) =>
  deleteDoc(wsId, COLLECTIONS.lightTools, id)

export const createHeavyAsset = (wsId: string, data: Omit<HeavyAsset, 'workspaceId'>) =>
  createDoc(wsId, COLLECTIONS.heavyAssets, data)
export const updateHeavyAsset = (wsId: string, id: string, data: Partial<HeavyAsset>) =>
  updateDoc<HeavyAsset>(wsId, COLLECTIONS.heavyAssets, id, data)
export const deleteHeavyAsset = (wsId: string, id: string) =>
  deleteDoc(wsId, COLLECTIONS.heavyAssets, id)

export const createSupply = (wsId: string, data: Omit<Supply, 'workspaceId'>) =>
  createDoc(wsId, COLLECTIONS.supplies, data)
export const updateSupply = (wsId: string, id: string, data: Partial<Supply>) =>
  updateDoc<Supply>(wsId, COLLECTIONS.supplies, id, data)
export const deleteSupply = (wsId: string, id: string) => deleteDoc(wsId, COLLECTIONS.supplies, id)

export const createSupplyCategory = (wsId: string, data: Omit<SupplyCategory, 'workspaceId'>) =>
  createDoc(wsId, COLLECTIONS.supplyCategories, data)
export const updateSupplyCategory = (wsId: string, id: string, data: Partial<SupplyCategory>) =>
  updateDoc<SupplyCategory>(wsId, COLLECTIONS.supplyCategories, id, data)
export const deleteSupplyCategory = (wsId: string, id: string) =>
  deleteDoc(wsId, COLLECTIONS.supplyCategories, id)

export const createSupplyEntry = (wsId: string, data: Omit<SupplyEntry, 'workspaceId'>) =>
  createDoc(wsId, COLLECTIONS.supplyEntries, data)

export const createMarketplace = (wsId: string, data: Omit<Marketplace, 'workspaceId'>) =>
  createDoc(wsId, COLLECTIONS.marketplaces, data)
export const updateMarketplace = (wsId: string, id: string, data: Partial<Marketplace>) =>
  updateDoc<Marketplace>(wsId, COLLECTIONS.marketplaces, id, data)
export const deleteMarketplace = (wsId: string, id: string) =>
  deleteDoc(wsId, COLLECTIONS.marketplaces, id)

export const createComponent = (wsId: string, data: Omit<SemiFinishedComponent, 'workspaceId'>) =>
  createDoc(wsId, COLLECTIONS.semiFinishedComponents, data)
export const updateComponent = (
  wsId: string,
  id: string,
  data: Partial<SemiFinishedComponent>,
) => updateDoc<SemiFinishedComponent>(wsId, COLLECTIONS.semiFinishedComponents, id, data)

export const createProduct = (wsId: string, data: Omit<Product, 'workspaceId' | 'createdAt' | 'updatedAt'>) =>
  createDoc(wsId, COLLECTIONS.products, data)
export const updateProduct = (wsId: string, id: string, data: Partial<Product>) =>
  updateDoc<Product>(wsId, COLLECTIONS.products, id, data)

export const upsertSettings = (wsId: string, docId: string, data: Partial<WorkspaceSettings>) =>
  updateDoc<WorkspaceSettings>(wsId, COLLECTIONS.settings, docId, data)
export const createSettings = (wsId: string, data: Omit<WorkspaceSettings, 'workspaceId'>) =>
  createDoc(wsId, COLLECTIONS.settings, data)
