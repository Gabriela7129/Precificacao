import { useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Navigate, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Trash2, Users } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { FieldError, Input, Select } from '../../components/ui/Input'
import { Skeleton } from '../../components/ui/Skeleton'
import { useAuthStore } from '../../stores/authStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import {
  inviteMemberByEmail,
  removeMemberOrInvite,
  resendInvite,
  useWorkspaceMembers,
  type MemberEntry,
} from './data'
import { inviteRowsSchema, type InviteRowsValues } from './schemas'

/** Linha da lista de membros/convites com Badge de papel e ações. */
function MemberRow({
  workspaceId,
  entry,
  isSelf,
}: {
  workspaceId: string
  entry: MemberEntry
  isSelf: boolean
}) {
  const [busy, setBusy] = useState(false)
  const isPending = entry.status === 'pending'
  const label = isPending ? (entry.email ?? 'Convite pendente') : (entry.userId ?? '')

  const handleResend = async () => {
    setBusy(true)
    try {
      const result = await resendInvite(workspaceId, entry)
      if (result === 'added') toast.success('Membro adicionado ao workspace')
      else toast.info('Este e-mail ainda não criou uma conta. O convite continua pendente.')
    } catch {
      toast.error('Não foi possível reenviar. Tente novamente.')
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async () => {
    setBusy(true)
    try {
      await removeMemberOrInvite(workspaceId, entry)
      toast.success(isPending ? 'Convite removido' : 'Membro removido')
    } catch {
      toast.error('Não foi possível remover. Tente novamente.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="flex items-center gap-3 py-2">
      <span className="flex-1 truncate text-sm text-gray-700">{label}</span>
      {isPending ? (
        <Badge variant="muted">Convite pendente</Badge>
      ) : entry.role === 'owner' ? (
        <Badge variant="amber">Proprietário</Badge>
      ) : (
        <Badge variant="rose">Administrador</Badge>
      )}
      {isPending && (
        <Button variant="ghost" className="text-xs" onClick={() => void handleResend()} loading={busy}>
          Reenviar
        </Button>
      )}
      {(isPending || entry.role !== 'owner') && !isSelf && (
        <button
          type="button"
          aria-label="Remover"
          disabled={busy}
          onClick={() => void handleRemove()}
          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-rose-50 transition disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </li>
  )
}

/**
 * /onboarding/convites — convida membros por e-mail (todos administradores
 * no MVP), lista membros atuais e convites pendentes. "Criar workspace" ou
 * "Pular" levam para /produtos.
 */
export function OnboardingConvitesPage() {
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace)
  const workspaceLoading = useWorkspaceStore((s) => s.loading)
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const { members, loading: membersLoading } = useWorkspaceMembers(activeWorkspace?.id ?? null)
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<InviteRowsValues>({
    resolver: zodResolver(inviteRowsSchema),
    mode: 'onBlur',
    defaultValues: { rows: [{ email: '' }] },
  })
  const { fields, append } = useFieldArray({ control, name: 'rows' })

  if (!workspaceLoading && !activeWorkspace) {
    return <Navigate to="/onboarding/workspace" replace />
  }

  const onSubmit = async (values: InviteRowsValues) => {
    if (!activeWorkspace) return
    const emails = values.rows.map((r) => r.email.trim()).filter((e) => e !== '')
    setSubmitting(true)
    try {
      let added = 0
      let pending = 0
      for (const email of emails) {
        const result = await inviteMemberByEmail(activeWorkspace.id, email, members, activeWorkspace.name)
        if (result === 'added') added += 1
        else if (result === 'pending') pending += 1
      }
      if (added > 0) toast.success(`${added} membro(s) adicionado(s)`)
      if (pending > 0)
        toast.info(`${pending} convite(s) pendente(s): o acesso é liberado quando a pessoa entrar com o Google.`)
      navigate('/produtos', { replace: true })
    } catch {
      toast.error('Não foi possível enviar os convites. Tente novamente.')
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-amber-50">
      <div className="w-full max-w-md bg-white rounded-3xl border border-rose-200 shadow-lg p-8">
        <h1 className="text-2xl font-bold text-gray-900">Convidar membros</h1>
        <p className="text-sm text-gray-500 mt-1 mb-6">
          Adicione contas pessoais para colaborar. Neste primeiro momento, todos terão perfil de
          administrador.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-3">
            {fields.map((field, index) => (
              <div key={field.id}>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Input
                      type="email"
                      placeholder="email@exemplo.com"
                      autoFocus={index === 0}
                      error={!!errors.rows?.[index]?.email}
                      {...register(`rows.${index}.email`)}
                    />
                  </div>
                  <Select disabled className="w-36 bg-gray-100 text-gray-500" value="admin" onChange={() => undefined}>
                    <option value="admin">Administrador</option>
                  </Select>
                </div>
                {errors.rows?.[index]?.email && (
                  <FieldError>{errors.rows[index]?.email?.message}</FieldError>
                )}
              </div>
            ))}
          </div>

          <div>
            <Button
              type="button"
              variant="ghost"
              onClick={() => append({ email: '' })}
            >
              + Adicionar outro e-mail
            </Button>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1" loading={submitting}>
              Criar workspace
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              disabled={submitting}
              onClick={() => navigate('/produtos', { replace: true })}
            >
              Pular
            </Button>
          </div>
        </form>

        {/* Membros atuais e convites pendentes */}
        <div className="mt-8 border-t border-rose-100 pt-6">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-gray-500" />
            Membros do workspace
          </h2>
          {membersLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : members.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum membro ainda.</p>
          ) : (
            <ul className="divide-y divide-rose-100">
              {members.map((m) => (
                <MemberRow
                  key={m.id}
                  workspaceId={activeWorkspace!.id}
                  entry={m}
                  isSelf={m.userId === user?.uid}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
