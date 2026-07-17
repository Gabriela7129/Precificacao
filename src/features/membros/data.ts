/**
 * Dados da página Equipe (gestão de membros) e do fluxo de aceite de convites.
 *
 * Reutiliza a camada de membros/convites de `../onboarding/data` (listagem do
 * workspace, convite por e-mail, reenvio e remoção). Este módulo cobre o lado
 * do CONVIDADO:
 *
 * - `useMyPendingInvites`: descobre convites pendentes endereçados ao e-mail
 *   do usuário logado via `collectionGroup('members')` — permitido pelas
 *   regras (qualquer logado lista docs onde `email == token.email.lower()`);
 * - `acceptInvite`: batch atômico que cria o doc de membro, se auto-adiciona
 *   a `memberIds` e apaga o convite pendente (cada passo permitido pelas
 *   regras para o convidado);
 * - `useUserProfiles`: resolve `users/{uid}` (leitura liberada a qualquer
 *   logado) para exibir nome/foto dos membros ativos.
 */

import { useEffect, useState } from 'react'
import {
  arrayUnion,
  collectionGroup,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore'
import { toast } from 'sonner'
import { db } from '../../lib/firebase'
import { useAuthStore } from '../../stores/authStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'

// ---------------------------------------------------------------------------
// Convites pendentes endereçados ao usuário logado
// ---------------------------------------------------------------------------

export interface PendingInviteEntry {
  /** id do doc do convite (`invite_<email>`). */
  inviteId: string
  /** workspace dono do convite (extraído do path do doc). */
  workspaceId: string
  /** Nome do workspace, quando gravado no convite. */
  workspaceName?: string
  email: string
}

/**
 * Escuta em tempo real os convites pendentes para `email` (normalizado com
 * trim + lowercase). A query usa UM único `where('email', '==', ...)`; o
 * filtro `status === 'pending'` é feito no cliente. E-mail `null` retorna
 * lista vazia (usuário deslogado ou sem e-mail).
 */
export function useMyPendingInvites(email: string | null): {
  invites: PendingInviteEntry[]
  loading: boolean
  error: Error | null
} {
  const normalized = email?.trim().toLowerCase() ?? null
  const [state, setState] = useState<{
    invites: PendingInviteEntry[]
    loading: boolean
    error: Error | null
  }>({ invites: [], loading: normalized !== null, error: null })

  useEffect(() => {
    if (!normalized) {
      setState({ invites: [], loading: false, error: null })
      return
    }
    setState((s) => ({ ...s, loading: true }))
    const q = query(collectionGroup(db, 'members'), where('email', '==', normalized))
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const invites = snap.docs
          .filter((d) => d.data().status === 'pending')
          .map((d): PendingInviteEntry | null => {
            const workspaceId = d.ref.parent.parent?.id
            if (!workspaceId) return null
            const data = d.data()
            return {
              inviteId: d.id,
              workspaceId,
              workspaceName:
                typeof data.workspaceName === 'string' ? data.workspaceName : undefined,
              email: (data.email ?? normalized) as string,
            }
          })
          .filter((i): i is PendingInviteEntry => i !== null)
        setState({ invites, loading: false, error: null })
      },
      (err) => setState({ invites: [], loading: false, error: err }),
    )
    return unsubscribe
  }, [normalized])

  return state
}

// ---------------------------------------------------------------------------
// Aceite de convite
// ---------------------------------------------------------------------------

/**
 * Aceita um convite pendente em batch atômico:
 * 1. cria `workspaces/{wsId}/members/{uid}` (papel admin, como no convite);
 * 2. adiciona o uid a `memberIds` do workspace (única escrita de workspace
 *    permitida a não-membros, exige o convite pendente);
 * 3. apaga o doc do convite.
 */
export async function acceptInvite(
  invite: { inviteId: string; workspaceId: string; email: string },
  uid: string,
): Promise<void> {
  const batch = writeBatch(db)
  batch.set(doc(db, 'workspaces', invite.workspaceId, 'members', uid), {
    userId: uid,
    role: 'admin',
    joinedAt: serverTimestamp(),
  })
  batch.update(doc(db, 'workspaces', invite.workspaceId), {
    memberIds: arrayUnion(uid),
  })
  batch.delete(doc(db, 'workspaces', invite.workspaceId, 'members', invite.inviteId))
  await batch.commit()
}

/**
 * Fluxo completo de aceite, pronto para botões: batch → recarrega os
 * workspaces do usuário → ativa o workspace do convite. Retorna `true` em
 * caso de sucesso (o chamador normalmente navega para `/produtos`).
 */
export function useAcceptInviteFlow(): (invite: PendingInviteEntry) => Promise<boolean> {
  const user = useAuthStore((s) => s.user)
  const loadForUser = useWorkspaceStore((s) => s.loadForUser)
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace)

  return async (invite) => {
    if (!user) return false
    try {
      await acceptInvite(invite, user.uid)
      await loadForUser(user.uid)
      setActiveWorkspace(invite.workspaceId)
      toast.success('Você entrou no workspace!')
      return true
    } catch {
      toast.error('Não foi possível aceitar o convite. Tente novamente.')
      return false
    }
  }
}

// ---------------------------------------------------------------------------
// Perfis de usuários (membros ativos)
// ---------------------------------------------------------------------------

export interface UserProfile {
  uid: string
  displayName: string | null
  email: string | null
  photoURL: string | null
}

/**
 * Resolve docs `users/{uid}` para os ids informados (leitura permitida a
 * qualquer usuário logado). Retorna um mapa uid → perfil; uids sem doc ou
 * com erro de leitura são omitidos.
 */
export function useUserProfiles(userIds: string[]): {
  profiles: Record<string, UserProfile>
  loading: boolean
} {
  const key = userIds.slice().sort().join(',')
  const [state, setState] = useState<{
    profiles: Record<string, UserProfile>
    loading: boolean
  }>({ profiles: {}, loading: key !== '' })

  useEffect(() => {
    const ids = key === '' ? [] : key.split(',')
    if (ids.length === 0) {
      setState({ profiles: {}, loading: false })
      return
    }
    let cancelled = false
    setState((s) => ({ ...s, loading: true }))
    void (async () => {
      const entries = await Promise.all(
        ids.map(async (uid) => {
          try {
            const snap = await getDoc(doc(db, 'users', uid))
            if (!snap.exists()) return null
            const data = snap.data()
            const profile: UserProfile = {
              uid,
              displayName: (data.displayName ?? null) as string | null,
              email: (data.email ?? null) as string | null,
              photoURL: (data.photoURL ?? null) as string | null,
            }
            return [uid, profile] as const
          } catch {
            return null
          }
        }),
      )
      if (cancelled) return
      const profiles: Record<string, UserProfile> = {}
      for (const entry of entries) {
        if (entry) profiles[entry[0]] = entry[1]
      }
      setState({ profiles, loading: false })
    })()
    return () => {
      cancelled = true
    }
  }, [key])

  return state
}
