import type { ReactNode } from 'react'

/** Card canônico: `bg-white p-6 rounded-3xl shadow-sm border border-rose-200`. */
export function Card({
  children,
  className = '',
  onClick,
}: {
  children: ReactNode
  className?: string
  onClick?: () => void
}) {
  const clickable = onClick ? 'cursor-pointer hover:shadow-md transition' : ''
  return (
    <div
      className={`bg-white p-6 rounded-3xl shadow-sm border border-rose-200 ${clickable} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      {children}
    </div>
  )
}
