/**
 * Categorias dos produtos finais (divisão da aba Produtos).
 * Documentos legados (sem `category`) são tratados como "Outros" —
 * a usuária reclassifica manualmente na edição.
 */
import type { Product, ProductCategory } from '../../types'

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  caderno: 'Caderno',
  amigurumi: 'Amigurumi',
  outros: 'Outros',
}

export const PRODUCT_CATEGORIES: ProductCategory[] = ['caderno', 'amigurumi', 'outros']

/** Categoria efetiva de um produto (fallback para legados sem campo). */
export function categoriaDe(produto: Pick<Product, 'category'>): ProductCategory {
  return produto.category ?? 'outros'
}
