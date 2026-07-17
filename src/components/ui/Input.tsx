import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'

const baseInputClasses =
  'w-full border border-rose-200 bg-amber-50 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-rose-400 placeholder:text-gray-400'
const errorClasses = 'border-red-400 focus:ring-red-400'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
  /** Sobre fundo creme, usar fundo branco (ex.: busca). */
  surface?: 'default' | 'white'
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { error = false, surface = 'default', className = '', ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={`${baseInputClasses} ${surface === 'white' ? 'bg-white' : ''} ${error ? errorClasses : ''} ${className}`}
      {...props}
    />
  )
})

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean
  surface?: 'default' | 'white'
  children: ReactNode
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { error = false, surface = 'default', className = '', children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={`${baseInputClasses} ${surface === 'white' ? 'bg-white' : ''} ${error ? errorClasses : ''} ${className}`}
      {...props}
    >
      {children}
    </select>
  )
})

/** Label canônico de formulário. */
export function FieldLabel({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 mb-1">
      {children}
    </label>
  )
}

/** Texto de ajuda canônico. */
export function FieldHint({ children }: { children: ReactNode }) {
  return <p className="text-xs text-gray-500 mt-1">{children}</p>
}

/** Erro de validação canônico. */
export function FieldError({ children }: { children: ReactNode }) {
  return <p className="text-xs text-red-600 mt-1">{children}</p>
}
