import { formatBRL } from '../../../lib/format'
import type { PricingResult } from '../pricing'

export interface PricingBreakdownProps {
  pricing: PricingResult
  directCost: number
  hasMarketplace: boolean
}

/**
 * Breakdown canônico de precificação (design.md 5.12): Custo direto /
 * Margem (R$) / Preço sem taxas / Taxa do marketplace / Preço de venda.
 * O líquido é o próprio preço sem taxas — sem linha separada.
 * Sem fórmulas visíveis — só resultados.
 *
 * F2: no modo reverso (líquido desejado + marketplace), o preço sem taxas É o
 * líquido desejado e a margem exibida é a efetiva — o breakdown fecha sempre
 * (preço sem taxas + taxa = preço de venda). Uma nota indica que a margem foi
 * calculada a partir do líquido desejado, com a referência da margem % abaixo.
 */
export function PricingBreakdown({ pricing, directCost, hasMarketplace }: PricingBreakdownProps) {
  return (
    <div className="border-t border-rose-100 pt-4 space-y-2 text-sm">
      <div className="flex justify-between">
        <span className="text-gray-600">Custo direto</span>
        <span className="font-medium text-gray-900">{formatBRL(directCost)}</span>
      </div>
      <div>
        <div className="flex justify-between">
          <span className="text-gray-600">Margem</span>
          <span className="font-medium text-gray-900">{formatBRL(pricing.margemValor)}</span>
        </div>
        {pricing.modoReverso && (
          <p className="text-xs text-gray-500 text-right">
            calculada a partir do líquido desejado
          </p>
        )}
      </div>
      <div>
        <div className="flex justify-between">
          <span className="text-gray-600">Preço sem taxas</span>
          <span className="font-medium text-gray-900">{formatBRL(pricing.precoSemTaxas)}</span>
        </div>
        {pricing.modoReverso && (
          <p className="text-xs text-gray-500 text-right">
            pela margem do formulário seria {formatBRL(pricing.precoSemTaxasMargem)}
          </p>
        )}
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
    </div>
  )
}
