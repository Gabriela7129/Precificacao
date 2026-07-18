/**
 * `/componentes` — grid de cards dos componentes NÃO arquivados.
 */

import { useNavigate } from 'react-router-dom'
import { Pencil, Wrench } from 'lucide-react'
import { Badge, Button, CardsSkeleton, EmptyState, PageHeader } from '../../components/ui'
import { Card } from '../../components/ui'
import { useSemiFinishedComponents } from '../../services/firestore'
import { formatBRL, formatMinutes } from '../../lib/format'

export function ComponentesPage() {
  const navigate = useNavigate()
  const { data, loading } = useSemiFinishedComponents()

  const ativos = data
    .filter((c) => !c.isArchived)
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
            const totalMachineMinutes = componente.machineAssets.reduce(
              (sum, l) => sum + (l.timeMinutes || 0),
              0,
            )
            const totalLightMinutes = componente.lightTools.reduce(
              (sum, l) => sum + (l.timeMinutes || 0),
              0,
            )
            const totalHumanMinutes = Math.round(componente.humanTimeHours * 60)
            const totalMinutos = totalMachineMinutes + totalLightMinutes + totalHumanMinutes
            const meta = [
              `${componente.supplies.length} ${componente.supplies.length === 1 ? 'insumo' : 'insumos'}`,
              `${componente.machineAssets.length} ${componente.machineAssets.length === 1 ? 'ativo' : 'ativos'}`,
              componente.lightTools.length > 0 ? `${componente.lightTools.length} mat. leve` : undefined,
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
