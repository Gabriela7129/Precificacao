import { formatBRL } from '../../../lib/format'
import type { PricingResult } from '../pricing'

export interface PricingBreakdownProps {
  pricing: PricingResult
  directCost: number
  hasMarketplace: boolean
}

/**
 * Breakdown canônico de precificação (design.md 5.12): Custo direto /
 * Margem (R$) / Preço sem taxas / Taxa do marketplace / Preço de venda /
 * Valor líquido. Sem fórmulas visíveis — só resultados.
 */
export function PricingBreakdown({ pricing, directCost, hasMarketplace }: PricingBreakdownProps) {
  return (
    <div className="border-t border-rose-100 pt-4 space-y-2 text-sm">
      <div className="flex justify-between">
        <span className="text-gray-600">Custo direto</span>
        <span className="font-medium text-gray-900">{formatBRL(directCost)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-600">Margem</span>
        <span className="font-medium text-gray-900">{formatBRL(pricing.margemValor)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-600">Preço sem taxas</span>
        <span className="font-medium text-gray-900">{formatBRL(pricing.precoSemTaxas)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-600">Taxa do marketplace</span>
        <span className="font-medium text-gray-900">
          {hasMarketplace ? formatBRL(pricing.taxaMarketplace) : '—'}
        </span>
      </div>
      <div className="flex justify-between items-center border-t border-rose-100 pt-2">
        <span className="font-medium text-gray-900">Preço de venda</span>
        <span className="text-lg font-bold text-rose-500">{formatBRL(pricing.salePrice)}</span>
      </div>
      <div className="flex justify-between text-sm text-gray-500">
        <span>Valor líquido</span>
        <span>{formatBRL(pricing.valorLiquido)}</span>
      </div>
    </div>
  )
}
