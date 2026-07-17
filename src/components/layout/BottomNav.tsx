import { Link, useLocation } from 'react-router-dom'
import { NAV_ITEMS } from './navItems'

/** Bottom nav mobile (abaixo de `lg`) — 6 destinos fixos. */
export function BottomNav() {
  const { pathname } = useLocation()

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 h-16 bg-white border-t border-rose-200 z-40 grid grid-cols-6">
      {NAV_ITEMS.map((item) => {
        const active = pathname.startsWith(item.matchPrefix)
        const Icon = item.icon
        return (
          <Link
            key={item.to}
            to={item.to}
            className={`flex flex-col items-center justify-center gap-0.5 transition ${
              active ? 'text-rose-600' : 'text-gray-500'
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] leading-tight">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
