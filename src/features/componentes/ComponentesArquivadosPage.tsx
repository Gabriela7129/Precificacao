/**
 * `/componentes/arquivados` — versões arquivadas, somente leitura
 * (mesmo padrão de /produtos/arquivados).
 */

import { Archive, ArrowLeft } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CardsSkeleton, EmptyState, SearchInput } from '../../components/ui'
import { useSemiFinishedComponents } from '../../services/firestore'
import { ComponentCard } from './components/ComponentCard'

export function ComponentesArquivadosPage() {
  const navigate = useNavigate()
  const { data, loading } = useSemiFinishedComponents()
  const [query, setQuery] = useState('')

  const archived = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('pt-BR')
    return data
      .filter((c) => c.isArchived)
      .filter((c) => !term || c.name.toLocaleLowerCase('pt-BR').includes(term))
      .sort(
        (a, b) =>
          a.name.localeCompare(b.name, 'pt-BR') || b.version - a.version,
      )
  }, [data, query])

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <button
          type="button"
          onClick={() => navigate('/componentes')}
          className="p-2 hover:bg-rose-100 rounded-lg text-gray-600 transition"
          aria-label="Voltar para componentes"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Componentes Arquivados</h1>
      </div>

      {loading ? (
        <CardsSkeleton />
      ) : (
        <>
          {data.some((c) => c.isArchived) && (
            <div className="mb-4">
              <SearchInput
                className="max-w-none"
                value={query}
                onChange={setQuery}
                placeholder="Buscar componente arquivado..."
              />
            </div>
          )}
          {!data.some((c) => c.isArchived) ? (
            <EmptyState
              icon={Archive}
              title="Nenhum componente arquivado"
              description="Versões antigas aparecem aqui quando você reavalia custos de um componente."
            />
          ) : archived.length === 0 ? (
            <EmptyState
              icon={Archive}
              title="Nenhum componente encontrado"
              description="Ajuste a busca para encontrar a versão arquivada."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {archived.map((componente) => (
                <ComponentCard
                  key={componente.id}
                  componente={componente}
                  archived
                  onClick={() => navigate(`/componentes/${componente.id}`)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
