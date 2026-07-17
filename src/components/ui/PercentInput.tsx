import { useEffect, useState } from 'react'
import { Input } from './Input'

export interface PercentInputProps {
  value: number | null
  onChange: (value: number | null) => void
  id?: string
  placeholder?: string
  error?: boolean
  disabled?: boolean
}

/**
 * Input percentual com sufixo "%". Armazena o número como digitado
 * (40 significa 40%, não 0,4).
 */
export function PercentInput({ value, onChange, ...props }: PercentInputProps) {
  const [text, setText] = useState(() => (value != null ? String(value).replace('.', ',') : ''))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setText(value != null ? String(value).replace('.', ',') : '')
  }, [value, focused])

  return (
    <div className="relative">
      <Input
        inputMode="decimal"
        className="pr-8"
        value={text}
        onChange={(e) => {
          const raw = e.target.value
          setText(raw)
          const normalized = raw.trim().replace(',', '.')
          const parsed = Number(normalized)
          onChange(raw.trim() === '' || !Number.isFinite(parsed) ? null : parsed)
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...props}
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">
        %
      </span>
    </div>
  )
}
