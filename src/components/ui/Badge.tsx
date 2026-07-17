import type { ReactNode } from 'react'

export type BadgeVariant = 'success' | 'muted' | 'amber' | 'rose' | 'default'

const variantClasses: Record<BadgeVariant, string> = {
  success: 'bg-green-100 text-green-700',
  muted: 'bg-gray-100 text-gray-600',
  amber: 'bg-amber-100 text-amber-800',
  rose: 'bg-rose-100 text-rose-700',
  /** Badge "Padrão" (marketplace default). */
  default: 'bg-amber-300 text-amber-900',
}

export function Badge({
  variant = 'muted',
  children,
  className = '',
}: {
  variant?: BadgeVariant
  children: ReactNode
  className?: string
}) {
  return (
    <span className={`inline-block text-xs px-2 py-1 rounded-full ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  )
}
