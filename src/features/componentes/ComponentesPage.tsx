/**
 * `/componentes` — grid de cards dos componentes NÃO arquivados.
 * Abas Produto/Embalagem, busca por nome e atalho para arquivados
 * (mesmo padrão da página de produtos).
 */

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Archive, Package, Search, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import { Button, CardsSkeleton, ConfirmDialog, EmptyState, PageHeader, SearchInput } from '../../components/ui'
import { useActiveWorkspaceId, useProducts, useSemiFinishedComponents } from '../../services/firestore'
import { duplicarComponente, excluirComponente } from './data'
import { ComponentCard } from './components/ComponentCard'

type ListaView = 'produtos' | 'embalagens'

export function ComponentesPage() {
  const navigate = useNavigate()
  const wsId = useActiveWorkspaceId()
  const { data, loading } = useSemiFinishedComponents()
  const { data: products } = useProducts()
  const [view, setView] = useState<ListaView>('produtos')
  const [query, setQuery] = useState('')
  const [duplicandoId, setDuplicandoId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<(typeof data)[number] | null>(null)
  const [deleting, setDeleting] = useState(false)

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

  /** Produtos ativos que usam este componente (composição ou embalagem). */
  const usadoEmProdutos = (componente: (typeof data)[number]) =>
    products.filter(
      (p) =>
        !p.isArchived &&
        (p.components.some((l) => l.componentId === componente.id) ||
          p.packaging.some((l) => l.componentId === componente.id)),
    )

  const handleDelete = async () => {
    if (!wsId || !deleteTarget) return
    setDeleting(true)
    try {
      const removidos = await excluirComponente(wsId, deleteTarget, data)
      toast.success(
        removidos > 1
          ? `Componente excluído (${removidos} versões)`
          : 'Componente excluído',
      )
      setDeleteTarget(null)
    } catch {
      toast.error('Não foi possível excluir. Tente novamente.')
    } finally {
      setDeleting(false)
    }
  }

  const deleteProductCount = deleteTarget ? usadoEmProdutos(deleteTarget).length : 0
  const deleteVersions = deleteTarget
    ? data.filter((c) => c.name === deleteTarget.name).length
    : 0

  const ativos = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('pt-BR')
    return data
      .filter((c) =>
        !c.isArchived && (view === 'embalagens' ? c.isPackaging === true : !c.isPackaging),
      )
      .filter((c) => !term || c.name.toLocaleLowerCase('pt-BR').includes(term))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  }, [data, view, query])

  const rotaNovo = view === 'embalagens' ? '/componentes/novo?tipo=embalagem' : '/componentes/novo'
  const labelNovo = view === 'embalagens' ? '+ Nova embalagem' : '+ Novo componente'

  const tabClass = (active: boolean) =>
    `px-4 py-2 rounded-xl text-sm font-medium transition ${
      active
        ? 'bg-rose-500 text-white shadow-sm'
        : 'bg-white text-gray-600 border border-rose-200 hover:bg-rose-50'
    }`

  return (
    <div>
      <PageHeader
        title="Componentes Semi-Acabados"
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate('/componentes/arquivados')}>
              <Archive className="w-4 h-4" /> Arquivados
            </Button>
            <Button onClick={() => navigate(rotaNovo)}>{labelNovo}</Button>
          </>
        }
      />

      <div className="flex gap-2 mb-4">
        <button type="button" onClick={() => setView('produtos')} className={tabClass(view === 'produtos')}>
          Produto
        </button>
        <button type="button" onClick={() => setView('embalagens')} className={tabClass(view === 'embalagens')}>
          Embalagem
        </button>
      </div>

      {loading ? (
        <CardsSkeleton />
      ) : (
        <>
          {data.some((c) => !c.isArchived) && (
            <div className="mb-6">
              <SearchInput
                className="max-w-none"
                value={query}
                onChange={setQuery}
                placeholder={view === 'embalagens' ? 'Buscar embalagem...' : 'Buscar componente...'}
              />
            </div>
          )}
          {ativos.length === 0 ? (
            query.trim() ? (
              <EmptyState
                icon={Search}
                title="Nenhum componente encontrado"
                description="Ajuste a busca para encontrar o componente."
              />
            ) : (
              <EmptyState
                icon={view === 'embalagens' ? Package : Wrench}
                title={view === 'embalagens' ? 'Nenhuma embalagem cadastrada' : 'Nenhum componente cadastrado'}
                description={
                  view === 'embalagens'
                    ? 'Crie embalagens como componentes para usar na seção de embalagens dos produtos.'
                    : "Crie itens intermediários como 'Miolo A5 Costurado' para reutilizar nos produtos."
                }
                actionLabel={labelNovo}
                onAction={() => navigate(rotaNovo)}
              />
            )
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {ativos.map((componente) => (
                <ComponentCard
                  key={componente.id}
                  componente={componente}
                  onClick={() => navigate(`/componentes/${componente.id}`)}
                  onDuplicate={() => void handleDuplicar(componente)}
                  duplicating={duplicandoId === componente.id}
                  onDelete={() => setDeleteTarget(componente)}
                />
              ))}
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        title="Excluir componente?"
        body={
          deleteTarget
            ? [
                `"${deleteTarget.name}" será removido permanentemente${
                  deleteVersions > 1 ? ` (todas as ${deleteVersions} versões)` : ''
                }. Esta ação não pode ser desfeita.`,
                deleteProductCount > 0
                  ? `Atenção: este componente está em uso em ${deleteProductCount} ${
                      deleteProductCount === 1 ? 'produto' : 'produtos'
                    }. O custo histórico fica preservado, mas ele aparecerá como "Componente removido".`
                  : '',
              ]
                .filter(Boolean)
                .join('\n\n')
            : ''
        }
        confirmLabel="Excluir"
        variant="danger"
        loading={deleting}
      />
    </div>
  )
}
