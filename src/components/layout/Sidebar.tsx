import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { Logo } from '../ui/Logo'
import { NAV_ITEMS } from './navItems'
import { NavItem } from './NavItem'
import { useAuthStore } from '../../stores/authStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'

/** Menu do usuário (avatar → "Sair"). Compartilhado entre Sidebar e Topbar. */
export function UserMenu() {
  const [open, setOpen] = useState(false)
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const resetWorkspace = useWorkspaceStore((s) => s.reset)
  const navigate = useNavigate()

  if (!user) return null

  const initial = (user.displayName ?? user.email ?? '?').charAt(0).toUpperCase()

  const handleLogout = async () => {
    await logout()
    resetWorkspace()
    navigate('/login')
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-3 w-full text-left rounded-xl p-1.5 hover:bg-rose-50 transition"
      >
        {user.photoURL ? (
          <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <span className="w-8 h-8 rounded-full bg-amber-200 flex items-center justify-center text-sm font-medium text-gray-700">
            {initial}
          </span>
        )}
        <span className="flex-1 min-w-0 hidden lg:block">
          <span className="block text-sm font-medium text-gray-900 truncate">{user.email}</span>
          <span className="block text-xs text-gray-500">Administrador</span>
        </span>
      </button>
      {open && (
        <div className="absolute bottom-full mb-2 left-0 bg-white border border-rose-200 rounded-xl shadow-md py-1 min-w-32 z-50">
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-rose-50 flex items-center gap-2 transition"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      )}
    </div>
  )
}

/** Sidebar fixa desktop (visível a partir de `lg`). */
export function Sidebar() {
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace)

  return (
    <aside className="hidden lg:flex w-64 bg-white border-r border-rose-200 flex-col flex-shrink-0">
      <div className="p-5 border-b border-rose-200 flex items-center gap-3">
        <Logo size="sm" />
        <span className="font-bold text-gray-900 truncate">{activeWorkspace?.name ?? 'Precificador'}</span>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map((item) => (
          <NavItem key={item.to} item={item} />
        ))}
      </nav>
      <div className="p-4 border-t border-rose-200">
        <UserMenu />
      </div>
    </aside>
  )
}
