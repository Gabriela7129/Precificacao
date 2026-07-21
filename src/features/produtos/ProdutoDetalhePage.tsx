import { Archive, ArrowLeft } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { FieldLabel, Select } from '../../components/ui/Input'
import { PercentInput } from '../../components/ui/PercentInput'
import { Skeleton } from '../../components/ui/Skeleton'
import { productDirectCost } from '../../lib/calculations'
import { formatBRL, formatDate, formatMinutes, formatPercent } from '../../lib/format'
import {
  createProduct,
  updateProduct,
  useActiveWorkspaceId,
  useMarketplaces,
  useSemiFinishedComponents,
} from '../../services/firestore'
import type { ProductComponentLine, ProductPackagingLine } from '../../types'
import { hourlyRateForProfile, useProduct, useProductVersions, useSettingsDoc } from './data'
import { computePricing } from './pricing'
import { PricingBreakdown } from './components/PricingBreakdown'

const asTimestamp = (value: unknown) => value as { toDate: () => Date } | undefined

/** /produtos/:id — detalhe em duas colunas com auto-save de margem/marketplace (design.md 5.12). */
export function ProdutoDetalhePage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const wsId = useActiveWorkspaceId()!

  const { product, loading } = useProduct(id)
  const { settings } = useSettingsDoc()
  const { data: components } = useSemiFinishedComponents()
  const { data: marketplaces } = useMarketplaces()
  const versions = useProductVersions(product)

  const [margin, setMargin] = useState<number | null>(null)
  const [marketplaceId, setMarketplaceId] = useState('')
  const [reassessOpen, setReassessOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [acting, setActing] = useState(false)

  // Inicializa os campos de precificação a partir do produto carregado.
  useEffect(() => {
    if (product) {
      setMargin(product.profitMargin)
      setMarketplaceId(product.marketplaceId ?? '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id])

  const componentsById = useMemo(() => new Map(components.map((c) => [c.id, c])), [components])

  const marketplace = useMemo(
    () => marketplaces.find((m) => m.id === marketplaceId) ?? null,
    [marketplaces, marketplaceId],
  )

  const pricing = useMemo(() => {
    if (!product) return null
    return computePricing({
      directCost: product.directCost,
      profitMargin: margin ?? 0,
      marketplace,
      desiredNetValue: product.desiredNetValue,
    })
  }, [product, margin, marketplace])

  // Auto-save com debounce de 800 ms para margem e marketplace.
  const skipFirstSave = useRef(true)
  useEffect(() => {
    if (!product || product.isArchived || !pricing) return
    if (skipFirstSave.current) {
      skipFirstSave.current = false
      return
    }
    const persisted = { margin: product.profitMargin, marketplaceId: product.marketplaceId ?? '' }
    if ((margin ?? 0) === persisted.margin && marketplaceId === persisted.marketplaceId) return

    const timer = setTimeout(() => {
      void (async () => {
        try {
          await updateProduct(wsId, product.id, {
            profitMargin: margin ?? 0,
            marketplaceId: marketplaceId || null,
            salePrice: pricing.salePrice,
          })
          toast.success('Precificação atualizada')
        } catch {
          toast.error('Não foi possível salvar. Tente novamente.')
        }
      })()
    }, 800)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [margin, marketplaceId])

  const handleReassess = async () => {
    if (!product) return
    setActing(true)
    try {
      // Nova versão com os custos de HOJE (snapshots atualizados).
      const newComponentLines: ProductComponentLine[] = product.components.map((l) => ({
        componentId: l.componentId,
        quantity: l.quantity,
        unitCostSnapshot: componentsById.get(l.componentId)?.unitCost ?? l.unitCostSnapshot,
      }))
      const newPackagingLines: ProductPackagingLine[] = product.packaging.map((l) => ({
        componentId: l.componentId,
        quantity: l.quantity,
        unitCostSnapshot: componentsById.get(l.componentId ?? '')?.unitCost ?? l.unitCostSnapshot,
      }))
      const hourlyRate = hourlyRateForProfile(settings, product.finalHumanProfile)
      const directCost = productDirectCost({
        components: newComponentLines,
        packaging: newPackagingLines,
        finalHumanTimeHours: product.finalHumanTimeHours,
        finalHumanHourlyRate: hourlyRate,
      })
      const newPricing = computePricing({
        directCost,
        profitMargin: product.profitMargin,
        marketplace: product.marketplaceId
          ? (marketplaces.find((m) => m.id === product.marketplaceId) ?? null)
          : null,
        desiredNetValue: product.desiredNetValue,
      })

      await updateProduct(wsId, product.id, { isArchived: true })
      const newId = await createProduct(wsId, {
        name: product.name,
        components: newComponentLines,
        packaging: newPackagingLines,
        finalHumanTimeHours: product.finalHumanTimeHours,
        finalHumanProfile: product.finalHumanProfile,
        directCost,
        profitMargin: product.profitMargin,
        marketplaceId: product.marketplaceId,
        desiredNetValue: product.desiredNetValue,
        salePrice: newPricing.salePrice,
        version: product.version + 1,
        isArchived: false,
      })
      toast.success(`Nova versão criada (v${product.version + 1})`)
      setReassessOpen(false)
      navigate(`/produtos/${newId}`)
    } catch {
      toast.error('Não foi possível salvar. Tente novamente.')
    } finally {
      setActing(false)
    }
  }

  const handleArchive = async () => {
    if (!product) return
    setActing(true)
    try {
      await updateProduct(wsId, product.id, { isArchived: true })
      toast.success('Produto arquivado')
      navigate('/produtos')
    } catch {
      toast.error('Não foi possível salvar. Tente novamente.')
      setActing(false)
    }
  }

  if (loading) {
    return (
      <div>
        <Skeleton className="h-8 w-64 mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    )
  }

  if (!product) {
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
          <h1 className="text-2xl font-bold text-gray-900">Produto</h1>
        </div>
        <Card>
          <p className="text-sm text-gray-600 mb-4">Produto não encontrado.</p>
          <Button variant="secondary" onClick={() => navigate('/produtos')}>
            Voltar para Produtos
          </Button>
        </Card>
      </div>
    )
  }

  // Mão de obra exibida como "resto" do custo direto — sempre consistente com o snapshot.
  const componentsCost = product.components.reduce((sum, l) => sum + l.quantity * l.unitCostSnapshot, 0)
  const packagingCost = product.packaging.reduce((sum, l) => sum + l.quantity * l.unitCostSnapshot, 0)
  const humanCost = Math.max(product.directCost - componentsCost - packagingCost, 0)
  const profileLabel = product.finalHumanProfile === 'creative' ? 'Criativa' : 'Operacional'

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
        <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
      </div>

      {product.isArchived && (
        <div className="bg-amber-100 border border-amber-300 text-amber-900 rounded-2xl p-4 text-sm flex gap-2 items-center mb-6">
          <Archive className="w-4 h-4 flex-shrink-0" />
          <span>
            Versão arquivada (v{product.version}) — somente leitura. Reavalie para gerar uma nova
            versão.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna esquerda — composição + histórico */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <h3 className="font-semibold text-gray-900 mb-4">Composição</h3>
            <div className="space-y-2">
              {product.components.map((line, i) => {
                const component = componentsById.get(line.componentId)
                const currentCost = component?.unitCost
                const changed = currentCost != null && Math.abs(currentCost - line.unitCostSnapshot) > 1e-6
                return (
                  <div key={`c-${i}`} className="flex justify-between items-center p-3 rounded-xl bg-rose-50">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">
                        {component?.name ?? 'Componente removido'}
                        {changed && (
                          <span className="text-amber-600 ml-1">
                            (atual: {formatBRL(currentCost)})
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">
                        Componente · {line.quantity} un × {formatBRL(line.unitCostSnapshot)}
                      </p>
                    </div>
                    <span className="font-medium text-gray-900 text-sm">
                      {formatBRL(line.quantity * line.unitCostSnapshot)}
                    </span>
                  </div>
                )
              })}
              {product.packaging.map((line, i) => {
                const component = componentsById.get(line.componentId ?? '')
                const currentCost = component?.unitCost
                const changed = currentCost != null && Math.abs(currentCost - line.unitCostSnapshot) > 1e-6
                return (
                  <div key={`p-${i}`} className="flex justify-between items-center p-3 rounded-xl bg-rose-50">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">
                        {component?.name ?? 'Embalagem removida'}
                        {changed && (
                          <span className="text-amber-600 ml-1">
                            (atual: {formatBRL(currentCost)})
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">
                        Embalagem · {line.quantity} un × {formatBRL(line.unitCostSnapshot)}
                      </p>
                    </div>
                    <span className="font-medium text-gray-900 text-sm">
                      {formatBRL(line.quantity * line.unitCostSnapshot)}
                    </span>
                  </div>
                )
              })}
              <div className="flex justify-between items-center p-3 rounded-xl bg-amber-50">
                <div>
                  <p className="font-medium text-gray-900 text-sm">Acabamento final</p>
                  <p className="text-xs text-gray-500">
                    {profileLabel} · {formatMinutes(Math.round(product.finalHumanTimeHours * 60))}
                  </p>
                </div>
                <span className="font-medium text-gray-900 text-sm">{formatBRL(humanCost)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 px-3">
                <span className="font-medium text-gray-900">Custo direto</span>
                <span className="text-lg font-bold text-rose-500">{formatBRL(product.directCost)}</span>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="font-semibold text-gray-900 mb-4">Histórico de versões</h3>
            <div className="space-y-2">
              {versions.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => v.id !== product.id && navigate(`/produtos/${v.id}`)}
                  className={`w-full text-left border border-rose-200 rounded-xl p-3 flex justify-between items-center transition ${
                    v.id === product.id ? 'bg-rose-50' : 'hover:bg-rose-50 cursor-pointer'
                  }`}
                >
                  <span className="font-medium text-gray-900 text-sm">v{v.version}</span>
                  <span className="text-sm text-gray-500">
                    Criado em {formatDate(asTimestamp(v.createdAt))}
                  </span>
                  <Badge variant={v.isArchived ? 'muted' : 'success'}>
                    {v.isArchived ? 'Arquivado' : 'Ativo'}
                  </Badge>
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* Coluna direita — precificação + ações */}
        <div className="space-y-6">
          <Card>
            <h3 className="font-semibold text-gray-900 mb-4">Precificação</h3>
            <div className="space-y-4">
              <div>
                <FieldLabel>Margem de lucro (%)</FieldLabel>
                <PercentInput
                  value={margin}
                  onChange={setMargin}
                  disabled={product.isArchived}
                />
              </div>
              <div>
                <FieldLabel htmlFor="marketplace">Marketplace</FieldLabel>
                <Select
                  id="marketplace"
                  value={marketplaceId}
                  onChange={(e) => setMarketplaceId(e.target.value)}
                  disabled={product.isArchived}
                >
                  <option value="">Selecione um marketplace</option>
                  {marketplaces.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({formatPercent(m.feePercentage)}
                      {m.fixedFee ? ` + ${formatBRL(m.fixedFee)}` : ''})
                    </option>
                  ))}
                </Select>
              </div>
              {pricing && (
                <PricingBreakdown
                  pricing={pricing}
                  directCost={product.directCost}
                  hasMarketplace={!!marketplace}
                />
              )}
              {product.desiredNetValue != null && (
                <p className="text-xs text-gray-500">
                  Valor líquido desejado: {formatBRL(product.desiredNetValue)}
                </p>
              )}
            </div>
          </Card>

          {!product.isArchived && (
            <Card className="space-y-2">
              <Button className="w-full" onClick={() => navigate(`/produtos/${product.id}/editar`)}>
                Editar produto
              </Button>
              <Button variant="secondary" className="w-full" onClick={() => setReassessOpen(true)}>
                Reavaliar custos
              </Button>
              <Button variant="secondary" className="w-full" onClick={() => setArchiveOpen(true)}>
                Arquivar versão
              </Button>
            </Card>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={reassessOpen}
        onClose={() => setReassessOpen(false)}
        onConfirm={() => void handleReassess()}
        title="Reavaliar custos?"
        body={`A versão atual (v${product.version}) será arquivada e uma nova versão (v${product.version + 1}) será criada com os custos de hoje.`}
        confirmLabel="Reavaliar"
        variant="primary"
        loading={acting}
      />
      <ConfirmDialog
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        onConfirm={() => void handleArchive()}
        title="Arquivar este produto?"
        body={`A versão atual (v${product.version}) ficará somente leitura na tela de arquivados.`}
        confirmLabel="Arquivar"
        variant="danger"
        loading={acting}
      />
    </div>
  )
}
