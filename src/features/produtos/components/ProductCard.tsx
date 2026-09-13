import { Copy, Trash2 } from 'lucide-react'
import { Badge } from '../../../components/ui/Badge'
import { Card } from '../../../components/ui/Card'
import { priceWithoutFees } from '../../../lib/calculations'
import { formatBRL, formatDate, formatPercent } from '../../../lib/format'
import type { Marketplace, Product, WithId } from '../../../types'

export interface ProductCardProps {
  product: WithId<Product>
  /** Marketplace selecionado (rótulo do preço de venda + base do modo reverso, F2). */
  marketplace?: WithId<Marketplace> | null
  archived?: boolean
  onClick: () => void
  /** Duplicar produto (ausente = sem botão). */
  onDuplicate?: () => void
  duplicating?: boolean
  /** Excluir produto (ausente = sem botão). */
  onDelete?: () => void
}

/**
 * Card canônico de produto (design.md 5.10/5.11): título + meta + badge,
 * linhas Custo direto / Margem / Preço sem taxas e destaque Preço de venda.
 *
 * F2: o "Preço sem taxas" usa a mesma base do detalhe — no modo reverso
 * (líquido desejado + marketplace) é o líquido desejado, não o preço derivado
 * da margem %.
 */
export function ProductCard({
  product,
  marketplace = null,
  archived = false,
  onClick,
  onDuplicate,
  duplicating = false,
  onDelete,
}: ProductCardProps) {
  const precoMargem = priceWithoutFees(product.directCost, product.profitMargin)
  const modoReverso = product.desiredNetValue != null && marketplace != null
  const precoSemTaxas = modoReverso ? (product.desiredNetValue as number) : precoMargem
  const asTimestamp = (value: unknown) => value as { toDate: () => Date } | undefined
  const meta = archived
    ? `v${product.version} · arquivado em ${formatDate(asTimestamp(product.updatedAt))}`
    : `v${product.version} · criado em ${formatDate(asTimestamp(product.createdAt))}`

  return (
    <Card onClick={onClick} className={archived ? 'opacity-70' : ''}>
      <div className="flex justify-between items-start gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="font-semibold text-lg text-gray-900 truncate">{product.name}</h3>
          <p className="text-sm text-gray-500">{meta}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={archived ? 'muted' : 'success'}>{archived ? 'Arquivado' : 'Ativo'}</Badge>
          {onDuplicate && (
            <button
              type="button"
              aria-label="Duplicar produto"
              title="Duplicar produto"
              disabled={duplicating}
              className="p-1.5 rounded-lg text-gray-500 hover:bg-rose-100 hover:text-rose-600 transition disabled:opacity-50"
              onClick={(e) => {
                e.stopPropagation()
                onDuplicate()
              }}
            >
              <Copy className="w-4 h-4" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              aria-label="Excluir produto"
              title="Excluir produto"
              className="p-1.5 rounded-lg text-gray-500 hover:bg-rose-100 hover:text-red-600 transition"
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Custo direto</span>
          <span className="font-medium text-gray-900">{formatBRL(product.directCost)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Margem</span>
          <span className="font-medium text-gray-900">{formatPercent(product.profitMargin)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Preço sem taxas</span>
          <span className="font-medium text-gray-900">{formatBRL(precoSemTaxas)}</span>
        </div>
        <div className="flex justify-between items-end border-t border-rose-100 pt-2 mt-2">
          <span className="text-gray-600">
            Preço de venda{marketplace ? ` · ${marketplace.name}` : ''}
          </span>
          <span className="text-xl font-bold text-rose-500">{formatBRL(product.salePrice)}</span>
        </div>
      </div>
    </Card>
  )
}
