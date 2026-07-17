import { useEffect, useState } from 'react'
import { Input } from './Input'
import { parseBRLInput } from '../../lib/format'

export interface CurrencyInputProps {
  value: number | null
  onChange: (value: number | null) => void
  id?: string
  placeholder?: string
  error?: boolean
  disabled?: boolean
  autoFocus?: boolean
}

const displayFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/**
 * Input monetário pt-BR: aceita "4500", "4.500", "4.500,00".
 * Emite `number` (em reais) ou `null` (vazio). Formata com 2 casas no blur.
 */
export function CurrencyInput({ value, onChange, ...props }: CurrencyInputProps) {
  const [text, setText] = useState(() => (value != null ? displayFormatter.format(value) : ''))
  const [focused, setFocused] = useState(false)

  // Sincroniza quando o valor externo muda e o campo não está em edição.
  useEffect(() => {
    if (!focused) setText(value != null ? displayFormatter.format(value) : '')
  }, [value, focused])

  return (
    <Input
      inputMode="decimal"
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        onChange(parseBRLInput(e.target.value))
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      {...props}
    />
  )
}
