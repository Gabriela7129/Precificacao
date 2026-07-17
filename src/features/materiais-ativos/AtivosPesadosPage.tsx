/**
 * /ativos-pesados — lista e CRUD de Ativos Pesados (itens acima de R$ 500,00).
 * Custo/hora (depreciação + energia) é calculado no cadastro/edição e
 * persistido no documento — a tabela apenas exibe os valores.
 */

import { useMemo, useState } from 'react'
import { Pencil, Plus, Trash2, Zap } from 'lucide-react'
import { toast } from 'sonner'
import {
  Button,
  ConfirmDialog,
  EmptyState,
  PageHeader,
  SearchInput,
  Table,
  TableSkeleton,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '../../components/ui'
import { formatBRL, formatNumber } from '../../lib/format'
import { deleteHeavyAsset, useActiveWorkspaceId, useHeavyAssets } from '../../services/firestore'
import type { HeavyAsset, WithId } from '../../types'
import { useWorkspaceSettings } from './data'
import { AtivoPesadoFormModal } from './AtivoPesadoFormModal'

/** "24 meses" / "1 mês" */
function formatMonths(months: number): string {
  return `${formatNumber(months)} ${months === 1 ? 'mês' : 'meses'}`
}

export function AtivosPesadosPage() {
  const { data: assets, loading: assetsLoading } = useHeavyAssets()
  const { settings, loading: settingsLoading } = useWorkspaceSettings()
  const wsId = useActiveWorkspaceId()

  const [query, setQuery] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<WithId<HeavyAsset> | null>(null)
  const [deleting, setDeleting] = useState<WithId<HeavyAsset> | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const loading = assetsLoading || settingsLoading
  const productiveHoursPerWeek = settings?.productiveHoursPerWeek ?? 0
  const defaultElectricityRate = settings?.electricityRate ?? null

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const sorted = [...assets].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    return q ? sorted.filter((asset) => asset.name.toLowerCase().includes(q)) : sorted
  }, [assets, query])

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (asset: WithId<HeavyAsset>) => {
    setEditing(asset)
    setFormOpen(true)
  }

  const confirmDelete = async () => {
    if (!wsId || !deleting) return
    setDeleteLoading(true)
    try {
      await deleteHeavyAsset(wsId, deleting.id)
      toast.success('Ativo excluído')
      setDeleting(null)
    } catch {
      toast.error('Não foi possível excluir. Tente novamente.')
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Ativos Pesados"
        actions={
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4" />
            Novo ativo
          </Button>
        }
      />

      {loading ? (
        <TableSkeleton />
      ) : assets.length === 0 ? (
        <EmptyState
          icon={Zap}
          title="Nenhum ativo pesado cadastrado"
          description="Cadastre máquinas e equipamentos para calcular depreciação e energia por hora."
          actionLabel="+ Novo ativo"
          onAction={openCreate}
        />
      ) : (
        <>
          <div className="mb-4">
            <SearchInput value={query} onChange={setQuery} placeholder="Buscar ativo..." />
          </div>

          <Table>
            <THead>
              <tr>
                <TH>Nome</TH>
                <TH>Valor pago</TH>
                <TH>Vida útil</TH>
                <TH>Potência</TH>
                <TH>Custo/hora total</TH>
                <TH className="text-right">Ações</TH>
              </tr>
            </THead>
            <TBody>
              {filtered.length === 0 ? (
                <TR>
                  <TD colSpan={6} className="text-center text-gray-500 py-8">
                    Nenhum ativo encontrado para “{query}”.
                  </TD>
                </TR>
              ) : (
                filtered.map((asset) => (
                  <TR key={asset.id}>
                    <TD className="font-medium text-gray-900">{asset.name}</TD>
                    <TD>{formatBRL(asset.purchaseValue)}</TD>
                    <TD>{formatMonths(asset.usefulLifeMonths)}</TD>
                    <TD>{formatNumber(asset.powerWatts, { unit: 'W' })}</TD>
                    <TD className="font-medium">{formatBRL(asset.totalCostPerHour)}</TD>
                    <TD>
                      <div className="flex items-center gap-1 justify-end">
                        <Button variant="ghost" onClick={() => openEdit(asset)}>
                          <Pencil className="w-4 h-4" />
                          Editar
                        </Button>
                        <button
                          type="button"
                          onClick={() => setDeleting(asset)}
                          className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                          aria-label={`Excluir ${asset.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </>
      )}

      {formOpen && (
        <AtivoPesadoFormModal
          key={editing?.id ?? 'novo'}
          open={formOpen}
          onClose={() => setFormOpen(false)}
          asset={editing}
          productiveHoursPerWeek={productiveHoursPerWeek}
          defaultElectricityRate={defaultElectricityRate}
        />
      )}

      <ConfirmDialog
        open={deleting != null}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Excluir ativo?"
        body={`Esta ação não pode ser desfeita. ${deleting?.name ?? 'O ativo'} será removido permanentemente.`}
        loading={deleteLoading}
      />
    </div>
  )
}
