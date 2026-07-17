/**
 * `/componentes/:id` — detalhe/edição da composição de um componente.
 * Versões arquivadas entram em modo somente leitura (banner âmbar).
 */

import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button, Card, Skeleton } from '../../components/ui'
import { useSemiFinishedComponents } from '../../services/firestore'
import { ComponenteFormPage } from './ComponenteFormPage'

export function ComponenteDetalhePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data, loading } = useSemiFinishedComponents()

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
          <Skeleton className="h-56 w-full" />
        </div>
      </div>
    )
  }

  const componente = data.find((c) => c.id === id) ?? null

  if (!componente) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={() => navigate('/componentes')}
            className="p-2 hover:bg-rose-100 rounded-lg text-gray-600 transition"
            aria-label="Voltar para componentes"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Componente</h1>
        </div>
        <Card className="text-center py-12">
          <h2 className="font-semibold text-gray-900">Componente não encontrado</h2>
          <p className="text-sm text-gray-500 mt-1 mb-6">
            Ele pode ter sido removido ou o link está incorreto.
          </p>
          <Button variant="secondary" onClick={() => navigate('/componentes')}>
            Voltar para componentes
          </Button>
        </Card>
      </div>
    )
  }

  return <ComponenteFormPage key={componente.id} componente={componente} />
}
