import { create } from 'zustand'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { WithId, Workspace } from '../types'

const STORAGE_KEY = 'precificador.activeWorkspaceId'

interface WorkspaceState {
  /** Workspaces dos quais o usuário logado é membro. */
  workspaces: WithId<Workspace>[]
  /** Workspace ativo no momento (persistido em localStorage). */
  activeWorkspace: WithId<Workspace> | null
  /** true enquanto carrega os workspaces do usuário. */
  loading: boolean
  /** Mensagem de erro da última carga (ex.: permissão negada no Firestore). */
  error: string | null
  /** Carrega os workspaces do usuário e define o ativo. */
  loadForUser: (uid: string) => Promise<void>
  setActiveWorkspace: (workspaceId: string) => void
  /** Chamado no logout. */
  reset: () => void
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  activeWorkspace: null,
  loading: true,
  error: null,

  loadForUser: async (uid) => {
    set({ loading: true, error: null })
    try {
      const q = query(collection(db, 'workspaces'), where('memberIds', 'array-contains', uid))
      const snap = await getDocs(q)
      const workspaces = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Workspace) }))

      const savedId = localStorage.getItem(STORAGE_KEY)
      const active =
        workspaces.find((w) => w.id === savedId) ?? workspaces[0] ?? null

      set({ workspaces, activeWorkspace: active, loading: false })
    } catch (err) {
      console.error('[workspace] Falha ao carregar workspaces:', err)
      const message =
        err instanceof Error ? err.message : 'Erro desconhecido ao acessar o banco de dados.'
      set({ workspaces: [], activeWorkspace: null, loading: false, error: message })
    }
  },

  setActiveWorkspace: (workspaceId) => {
    const active = get().workspaces.find((w) => w.id === workspaceId) ?? null
    if (active) {
      localStorage.setItem(STORAGE_KEY, active.id)
      set({ activeWorkspace: active })
    }
  },

  reset: () => {
    localStorage.removeItem(STORAGE_KEY)
    set({ workspaces: [], activeWorkspace: null, loading: true, error: null })
  },
}))
