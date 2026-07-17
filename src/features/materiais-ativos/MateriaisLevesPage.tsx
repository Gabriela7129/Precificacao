/**
 * /materiais-leves — lista e CRUD de Materiais Leves (itens até R$ 500,00).
 * Card de resumo: manutenção mensal total (Σ) e rateio por hora produtiva.
 */

import { useMemo, useState } from 'react'
import { Pencil, Plus, Scissors, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Button,
  Card,
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
import { DEFAULT_LIGHT_MAINTENANCE_RATE, lightMaintenancePerHour } from '../../lib/calculations'
import { formatBRL, formatDate } from '../../lib/format'
import { deleteLightTool, useActiveWorkspaceId, useLightTools } from '../../services/firestore'
import type { LightTool, WithId } from '../../types'
import { useWorkspaceSettings } from './data'
import { MaterialLeveFormModal } from './MaterialLeveFormModal'

export function MateriaisLevesPage() {
  const { data: tools, loading: toolsLoading } = useLightTools()
  const { settings, loading: settingsLoading } = useWorkspaceSettings()
  const wsId = useActiveWorkspaceId()

  const [query, setQuery] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<WithId<LightTool> | null>(null)
  const [deleting, setDeleting] = useState<WithId<LightTool> | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const loading = toolsLoading || settingsLoading
  const maintenanceRate = settings?.lightMaintenanceRate ?? DEFAULT_LIGHT_MAINTENANCE_RATE
  const productiveHoursPerWeek = settings?.productiveHoursPerWeek ?? 0

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const sorted = [...tools].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    return q ? sorted.filter((tool) => tool.name.toLowerCase().includes(q)) : sorted
  }, [tools, query])

  // Resumo do topo: sempre sobre TODOS os itens (independente da busca).
  const totalMonthlyMaintenance = useMemo(
    () => tools.reduce((sum, tool) => sum + (tool.monthlyMaintenanceCost ?? 0), 0),
    [tools],
  )
  const maintenancePerHour = lightMaintenancePerHour(
    tools.map((tool) => tool.monthlyMaintenanceCost ?? 0),
    productiveHoursPerWeek,
  )

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (tool: WithId<LightTool>) => {
    setEditing(tool)
    setFormOpen(true)
  }

  const confirmDelete = async () => {
    if (!wsId || !deleting) return
    setDeleteLoading(true)
    try {
      await deleteLightTool(wsId, deleting.id)
      toast.success('Material excluído')
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
        title="Materiais Leves"
        actions={
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4" />
            Novo material
          </Button>
        }
      />

      {loading ? (
        <TableSkeleton />
      ) : tools.length === 0 ? (
        <EmptyState
          icon={Scissors}
          title="Nenhum material leve cadastrado"
          description="Cadastre estiletes, réguas, tesouras e agulhas para ratear a manutenção na hora trabalhada."
          actionLabel="+ Novo material"
          onAction={openCreate}
        />
      ) : (
        <>
          <Card className="mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-500">Manutenção mensal total</p>
                <p className="text-xl font-bold text-rose-500 mt-1">
                  {formatBRL(totalMonthlyMaintenance)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Rateio por hora produtiva</p>
                <p className="text-xl font-bold text-rose-500 mt-1">
                  {formatBRL(maintenancePerHour)}
                </p>
                {productiveHoursPerWeek <= 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Configure suas horas produtivas em Configurações para calcular o rateio.
                  </p>
                )}
              </div>
            </div>
          </Card>

          <div className="mb-4">
            <SearchInput value={query} onChange={setQuery} placeholder="Buscar material leve..." />
          </div>

          <Table>
            <THead>
              <tr>
                <TH>Nome</TH>
                <TH>Valor pago</TH>
                <TH>Data compra</TH>
                <TH>Manut. mensal</TH>
                <TH className="text-right">Ações</TH>
              </tr>
            </THead>
            <TBody>
              {filtered.length === 0 ? (
                <TR>
                  <TD colSpan={5} className="text-center text-gray-500 py-8">
                    Nenhum material encontrado para “{query}”.
                  </TD>
                </TR>
              ) : (
                filtered.map((tool) => (
                  <TR key={tool.id}>
                    <TD className="font-medium text-gray-900">{tool.name}</TD>
                    <TD>{formatBRL(tool.purchaseValue)}</TD>
                    <TD>{formatDate(tool.purchaseDate)}</TD>
                    <TD>{formatBRL(tool.monthlyMaintenanceCost)}</TD>
                    <TD>
                      <div className="flex items-center gap-1 justify-end">
                        <Button variant="ghost" onClick={() => openEdit(tool)}>
                          <Pencil className="w-4 h-4" />
                          Editar
                        </Button>
                        <button
                          type="button"
                          onClick={() => setDeleting(tool)}
                          className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                          aria-label={`Excluir ${tool.name}`}
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
        <MaterialLeveFormModal
          key={editing?.id ?? 'novo'}
          open={formOpen}
          onClose={() => setFormOpen(false)}
          tool={editing}
          maintenanceRate={maintenanceRate}
        />
      )}

      <ConfirmDialog
        open={deleting != null}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Excluir material?"
        body={`Esta ação não pode ser desfeita. ${deleting?.name ?? 'O material'} será removido permanentemente.`}
        loading={deleteLoading}
      />
    </div>
  )
}
