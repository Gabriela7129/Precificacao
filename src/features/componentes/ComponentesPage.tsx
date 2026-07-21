/**
 * `/componentes` — grid de cards dos componentes NÃO arquivados.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Copy, Pencil, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import { Badge, Button, CardsSkeleton, EmptyState, PageHeader } from '../../components/ui'
import { Card } from '../../components/ui'
import { useActiveWorkspaceId, useSemiFinishedComponents } from '../../services/firestore'
import { formatBRL, formatMinutes } from '../../lib/format'
import { duplicarComponente } from './data'

export function ComponentesPage() {
  const navigate = useNavigate()
  const wsId = useActiveWorkspaceId()
  const { data, loading } = useSemiFinishedComponents()
  const [duplicandoId, setDuplicandoId] = useState<string | null>(null)

  const handleDuplicar = async (componente: (typeof data)[number]) => {
    if (!wsId || duplicandoId) return
    setDuplicandoId(componente.id)
    try {
      const novoId = await duplicarComponente(wsId, componente)
      toast.success(`"${componente.name}" duplicado`)
      navigate(`/componentes/${novoId}`)
    } catch {
      toast.error('Não foi possível duplicar. Tente novamente.')
      setDuplicandoId(null)
    }
  }

  const ativos = data
    .filter((c) => !c.isArchived && !c.isPackaging)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  return (
    <div>
      <PageHeader
        title="Componentes Semi-Acabados"
        actions={
          <Button onClick={() => navigate('/componentes/novo')}>+ Novo componente</Button>
        }
      />

      {loading ? (
        <CardsSkeleton />
      ) : ativos.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="Nenhum componente cadastrado"
          description="Crie itens intermediários como 'Miolo A5 Costurado' para reutilizar nos produtos."
          actionLabel="+ Novo componente"
          onAction={() => navigate('/componentes/novo')}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ativos.map((componente) => {
            const machineAssets = componente.machineAssets ?? []
            const lightTools = componente.lightTools ?? []
            const totalMachineMinutes = machineAssets.reduce(
              (sum, l) => sum + (l.timeMinutes || 0),
              0,
            )
            const totalLightMinutes = lightTools.reduce(
              (sum, l) => sum + (l.timeMinutes || 0),
              0,
            )
            const totalHumanMinutes = Math.round(componente.humanTimeHours * 60)
            const totalMinutos = totalMachineMinutes + totalLightMinutes + totalHumanMinutes
            const meta = [
              `${componente.supplies.length} ${componente.supplies.length === 1 ? 'insumo' : 'insumos'}`,
              `${machineAssets.length} ${machineAssets.length === 1 ? 'ativo' : 'ativos'}`,
              lightTools.length > 0 ? `${lightTools.length} mat. leve` : undefined,
              formatMinutes(totalMinutos),
            ]
              .filter(Boolean)
              .join(' · ')

            return (
              <Card
                key={componente.id}
                onClick={() => navigate(`/componentes/${componente.id}`)}
              >
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-semibold text-lg text-gray-900">{componente.name}</h3>
                  <div className="flex items-center gap-2">
                    <Badge variant="rose">v{componente.version}</Badge>
                    <button
                      type="button"
                      aria-label="Duplicar componente"
                      title="Duplicar componente"
                      disabled={duplicandoId === componente.id}
                      className="p-1.5 rounded-lg text-gray-500 hover:bg-rose-100 hover:text-rose-600 transition disabled:opacity-50"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDuplicar(componente)
                      }}
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Ver / editar"
                      className="p-1.5 rounded-lg text-gray-500 hover:bg-rose-100 hover:text-rose-600 transition"
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/componentes/${componente.id}`)
                      }}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-gray-500">{meta}</p>
                <div className="flex justify-between items-end mt-6">
                  <span className="text-sm text-gray-500">Custo unitário</span>
                  <span className="text-2xl font-bold text-rose-500">
                    {formatBRL(componente.unitCost)}
                  </span>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
