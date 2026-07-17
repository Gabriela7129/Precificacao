import { create } from 'zustand'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { WithId, Workspace } from '../types'

/** ID fixo do workspace único compartilhado por todos os usuários autorizados. */
export const FIXED_WORKSPACE_ID = 'th1su6PkVx9Gjwkdocqr'

interface WorkspaceState {
  /** Workspace único do app. */
  activeWorkspace: WithId<Workspace> | null
  /** true enquanto carrega o workspace. */
  loading: boolean
  /** Mensagem de erro da última carga (ex.: permissão negada no Firestore). */
  error: string | null
  /** Carrega o workspace único. */
  load: () => Promise<void>
  /** Chamado no logout. */
  reset: () => void
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activeWorkspace: null,
  loading: true,
  error: null,

  load: async () => {
    set({ loading: true, error: null })
    try {
      const ref = doc(db, 'workspaces', FIXED_WORKSPACE_ID)
      const snap = await getDoc(ref)

      if (!snap.exists()) {
        set({ activeWorkspace: null, loading: false, error: 'Workspace não encontrado.' })
        return
      }

      const workspace: WithId<Workspace> = {
        id: snap.id,
        ...(snap.data() as Workspace),
      }
      set({ activeWorkspace: workspace, loading: false, error: null })
    } catch (err) {
      console.error('[workspace] Falha ao carregar workspace:', err)
      const message =
        err instanceof Error ? err.message : 'Erro desconhecido ao acessar o banco de dados.'
      set({ activeWorkspace: null, loading: false, error: message })
    }
  },

  reset: () => {
    set({ activeWorkspace: null, loading: true, error: null })
  },
}))
