import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AppShell } from './components/layout/AppShell'
import { RequireAuth, RequireWorkspace } from './router/guards'
import { LoginPage } from './features/auth/LoginPage'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { useAuthStore } from './stores/authStore'
import { useWorkspaceStore } from './stores/workspaceStore'

/** Raiz: manda para o app ou para o login conforme a sessão. */
function RootRedirect() {
  const { user, loading } = useAuthStore()
  if (loading) return null
  return <Navigate to={user ? '/produtos' : '/login'} replace />
}

export default function App() {
  const init = useAuthStore((s) => s.init)
  const user = useAuthStore((s) => s.user)
  const loadWorkspaces = useWorkspaceStore((s) => s.loadForUser)
  const resetWorkspaces = useWorkspaceStore((s) => s.reset)

  // Listener de auth (uma vez).
  useEffect(() => init(), [init])

  // Carrega workspaces quando o usuário muda.
  useEffect(() => {
    if (user) void loadWorkspaces(user.uid)
    else resetWorkspaces()
  }, [user, loadWorkspaces, resetWorkspaces])

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        richColors={false}
        toastOptions={{
          className: 'bg-white border border-rose-200 text-gray-800 rounded-xl shadow-md',
        }}
      />
      <Routes>
        {/* Pública */}
        <Route path="/login" element={<LoginPage />} />

        {/* Auth (logado, sem exigir workspace) */}
        <Route
          path="/onboarding/workspace"
          element={
            <RequireAuth>
              <PlaceholderPage nome="Criar workspace" />
            </RequireAuth>
          }
        />
        <Route
          path="/onboarding/convites"
          element={
            <RequireAuth>
              <PlaceholderPage nome="Convidar membros" />
            </RequireAuth>
          }
        />

        {/* App (logado + workspace) */}
        <Route
          element={
            <RequireAuth>
              <RequireWorkspace>
                <AppShell />
              </RequireWorkspace>
            </RequireAuth>
          }
        >
          <Route path="/configuracoes" element={<PlaceholderPage nome="Configurações" />} />
          <Route path="/materiais-leves" element={<PlaceholderPage nome="Materiais Leves" />} />
          <Route path="/ativos-pesados" element={<PlaceholderPage nome="Ativos Pesados" />} />
          <Route path="/insumos" element={<PlaceholderPage nome="Insumos" />} />
          <Route path="/componentes" element={<PlaceholderPage nome="Componentes Semi-Acabados" />} />
          <Route path="/componentes/novo" element={<PlaceholderPage nome="Novo componente" />} />
          <Route path="/componentes/:id" element={<PlaceholderPage nome="Componente" />} />
          <Route path="/produtos" element={<PlaceholderPage nome="Produtos Finais" />} />
          <Route path="/produtos/arquivados" element={<PlaceholderPage nome="Produtos Arquivados" />} />
          <Route path="/produtos/novo" element={<PlaceholderPage nome="Novo produto" />} />
          <Route path="/produtos/:id" element={<PlaceholderPage nome="Produto" />} />
          <Route path="/produtos/:id/editar" element={<PlaceholderPage nome="Editar produto" />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </BrowserRouter>
  )
}
