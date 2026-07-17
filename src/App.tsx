import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AppShell } from './components/layout/AppShell'
import { RequireAuth, RequireWorkspace } from './router/guards'
import { LoginPage } from './features/auth/LoginPage'
import { ConfiguracoesPage } from './features/configuracoes'
import { MateriaisLevesPage, AtivosPesadosPage } from './features/materiais-ativos'
import { InsumosPage } from './features/insumos'
import { ComponentesPage, ComponenteNovoPage, ComponenteDetalhePage } from './features/componentes'
import {
  ProdutosPage,
  ProdutoNovoPage,
  ProdutoDetalhePage,
  ProdutoEditarPage,
  ProdutosArquivadosPage,
} from './features/produtos'
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
  const loadWorkspace = useWorkspaceStore((s) => s.load)
  const resetWorkspace = useWorkspaceStore((s) => s.reset)

  // Listener de auth (uma vez).
  useEffect(() => init(), [init])

  // Carrega o workspace único quando o usuário loga.
  useEffect(() => {
    if (user) void loadWorkspace()
    else resetWorkspace()
  }, [user, loadWorkspace, resetWorkspace])

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
          <Route path="/configuracoes" element={<ConfiguracoesPage />} />
          <Route path="/materiais-leves" element={<MateriaisLevesPage />} />
          <Route path="/ativos-pesados" element={<AtivosPesadosPage />} />
          <Route path="/insumos" element={<InsumosPage />} />
          <Route path="/componentes" element={<ComponentesPage />} />
          <Route path="/componentes/novo" element={<ComponenteNovoPage />} />
          <Route path="/componentes/:id" element={<ComponenteDetalhePage />} />
          <Route path="/produtos" element={<ProdutosPage />} />
          <Route path="/produtos/arquivados" element={<ProdutosArquivadosPage />} />
          <Route path="/produtos/novo" element={<ProdutoNovoPage />} />
          <Route path="/produtos/:id" element={<ProdutoDetalhePage />} />
          <Route path="/produtos/:id/editar" element={<ProdutoEditarPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </BrowserRouter>
  )
}
