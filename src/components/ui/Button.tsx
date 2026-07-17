import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-rose-500 hover:bg-rose-600 text-white font-medium rounded-xl px-4 py-2 text-sm shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed',
  secondary:
    'bg-white border border-rose-200 text-gray-700 hover:bg-rose-50 font-medium rounded-xl px-4 py-2 text-sm transition disabled:opacity-50 disabled:cursor-not-allowed',
  ghost: 'text-rose-500 hover:text-rose-600 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed',
  danger:
    'bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl px-4 py-2 text-sm transition disabled:opacity-50 disabled:cursor-not-allowed',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  /** Exibe Loader2 girando e desabilita o botão. */
  loading?: boolean
  children: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', loading = false, disabled, className = '', children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  )
})
