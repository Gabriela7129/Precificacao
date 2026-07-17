export interface SegmentedControlOption<T extends string> {
  value: T
  label: string
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[]
  value: T
  onChange: (value: T) => void
}

/**
 * Controle segmentado (ex.: "Operacional" / "Criativa").
 * Ativo: `bg-rose-100 text-rose-700 font-medium`.
 */
export function SegmentedControl<T extends string>({ options, value, onChange }: SegmentedControlProps<T>) {
  return (
    <div className="flex gap-2">
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`flex-1 px-4 py-2 rounded-xl text-sm transition ${
              active
                ? 'bg-rose-100 text-rose-700 font-medium'
                : 'bg-white border border-rose-200 text-gray-700 hover:bg-rose-50'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
