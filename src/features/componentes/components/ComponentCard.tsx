import { Archive, Copy, Package, Pencil, Trash2 } from 'lucide-react'
import { Badge, Button, Card } from '../../../components/ui'
import { formatBRL, formatDate, formatMinutes } from '../../../lib/format'
import type { SemiFinishedComponent, WithId } from '../../../types'

const asTimestamp = (value: unknown) => value as { toDate: () => Date } | undefined

export interface ComponentCardProps {
  componente: WithId<SemiFinishedComponent>
  archived?: boolean
  onClick: () => void
  onDuplicate?: () => void
  duplicating?: boolean
  onDelete?: () => void
}

/** Card canônico de componente (ativo ou arquivado). */
export function ComponentCard({
  componente,
  archived = false,
  onClick,
  onDuplicate,
  duplicating = false,
  onDelete,
}: ComponentCardProps) {
  const machineAssets = componente.machineAssets ?? []
  const lightTools = componente.lightTools ?? []
  const totalMachineMinutes = machineAssets.reduce((sum, l) => sum + (l.timeMinutes || 0), 0)
  const totalHumanMinutes = Math.round(componente.humanTimeHours * 60)
  // Materiais leves têm custo fixo (sem tempo) — não entram no total de minutos.
  const totalMinutos = totalMachineMinutes + totalHumanMinutes
  const meta = [
    `${componente.supplies.length} ${componente.supplies.length === 1 ? 'insumo' : 'insumos'}`,
    `${machineAssets.length} ${machineAssets.length === 1 ? 'ativo' : 'ativos'}`,
    lightTools.length > 0 ? `${lightTools.length} mat. leve` : undefined,
    formatMinutes(totalMinutos),
  ]
    .filter(Boolean)
    .join(' · ')

  const updatedAt = (componente as WithId<SemiFinishedComponent> & { updatedAt?: unknown }).updatedAt
  const infoVersao = archived
    ? `v${componente.version} · arquivada em ${formatDate(asTimestamp(updatedAt))}`
    : undefined

  return (
    <Card onClick={onClick} className={archived ? 'opacity-70' : ''}>
      <div className="flex justify-between items-start mb-1">
        <div className="min-w-0">
          <h3 className="font-semibold text-lg text-gray-900 truncate">{componente.name}</h3>
          {infoVersao && <p className="text-sm text-gray-500">{infoVersao}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={archived ? 'muted' : 'rose'}>
            {archived ? <span className="flex items-center gap-1"><Archive className="w-3 h-3" /> v{componente.version}</span> : `v${componente.version}`}
          </Badge>
          {!archived && onDuplicate && (
            <button
              type="button"
              aria-label="Duplicar componente"
              title="Duplicar componente"
              disabled={duplicating}
              className="p-1.5 rounded-lg text-gray-500 hover:bg-rose-100 hover:text-rose-600 transition disabled:opacity-50"
              onClick={(e) => {
                e.stopPropagation()
                onDuplicate()
              }}
            >
              <Copy className="w-4 h-4" />
            </button>
          )}
          {!archived && (
            <button
              type="button"
              aria-label="Ver / editar"
              className="p-1.5 rounded-lg text-gray-500 hover:bg-rose-100 hover:text-rose-600 transition"
              onClick={(e) => {
                e.stopPropagation()
                onClick()
              }}
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
          {!archived && onDelete && (
            <button
              type="button"
              aria-label="Excluir componente"
              title="Excluir componente"
              className="p-1.5 rounded-lg text-gray-500 hover:bg-rose-100 hover:text-red-600 transition"
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      <p className="text-sm text-gray-500">
        {componente.isPackaging && (
          <span className="inline-flex items-center gap-1 text-amber-600 mr-2">
            <Package className="w-3.5 h-3.5" /> embalagem
          </span>
        )}
        {meta}
      </p>
      <div className="flex justify-between items-end mt-6">
        <span className="text-sm text-gray-500">Custo unitário</span>
        <span className="text-2xl font-bold text-rose-500">{formatBRL(componente.unitCost)}</span>
      </div>
    </Card>
  )
}

/** Botão "Arquivados" do cabeçalho (padrão igual ao de produtos). */
export function ArquivadosButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="secondary" onClick={onClick}>
      <Archive className="w-4 h-4" /> Arquivados
    </Button>
  )
}
