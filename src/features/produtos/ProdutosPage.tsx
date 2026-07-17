import { Archive, Plus, Tag } from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { Skeleton } from '../../components/ui/Skeleton'
import { useMarketplaces, useProducts } from '../../services/firestore'
import { ProductCard } from './components/ProductCard'

/** /produtos — grid de cards dos produtos NÃO arquivados (design.md 5.10). */
export function ProdutosPage() {
  const navigate = useNavigate()
  const { data: products, loading } = useProducts()
  const { data: marketplaces } = useMarketplaces()

  const marketplacesById = useMemo(() => new Map(marketplaces.map((m) => [m.id, m.name])), [marketplaces])
  const activeProducts = useMemo(
    () => products.filter((p) => !p.isArchived).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [products],
  )

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

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      ) : activeProducts.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="Nenhum produto cadastrado"
          description="Monte seu primeiro produto a partir dos componentes e descubra o preço de venda ideal."
          actionLabel="+ Novo produto"
          onAction={() => navigate('/produtos/novo')}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {activeProducts.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              marketplaceName={p.marketplaceId ? (marketplacesById.get(p.marketplaceId) ?? null) : null}
              onClick={() => navigate(`/produtos/${p.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
