import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { TriangleAlert, Lock } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { isEmailAllowed } from '../config/allowedEmails'
import { Skeleton } from '../components/ui/Skeleton'
import { Button } from '../components/ui'

/** Tela para contas fora da allowlist. */
function BlockedScreen({ email }: { email: string | null }) {
  const logout = useAuthStore((s) => s.logout)
  return (
    <div className="min-h-screen flex items-center justify-center bg-amber-50 p-6">
      <div className="w-full max-w-md bg-white rounded-3xl border border-rose-200 shadow-sm p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-500 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-7 h-7" />
        </div>
        <h1 className="text-lg font-bold text-gray-900 mb-2">Acesso restrito</h1>
        <p className="text-sm text-gray-500 mb-4">
          Este aplicativo é de uso interno do ateliê. A conta{' '}
          <strong>{email ?? 'desconhecida'}</strong> não está na lista de e-mails autorizados.
        </p>
        <Button variant="secondary" onClick={() => void logout()}>
          Sair e trocar de conta
        </Button>
      </div>
    </div>
  )
}

function FullScreenLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-amber-50">
      <Skeleton className="w-40 h-10" />
    </div>
  )
}

/** Tela de erro ao carregar dados do workspace. */
function WorkspaceErrorScreen({ message }: { message: string }) {
  const load = useWorkspaceStore((s) => s.load)
  const logout = useAuthStore((s) => s.logout)

  return (
    <div className="min-h-screen flex items-center justify-center bg-amber-50 p-6">
      <div className="w-full max-w-md bg-white rounded-3xl border border-rose-200 shadow-sm p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4">
          <TriangleAlert className="w-7 h-7" />
        </div>
        <h1 className="text-lg font-bold text-gray-900 mb-2">Não foi possível carregar o ateliê</h1>
        <p className="text-sm text-gray-500 mb-4">
          O app não conseguiu acessar o banco de dados. Verifique se o Firestore foi criado
          no console do Firebase e se as regras do arquivo <code>firestore.rules</code> foram
          publicadas.
        </p>
        <p className="text-xs text-gray-400 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6 break-words">
          {message}
        </p>
        <div className="flex flex-col gap-2">
          <Button onClick={() => void load()}>Tentar novamente</Button>
          <Button variant="ghost" onClick={() => void logout()}>
            Sair da conta
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Exige usuário autenticado E autorizado; caso contrário → /login ou tela de bloqueio. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuthStore()
  const location = useLocation()

  if (loading) return <FullScreenLoading />
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  if (!isEmailAllowed(user.email)) return <BlockedScreen email={user.email} />
  return <>{children}</>
}

/**
 * Exige workspace carregado.
 * Deve ser usado DENTRO de RequireAuth.
 */
export function RequireWorkspace({ children }: { children: ReactNode }) {
  const { activeWorkspace, loading, error } = useWorkspaceStore()

  if (loading) return <FullScreenLoading />
  if (error) return <WorkspaceErrorScreen message={error} />
  if (!activeWorkspace) return <WorkspaceErrorScreen message="Workspace não encontrado." />
  return <>{children}</>
}
