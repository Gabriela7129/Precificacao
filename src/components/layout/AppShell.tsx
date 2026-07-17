import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { BottomNav } from './BottomNav'

/**
 * Layout compartilhado do app (rotas "app": logado + workspace).
 * Desktop: sidebar fixa w-64 + main com scroll.
 * Mobile: topbar fina + bottom nav, main com pb-24.
 */
export function AppShell() {
  return (
    <div className="flex h-screen overflow-hidden bg-amber-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-4 pb-24 lg:p-8 lg:pb-8 bg-amber-50">
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
