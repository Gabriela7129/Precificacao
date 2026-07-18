import { useRef, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { Button } from './Button'

export interface ImportExportButtonsProps {
  onExport: () => void
  onImport: (file: File) => Promise<void> | void
  /** Texto curto exibido no tooltip/label. */
  entityLabel: string
  /** Aceita extensões de arquivo, ex.: ".xlsx,.xls". */
  accept?: string
}

export function ImportExportButtons({
  onExport,
  onImport,
  entityLabel,
  accept = '.xlsx,.xls',
}: ImportExportButtonsProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    try {
      await onImport(file)
    } finally {
      setLoading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => void handleFileChange(e)}
      />
      <Button
        type="button"
        variant="secondary"
        onClick={onExport}
        title={`Exportar ${entityLabel}`}
      >
        <Download className="w-4 h-4" />
        Exportar
      </Button>
      <Button
        type="button"
        variant="secondary"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        title={`Importar ${entityLabel}`}
      >
        <Upload className="w-4 h-4" />
        Importar
      </Button>
    </div>
  )
}
