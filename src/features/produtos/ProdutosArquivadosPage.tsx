import { Archive, ArrowLeft } from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { EmptyState } from '../../components/ui/EmptyState'
import { Skeleton } from '../../components/ui/Skeleton'
import { useMarketplaces, useProducts } from '../../services/firestore'
import { ProductCard } from './components/ProductCard'

/** /produtos/arquivados — versões arquivadas, somente leitura (design.md 5.11). */
export function ProdutosArquivadosPage() {
  const navigate = useNavigate()
  const { data: products, loading } = useProducts()
  const { data: marketplaces } = useMarketplaces()

  const marketplacesById = useMemo(() => new Map(marketplaces.map((m) => [m.id, m.name])), [marketplaces])
  const archivedProducts = useMemo(
    () =>
      products
        .filter((p) => p.isArchived)
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR') || b.version - a.version),
    [products],
  )

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <button
          type="button"
          onClick={() => navigate('/produtos')}
          className="p-2 hover:bg-rose-100 rounded-lg text-gray-600 transition"
          aria-label="Voltar para Produtos"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Produtos Arquivados</h1>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      ) : archivedProducts.length === 0 ? (
        <EmptyState
          icon={Archive}
          title="Nenhum produto arquivado"
          description="Versões antigas aparecem aqui quando você reavalia custos ou arquiva um produto."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {archivedProducts.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              marketplaceName={p.marketplaceId ? (marketplacesById.get(p.marketplaceId) ?? null) : null}
              archived
              onClick={() => navigate(`/produtos/${p.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
