import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { Copy, Mail, Trash2, Users } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { FieldError, FieldHint, FieldLabel, Input } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { Skeleton } from '../../components/ui/Skeleton'
import { useActiveWorkspaceId } from '../../services/firestore'
import { useAuthStore } from '../../stores/authStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import {
  inviteMemberByEmail,
  removeMemberOrInvite,
  resendInvite,
  useWorkspaceMembers,
  type MemberEntry,
} from '../onboarding/data'
import {
  useAcceptInviteFlow,
  useMyPendingInvites,
  useUserProfiles,
  type PendingInviteEntry,
  type UserProfile,
} from './data'

const inviteEmailSchema = z.string().trim().email('E-mail inválido')

// ---------------------------------------------------------------------------
// Card 1 — Convidar por e-mail
// ---------------------------------------------------------------------------

function InviteByEmailCard({
  workspaceId,
  workspaceName,
  members,
}: {
  workspaceId: string
  workspaceName: string
  members: MemberEntry[]
}) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = inviteEmailSchema.safeParse(email)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'E-mail inválido')
      return
    }
    setError(null)
    setBusy(true)
    try {
      const result = await inviteMemberByEmail(workspaceId, parsed.data, members, workspaceName)
      if (result === 'added') {
        toast.success('Membro adicionado')
        setEmail('')
      } else if (result === 'pending') {
        toast.success('Convite registrado — aparecerá para a pessoa quando ela entrar')
        setEmail('')
      } else if (result === 'already-member') {
        toast.info('Este e-mail já é membro do workspace')
      } else {
        toast.info('Este e-mail já tem um convite pendente')
      }
    } catch {
      toast.error('Não foi possível enviar o convite. Tente novamente.')
    } finally {
      setBusy(false)
    }
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin)
      toast.success('Link copiado')
    } catch {
      toast.error('Não foi possível copiar o link.')
    }
  }

  return (
    <Card>
      <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
        <Mail className="w-4 h-4 text-gray-500" />
        Convidar por e-mail
      </h2>
      <form onSubmit={(e) => void handleInvite(e)} noValidate>
        <FieldLabel htmlFor="invite-email">E-mail</FieldLabel>
        <div className="flex gap-3">
          <div className="flex-1">
            <Input
              id="invite-email"
              type="email"
              placeholder="email@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={!!error}
            />
          </div>
          <Button type="submit" loading={busy}>
            Convidar
          </Button>
        </div>
        {error ? (
          <FieldError>{error}</FieldError>
        ) : (
          <FieldHint>
            A pessoa deve entrar no app com a conta Google dela — o convite aparecerá
            automaticamente.
          </FieldHint>
        )}
      </form>
      <div className="mt-3 border-t border-rose-100 pt-3">
        <Button variant="ghost" onClick={() => void handleCopyLink()}>
          <Copy className="w-4 h-4" />
          Copiar link do app
        </Button>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Avatar (foto do Google ou inicial)
// ---------------------------------------------------------------------------

function Avatar({ profile, fallback }: { profile?: UserProfile; fallback: string }) {
  const name = profile?.displayName ?? profile?.email ?? fallback
  if (profile?.photoURL) {
    return (
      <img
        src={profile.photoURL}
        alt=""
        referrerPolicy="no-referrer"
        className="w-8 h-8 rounded-full flex-shrink-0"
      />
    )
  }
  return (
    <span className="w-8 h-8 rounded-full bg-amber-200 flex items-center justify-center text-sm font-medium text-amber-900 flex-shrink-0">
      {name.charAt(0).toUpperCase()}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Card 2 — Membros ativos
// ---------------------------------------------------------------------------

function ActiveMembersCard({
  workspaceId,
  members,
  loading,
  currentUserId,
}: {
  workspaceId: string
  members: MemberEntry[]
  loading: boolean
  currentUserId: string | undefined
}) {
  const [removing, setRemoving] = useState<MemberEntry | null>(null)
  const [busy, setBusy] = useState(false)
  const userIds = members.map((m) => m.userId).filter((id): id is string => id !== null)
  const { profiles, loading: profilesLoading } = useUserProfiles(userIds)

  const handleRemove = async () => {
    if (!removing) return
    setBusy(true)
    try {
      await removeMemberOrInvite(workspaceId, removing)
      toast.success('Membro removido')
      setRemoving(null)
    } catch {
      toast.error('Não foi possível remover. Tente novamente.')
    } finally {
      setBusy(false)
    }
  }

  const removingName = removing?.userId
    ? (profiles[removing.userId]?.displayName ?? profiles[removing.userId]?.email ?? removing.userId)
    : ''

  return (
    <Card>
      <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-2">
        <Users className="w-4 h-4 text-gray-500" />
        Membros ativos
      </h2>
      {loading || profilesLoading ? (
        <div className="space-y-2 mt-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : members.length === 0 ? (
        <p className="text-sm text-gray-500 mt-4">Nenhum membro ativo ainda.</p>
      ) : (
        <ul className="divide-y divide-rose-100">
          {members.map((m) => {
            const profile = m.userId ? profiles[m.userId] : undefined
            const name = profile?.displayName ?? profile?.email ?? m.userId ?? ''
            const isOwner = m.role === 'owner'
            const isSelf = m.userId === currentUserId
            return (
              <li key={m.id} className="flex items-center gap-3 py-3">
                <Avatar profile={profile} fallback={name} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                  {profile?.displayName && profile.email && (
                    <p className="text-xs text-gray-500 truncate">{profile.email}</p>
                  )}
                </div>
                {isOwner ? (
                  <Badge variant="amber">Proprietário</Badge>
                ) : (
                  <Badge variant="rose">Administrador</Badge>
                )}
                {!isOwner && !isSelf && (
                  <button
                    type="button"
                    aria-label="Remover membro"
                    onClick={() => setRemoving(m)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-rose-50 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        onConfirm={() => void handleRemove()}
        title="Remover membro?"
        body={`Esta ação não pode ser desfeita. ${removingName} perderá o acesso ao workspace.`}
        confirmLabel="Remover"
        loading={busy}
      />
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Card 3 — Convites pendentes (enviados pelo workspace)
// ---------------------------------------------------------------------------

function PendingInvitesCard({
  workspaceId,
  invites,
  loading,
}: {
  workspaceId: string
  invites: MemberEntry[]
  loading: boolean
}) {
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [removing, setRemoving] = useState<MemberEntry | null>(null)
  const [removingBusy, setRemovingBusy] = useState(false)

  const handleResend = async (entry: MemberEntry) => {
    setResendingId(entry.id)
    try {
      const result = await resendInvite(workspaceId, entry)
      if (result === 'added') toast.success('Membro adicionado ao workspace')
      else toast.info('Este e-mail ainda não criou uma conta. O convite continua pendente.')
    } catch {
      toast.error('Não foi possível reenviar. Tente novamente.')
    } finally {
      setResendingId(null)
    }
  }

  const handleRemove = async () => {
    if (!removing) return
    setRemovingBusy(true)
    try {
      await removeMemberOrInvite(workspaceId, removing)
      toast.success('Convite removido')
      setRemoving(null)
    } catch {
      toast.error('Não foi possível remover. Tente novamente.')
    } finally {
      setRemovingBusy(false)
    }
  }

  return (
    <Card>
      <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-2">
        <Mail className="w-4 h-4 text-gray-500" />
        Convites pendentes
      </h2>
      {loading ? (
        <div className="space-y-2 mt-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : invites.length === 0 ? (
        <p className="text-sm text-gray-500 mt-4">Nenhum convite pendente.</p>
      ) : (
        <ul className="divide-y divide-rose-100">
          {invites.map((entry) => (
            <li key={entry.id} className="flex items-center gap-3 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700 truncate">{entry.email}</p>
                <p className="text-xs text-gray-500">Aguardando a pessoa entrar no app</p>
              </div>
              <Button
                variant="ghost"
                className="text-xs"
                onClick={() => void handleResend(entry)}
                loading={resendingId === entry.id}
                disabled={resendingId !== null}
              >
                Reenviar
              </Button>
              <button
                type="button"
                aria-label="Remover convite"
                onClick={() => setRemoving(entry)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-rose-50 transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        onConfirm={() => void handleRemove()}
        title="Remover convite?"
        body={`Esta ação não pode ser desfeita. O convite para ${removing?.email ?? ''} será removido permanentemente.`}
        confirmLabel="Remover"
        loading={removingBusy}
      />
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Página /membros — Equipe
// ---------------------------------------------------------------------------

/**
 * /membros — gestão da equipe do workspace: convidar por e-mail, membros
 * ativos, convites pendentes enviados e convites recebidos pelo usuário.
 * Sem ação primária no cabeçalho (cada card tem a sua).
 */
export function MembrosPage() {
  const user = useAuthStore((s) => s.user)
  const wsId = useActiveWorkspaceId()
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace)
  const navigate = useNavigate()
  const { members, loading: membersLoading } = useWorkspaceMembers(wsId)
  const { invites: myInvites } = useMyPendingInvites(user?.email ?? null)
  const acceptFlow = useAcceptInviteFlow()
  const [acceptingId, setAcceptingId] = useState<string | null>(null)

  if (!wsId) return null // RequireWorkspace garante workspace ativo

  const activeMembers = members.filter((m) => m.status === 'active')
  const pendingInvites = members.filter((m) => m.status === 'pending')

  const handleAccept = async (invite: PendingInviteEntry) => {
    setAcceptingId(invite.inviteId)
    const ok = await acceptFlow(invite)
    if (ok) navigate('/produtos')
    else setAcceptingId(null)
  }

  return (
    <div>
      <PageHeader title="Equipe" />

      <div className="space-y-6">
        {/* Card 4 — Convites para você (sempre que houver) */}
        {myInvites.length > 0 && (
          <div className="bg-amber-100 p-6 rounded-3xl shadow-sm border border-amber-300">
            <h2 className="font-semibold text-amber-900 mb-1">Convites para você</h2>
            <p className="text-sm text-amber-800 mb-4">
              Você foi convidado(a) para colaborar nestes workspaces.
            </p>
            <ul className="space-y-3">
              {myInvites.map((invite) => (
                <li key={invite.inviteId} className="flex items-center gap-3">
                  <span className="flex-1 truncate text-sm font-medium text-amber-900">
                    {invite.workspaceName ?? 'Workspace'}
                  </span>
                  <Button
                    onClick={() => void handleAccept(invite)}
                    loading={acceptingId === invite.inviteId}
                    disabled={acceptingId !== null}
                  >
                    Aceitar convite
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <InviteByEmailCard
            workspaceId={wsId}
            workspaceName={activeWorkspace?.name ?? ''}
            members={members}
          />
          <PendingInvitesCard workspaceId={wsId} invites={pendingInvites} loading={membersLoading} />
        </div>

        <ActiveMembersCard
          workspaceId={wsId}
          members={activeMembers}
          loading={membersLoading}
          currentUserId={user?.uid}
        />
      </div>
    </div>
  )
}
