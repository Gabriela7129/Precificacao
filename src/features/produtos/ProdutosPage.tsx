import { Archive, Plus, Search, Tag } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { SearchInput } from '../../components/ui/SearchInput'
import { Skeleton } from '../../components/ui/Skeleton'
import { useActiveWorkspaceId, useMarketplaces, useProducts } from '../../services/firestore'
import type { Product, WithId } from '../../types'
import { categoriaDe } from './categoria'
import { ProductCard } from './components/ProductCard'
import { duplicarProduto, excluirProduto } from './data'

type ListaView = 'todos' | 'cadernos' | 'amigurumis'

/** /produtos — grid de cards dos produtos NÃO arquivados (design.md 5.10). */
export function ProdutosPage() {
  const navigate = useNavigate()
  const wsId = useActiveWorkspaceId()
  const { data: products, loading } = useProducts()
  const { data: marketplaces } = useMarketplaces()
  const [view, setView] = useState<ListaView>('todos')
  const [query, setQuery] = useState('')
  const [duplicandoId, setDuplicandoId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<WithId<Product> | null>(null)
  const [deleting, setDeleting] = useState(false)

  const marketplacesById = useMemo(() => new Map(marketplaces.map((m) => [m.id, m])), [marketplaces])
  const activeProducts = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('pt-BR')
    return products
      .filter((p) => {
        if (p.isArchived) return false
        if (view === 'cadernos') return categoriaDe(p) === 'caderno'
        if (view === 'amigurumis') return categoriaDe(p) === 'amigurumi'
        return true
      })
      .filter((p) => !term || p.name.toLocaleLowerCase('pt-BR').includes(term))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  }, [products, view, query])

  const tabClass = (active: boolean) =>
    `px-4 py-2 rounded-xl text-sm font-medium transition ${
      active
        ? 'bg-rose-500 text-white shadow-sm'
        : 'bg-white text-gray-600 border border-rose-200 hover:bg-rose-50'
    }`

  const handleDuplicar = async (product: WithId<Product>) => {
    if (!wsId || duplicandoId) return
    setDuplicandoId(product.id)
    try {
      const novoId = await duplicarProduto(wsId, product)
      toast.success(`"${product.name}" duplicado`)
      navigate(`/produtos/${novoId}`)
    } catch {
      toast.error('Não foi possível duplicar. Tente novamente.')
      setDuplicandoId(null)
    }
  }

  const handleDelete = async () => {
    if (!wsId || !deleteTarget) return
    setDeleting(true)
    try {
      const removidos = await excluirProduto(wsId, deleteTarget, products)
      toast.success(
        removidos > 1 ? `Produto excluído (${removidos} versões)` : 'Produto excluído',
      )
      setDeleteTarget(null)
    } catch {
      toast.error('Não foi possível excluir. Tente novamente.')
    } finally {
      setDeleting(false)
    }
  }

  const deleteVersions = deleteTarget
    ? products.filter((p) => p.name === deleteTarget.name).length
    : 0

  return (
    <div>
      <PageHeader
        title="Produtos Finais"
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate('/produtos/arquivados')}>
              <Archive className="w-4 h-4" /> Arquivados
            </Button>
            <Button onClick={() => navigate('/produtos/novo')}>
              <Plus className="w-4 h-4" /> Novo produto
            </Button>
          </>
        }
      />

      <div className="flex gap-2 mb-4">
        <button type="button" onClick={() => setView('todos')} className={tabClass(view === 'todos')}>
          Todos
        </button>
        <button type="button" onClick={() => setView('cadernos')} className={tabClass(view === 'cadernos')}>
          Cadernos
        </button>
        <button type="button" onClick={() => setView('amigurumis')} className={tabClass(view === 'amigurumis')}>
          Amigurumis
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      ) : (
        <>
          {products.some((p) => !p.isArchived) && (
            <div className="mb-6">
              <SearchInput
                className="max-w-none"
                value={query}
                onChange={setQuery}
                placeholder="Buscar produto..."
              />
            </div>
          )}
          {activeProducts.length === 0 ? (
            query.trim() ? (
              <EmptyState
                icon={Search}
                title="Nenhum produto encontrado"
                description="Ajuste a busca para encontrar o produto."
              />
            ) : view !== 'todos' ? (
              <EmptyState
                icon={Tag}
                title={view === 'cadernos' ? 'Nenhum caderno cadastrado' : 'Nenhum amigurumi cadastrado'}
                description={
                  view === 'cadernos'
                    ? 'Crie um produto e marque a categoria "Caderno" para vê-lo aqui.'
                    : 'Crie um produto e marque a categoria "Amigurumi" para vê-lo aqui.'
                }
                actionLabel="+ Novo produto"
                onAction={() => navigate('/produtos/novo')}
              />
            ) : (
              <EmptyState
                icon={Tag}
                title="Nenhum produto cadastrado"
                description="Monte seu primeiro produto a partir dos componentes e descubra o preço de venda ideal."
                actionLabel="+ Novo produto"
                onAction={() => navigate('/produtos/novo')}
              />
            )
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {activeProducts.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  marketplace={p.marketplaceId ? (marketplacesById.get(p.marketplaceId) ?? null) : null}
                  onClick={() => navigate(`/produtos/${p.id}`)}
                  onDuplicate={() => void handleDuplicar(p)}
                  duplicating={duplicandoId === p.id}
                  onDelete={() => setDeleteTarget(p)}
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
        title="Excluir produto?"
        body={
          deleteTarget
            ? `"${deleteTarget.name}" será removido permanentemente${
                deleteVersions > 1 ? ` (todas as ${deleteVersions} versões, incluindo arquivadas)` : ''
              }. Esta ação não pode ser desfeita.`
            : ''
        }
        confirmLabel="Excluir"
        variant="danger"
        loading={deleting}
      />
    </div>
  )
}
