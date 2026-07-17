import { Logo } from '../ui/Logo'
import { UserMenu } from './Sidebar'
import { useWorkspaceStore } from '../../stores/workspaceStore'

/** Topbar fina mobile (abaixo de `lg`). */
export function Topbar() {
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace)

  return (
    <header className="lg:hidden h-14 bg-white border-b border-rose-200 flex items-center gap-2 px-4 sticky top-0 z-40">
      <Logo size="xs" />
      <span className="font-bold text-gray-900 truncate flex-1">
        {activeWorkspace?.name ?? 'Precificador'}
      </span>
      <UserMenu />
    </header>
  )
}
