import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '../../components/ui/Button'
import { FieldError, FieldHint, FieldLabel, Input } from '../../components/ui/Input'
import { Logo } from '../../components/ui/Logo'
import { createWorkspace } from '../../services/workspaces'
import { useAuthStore } from '../../stores/authStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import {
  useAcceptInviteFlow,
  useMyPendingInvites,
  type PendingInviteEntry,
} from '../membros/data'
import { workspaceFormSchema, type WorkspaceFormValues } from './schemas'

/**
 * /onboarding/workspace — criação do workspace (nome do ateliê).
 * Cria workspace + seeds (settings, categorias, marketplaces), define o
 * workspace ativo no store e segue para o convite de membros.
 *
 * Se houver convites pendentes para o e-mail do usuário, eles aparecem em
 * destaque acima do formulário: aceitar leva direto para /produtos.
 */
export function OnboardingWorkspacePage() {
  const user = useAuthStore((s) => s.user)
  const loadForUser = useWorkspaceStore((s) => s.loadForUser)
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace)
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const { invites } = useMyPendingInvites(user?.email ?? null)
  const acceptFlow = useAcceptInviteFlow()
  const [acceptingId, setAcceptingId] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<WorkspaceFormValues>({
    resolver: zodResolver(workspaceFormSchema),
    mode: 'onBlur',
    defaultValues: { name: '' },
  })

  const onSubmit = async (values: WorkspaceFormValues) => {
    if (!user) return
    setSubmitting(true)
    try {
      const workspaceId = await createWorkspace(values.name.trim(), user.uid)
      await loadForUser(user.uid)
      setActiveWorkspace(workspaceId)
      toast.success('Workspace criado com sucesso')
      navigate('/onboarding/convites', { replace: true })
    } catch {
      toast.error('Não foi possível salvar. Tente novamente.')
      setSubmitting(false)
    }
  }

  const handleAccept = async (invite: PendingInviteEntry) => {
    setAcceptingId(invite.inviteId)
    const ok = await acceptFlow(invite)
    if (ok) navigate('/produtos')
    else setAcceptingId(null)
  }

  const hasInvites = invites.length > 0

  // Aceite automático: usuário convidado cai direto no workspace, sem clique.
  // Executa uma única vez (guard via ref); se falhar, o card manual aparece.
  const autoAcceptTried = useRef(false)
  useEffect(() => {
    if (autoAcceptTried.current) return
    if (!user || invites.length === 0) return
    autoAcceptTried.current = true
    void handleAccept(invites[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, invites])

  // Enquanto o aceite automático está em andamento, mostra tela de entrada.
  if (hasInvites && acceptingId !== null) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-amber-50">
        <div className="w-full max-w-md bg-white rounded-3xl border border-rose-200 shadow-lg p-8 text-center">
          <div className="flex justify-center mb-6">
            <Logo size="lg" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            Entrando em {invites[0]?.workspaceName ?? 'seu workspace'}...
          </h1>
          <p className="text-sm text-gray-500">Preparando tudo para você 🎀</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-amber-50">
      <div className="w-full max-w-md space-y-6">
        {/* Convites pendentes para o e-mail do usuário */}
        {hasInvites && (
          <div className="bg-amber-100 rounded-3xl border border-amber-300 shadow-lg p-8">
            <h2 className="text-xl font-bold text-amber-900 mb-1">🎉 Você foi convidado(a)!</h2>
            <p className="text-sm text-amber-800 mb-4">
              Aceite para entrar no workspace e começar a colaborar.
            </p>
            <ul className="space-y-3">
              {invites.map((invite) => (
                <li key={invite.inviteId} className="flex items-center gap-3">
                  <span className="flex-1 truncate text-sm font-medium text-amber-900">
                    {invite.workspaceName ?? 'Workspace'}
                  </span>
                  <Button
                    onClick={() => void handleAccept(invite)}
                    loading={acceptingId === invite.inviteId}
                    disabled={acceptingId !== null}
                  >
                    Aceitar
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Criar o próprio workspace */}
        <div className="w-full bg-white rounded-3xl border border-rose-200 shadow-lg p-8">
          {hasInvites ? (
            <h1 className="text-lg font-semibold text-gray-700 text-center mb-6">
              Ou crie seu próprio workspace
            </h1>
          ) : (
            <>
              <div className="flex justify-center mb-6">
                <Logo size="lg" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 text-center">Criar workspace</h1>
              <p className="text-sm text-gray-500 text-center mt-1 mb-8">Nome do ateliê ou empresa</p>
            </>
          )}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div>
              <FieldLabel htmlFor="workspace-name">Nome do workspace</FieldLabel>
              <Input
                id="workspace-name"
                placeholder="Ex.: Ateliê da Gabi"
                autoFocus
                error={!!errors.name}
                {...register('name')}
              />
              {errors.name ? (
                <FieldError>{errors.name.message}</FieldError>
              ) : (
                <FieldHint>Você poderá convidar outras pessoas na próxima etapa.</FieldHint>
              )}
            </div>
            <Button type="submit" className="w-full" loading={submitting}>
              Continuar
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
