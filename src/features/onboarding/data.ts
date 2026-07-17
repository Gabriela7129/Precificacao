/**
 * Dados do onboarding — membros e convites do workspace.
 *
 * O contrato da Fatia 0 (`src/services/workspaces.ts`) expõe apenas
 * `createWorkspace` e `addWorkspaceMember` (por userId). Este módulo cobre,
 * localmente, o que falta para o fluxo de convites por e-mail:
 *
 * - resolução e-mail → uid (consulta à coleção `users`, leitura permitida
 *   a qualquer usuário autenticado pelas regras);
 * - espelho `memberIds` no doc do workspace (necessário para as queries e
 *   regras de segurança — `addWorkspaceMember` sozinho não atualiza);
 * - convites pendentes: quando o e-mail ainda não tem conta, gravamos um doc
 *   na subcoleção `members` com `userId: null` e `status: 'pending'`
 *   (permitido pelas regras para membros do workspace), que pode ser
 *   reenviado (tenta resolver de novo) ou removido;
 * - listagem em tempo real e remoção de membros/convites.
 */

import { useEffect, useState } from 'react'
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { addWorkspaceMember } from '../../services/workspaces'

export type MemberStatus = 'active' | 'pending'

export interface MemberEntry {
  id: string
  /** uid do usuário; `null` em convites pendentes. */
  userId: string | null
  /** e-mail do convite pendente; `null` em membros ativos. */
  email: string | null
  role: 'owner' | 'admin'
  status: MemberStatus
}

/** Escuta em tempo real a subcoleção `workspaces/{id}/members`. */
export function useWorkspaceMembers(workspaceId: string | null): {
  members: MemberEntry[]
  loading: boolean
  error: Error | null
} {
  const [state, setState] = useState<{
    members: MemberEntry[]
    loading: boolean
    error: Error | null
  }>({ members: [], loading: true, error: null })

  useEffect(() => {
    if (!workspaceId) {
      setState({ members: [], loading: false, error: null })
      return
    }
    const ref = collection(db, 'workspaces', workspaceId, 'members')
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        const members = snap.docs.map((d): MemberEntry => {
          const data = d.data()
          return {
            id: d.id,
            userId: (data.userId ?? null) as string | null,
            email: (data.email ?? null) as string | null,
            role: data.role === 'owner' ? 'owner' : 'admin',
            status: data.status === 'pending' ? 'pending' : 'active',
          }
        })
        setState({ members, loading: false, error: null })
      },
      (err) => setState({ members: [], loading: false, error: err }),
    )
    return unsubscribe
  }, [workspaceId])

  return state
}

/** Resolve e-mail → uid consultando a coleção `users`. `null` se não houver conta. */
export async function findUserIdByEmail(email: string): Promise<string | null> {
  const normalized = email.trim().toLowerCase()
  const q = query(collection(db, 'users'), where('email', '==', normalized))
  const snap = await getDocs(q)
  return snap.empty ? null : snap.docs[0].id
}

export type InviteResult = 'added' | 'pending' | 'already-member' | 'already-invited'

/**
 * Convida um membro por e-mail (MVP: papel administrador).
 * - Se o e-mail já tem conta: adiciona como membro e espelha em `memberIds`.
 * - Se não tem conta: grava convite pendente na subcoleção `members`.
 */
export async function inviteMemberByEmail(
  workspaceId: string,
  email: string,
  currentMembers: MemberEntry[],
): Promise<InviteResult> {
  const normalized = email.trim().toLowerCase()
  const uid = await findUserIdByEmail(normalized)

  if (uid) {
    if (currentMembers.some((m) => m.userId === uid)) return 'already-member'
    await addWorkspaceMember(workspaceId, uid)
    await updateDoc(doc(db, 'workspaces', workspaceId), {
      memberIds: arrayUnion(uid),
    })
    return 'added'
  }

  if (currentMembers.some((m) => m.status === 'pending' && m.email === normalized)) {
    return 'already-invited'
  }
  await setDoc(doc(db, 'workspaces', workspaceId, 'members', `invite_${normalized}`), {
    userId: null,
    email: normalized,
    role: 'admin',
    status: 'pending',
    invitedAt: serverTimestamp(),
  })
  return 'pending'
}

/**
 * "Reenviar" convite: tenta resolver o e-mail novamente. Se a conta já
 * existir, promove a membro e remove o convite pendente.
 */
export async function resendInvite(
  workspaceId: string,
  invite: MemberEntry,
): Promise<'added' | 'still-pending'> {
  if (!invite.email) return 'still-pending'
  const uid = await findUserIdByEmail(invite.email)
  if (!uid) return 'still-pending'
  await addWorkspaceMember(workspaceId, uid)
  await updateDoc(doc(db, 'workspaces', workspaceId), {
    memberIds: arrayUnion(uid),
  })
  await deleteDoc(doc(db, 'workspaces', workspaceId, 'members', invite.id))
  return 'added'
}

/** Remove membro ativo (espelhando `memberIds`) ou convite pendente. */
export async function removeMemberOrInvite(
  workspaceId: string,
  entry: MemberEntry,
): Promise<void> {
  await deleteDoc(doc(db, 'workspaces', workspaceId, 'members', entry.id))
  if (entry.status === 'active' && entry.userId) {
    await updateDoc(doc(db, 'workspaces', workspaceId), {
      memberIds: arrayRemove(entry.userId),
    })
  }
}
