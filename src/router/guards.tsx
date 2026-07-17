import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { Skeleton } from '../components/ui/Skeleton'

function FullScreenLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-amber-50">
      <Skeleton className="w-40 h-10" />
    </div>
  )
}

/** Exige usuário autenticado; caso contrário → /login. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuthStore()
  const location = useLocation()

  if (loading) return <FullScreenLoading />
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  return <>{children}</>
}

/**
 * Exige workspace ativo; usuário logado sem workspace → /onboarding/workspace.
 * Deve ser usado DENTRO de RequireAuth.
 */
export function RequireWorkspace({ children }: { children: ReactNode }) {
  const { user } = useAuthStore()
  const { activeWorkspace, loading } = useWorkspaceStore()

  if (!user) return <Navigate to="/login" replace />
  if (loading) return <FullScreenLoading />
  if (!activeWorkspace) return <Navigate to="/onboarding/workspace" replace />
  return <>{children}</>
}
