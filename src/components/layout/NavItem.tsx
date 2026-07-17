import { Link, useLocation } from 'react-router-dom'
import type { NavItemDef } from './navItems'

/** Item de nav da sidebar (desktop). Ativo por match de prefixo. */
export function NavItem({ item }: { item: NavItemDef }) {
  const { pathname } = useLocation()
  const active = pathname.startsWith(item.matchPrefix)
  const Icon = item.icon
  return (
    <Link
      to={item.to}
      className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition ${
        active ? 'bg-rose-100 text-rose-700 font-medium' : 'text-gray-700 hover:bg-amber-100'
      }`}
    >
      <Icon className="w-5 h-5" />
      <span>{item.label}</span>
    </Link>
  )
}
