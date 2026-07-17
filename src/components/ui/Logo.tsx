const sizeClasses = {
  /** 36px — sidebar */
  sm: 'w-9 h-9 text-sm rounded-xl',
  /** 32px — topbar mobile */
  xs: 'w-8 h-8 text-sm rounded-xl',
  /** 80px — login */
  lg: 'w-20 h-20 text-3xl rounded-2xl shadow-md',
} as const

/**
 * Logo do app — único gradiente permitido no design system
 * (`bg-gradient-to-br from-rose-400 to-amber-300`).
 */
export function Logo({ size = 'sm' }: { size?: keyof typeof sizeClasses }) {
  return (
    <div
      className={`bg-gradient-to-br from-rose-400 to-amber-300 flex items-center justify-center text-white font-bold shadow-sm ${sizeClasses[size]}`}
    >
      P
    </div>
  )
}
