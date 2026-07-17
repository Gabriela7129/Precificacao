import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { CurrencyInput } from '../../components/ui/CurrencyInput'
import { FieldError, FieldLabel, Input, Select } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { PercentInput } from '../../components/ui/PercentInput'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { Skeleton } from '../../components/ui/Skeleton'
import { productDirectCost } from '../../lib/calculations'
import { formatBRL, formatPercent } from '../../lib/format'
import {
  createProduct,
  updateProduct,
  useActiveWorkspaceId,
  useMarketplaces,
  useSemiFinishedComponents,
  useSupplies,
} from '../../services/firestore'
import type { HumanProfile, ProductComponentLine, ProductPackagingLine } from '../../types'
import { hourlyRateForProfile, useProduct, useSettingsDoc } from './data'
import { computePricing } from './pricing'
import { productFormSchema, type ProductFormValues } from './schema'
import { PricingBreakdown } from './components/PricingBreakdown'

const profileOptions = [
  { value: 'operational' as HumanProfile, label: 'Operacional' },
  { value: 'creative' as HumanProfile, label: 'Criativa' },
]

const emptyDefaults: ProductFormValues = {
  name: '',
  components: [],
  packaging: [],
  finalHumanTimeMinutes: 0,
  finalHumanProfile: 'operational',
  profitMargin: null,
  marketplaceId: '',
  desiredNetValue: null,
}

interface ProdutoFormPageProps {
  mode: 'create' | 'edit'
}

/** Formulário de produto em duas colunas (design.md 5.13): composição + precificação ao vivo. */
function ProdutoFormPage({ mode }: ProdutoFormPageProps) {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const wsId = useActiveWorkspaceId()!

  const { product, loading: loadingProduct } = useProduct(mode === 'edit' ? id : undefined)
  const { settings } = useSettingsDoc()
  const { data: components, loading: loadingComponents } = useSemiFinishedComponents()
  const { data: supplies, loading: loadingSupplies } = useSupplies()
  const { data: marketplaces, loading: loadingMarketplaces } = useMarketplaces()

  const [saving, setSaving] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)

  const activeComponents = useMemo(() => components.filter((c) => !c.isArchived), [components])
  const activeSupplies = useMemo(() => supplies.filter((s) => s.isActive), [supplies])
  const componentsById = useMemo(() => new Map(components.map((c) => [c.id, c])), [components])
  const suppliesById = useMemo(() => new Map(supplies.map((s) => [s.id, s])), [supplies])

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors, isDirty },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    mode: 'onBlur',
    defaultValues: emptyDefaults,
  })

  const componentFields = useFieldArray({ control, name: 'components' })
  const packagingFields = useFieldArray({ control, name: 'packaging' })

  // Pré-seleciona o marketplace padrão na criação.
  useEffect(() => {
    if (mode !== 'create' || marketplaces.length === 0) return
    const current = watch('marketplaceId')
    if (current) return
    const def = marketplaces.find((m) => m.isDefault) ?? marketplaces[0]
    setValue('marketplaceId', def.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, marketplaces])

  // Popula o formulário na edição (uma vez por produto).
  useEffect(() => {
    if (mode !== 'edit' || !product) return
    reset({
      name: product.name,
      components: product.components.map((l) => ({ componentId: l.componentId, quantity: l.quantity })),
      packaging: product.packaging.map((l) => ({ supplyId: l.supplyId, quantity: l.quantity })),
      finalHumanTimeMinutes: Math.round(product.finalHumanTimeHours * 60),
      finalHumanProfile: product.finalHumanProfile,
      profitMargin: product.profitMargin,
      marketplaceId: product.marketplaceId ?? '',
      desiredNetValue: product.desiredNetValue,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, product?.id])

  // Produto arquivado não é editável — volta para o detalhe (somente leitura).
  useEffect(() => {
    if (mode === 'edit' && product?.isArchived) {
      navigate(`/produtos/${product.id}`, { replace: true })
    }
  }, [mode, product, navigate])

  const values = watch()

  // Cálculo ao vivo: snapshots atuais de custo + valor hora do perfil.
  const live = useMemo(() => {
    const componentLines: ProductComponentLine[] = (values.components ?? [])
      .filter((l) => l.componentId && Number.isFinite(l.quantity))
      .map((l) => ({
        componentId: l.componentId,
        quantity: l.quantity,
        unitCostSnapshot: componentsById.get(l.componentId)?.unitCost ?? 0,
      }))
    const packagingLines: ProductPackagingLine[] = (values.packaging ?? [])
      .filter((l) => l.supplyId && Number.isFinite(l.quantity))
      .map((l) => ({
        supplyId: l.supplyId,
        quantity: l.quantity,
        unitCostSnapshot: suppliesById.get(l.supplyId)?.averageCost ?? 0,
      }))
    const profile = values.finalHumanProfile ?? 'operational'
    const hourlyRate = hourlyRateForProfile(settings, profile)
    const finalHumanTimeHours = (values.finalHumanTimeMinutes ?? 0) / 60
    const directCost = productDirectCost({
      components: componentLines,
      packaging: packagingLines,
      finalHumanTimeHours,
      finalHumanHourlyRate: hourlyRate,
    })
    const marketplace = marketplaces.find((m) => m.id === values.marketplaceId) ?? null
    const pricing = computePricing({
      directCost,
      profitMargin: values.profitMargin ?? 0,
      marketplace,
      desiredNetValue: values.desiredNetValue ?? null,
    })
    return { componentLines, packagingLines, finalHumanTimeHours, directCost, marketplace, pricing }
  }, [values, componentsById, suppliesById, settings, marketplaces])

  const handleCancel = () => {
    if (isDirty) setDiscardOpen(true)
    else navigate(mode === 'edit' && product ? `/produtos/${product.id}` : '/produtos')
  }

  const onSubmit = async (formValues: ProductFormValues) => {
    setSaving(true)
    try {
      const payload = {
        name: formValues.name.trim(),
        components: live.componentLines,
        packaging: live.packagingLines,
        finalHumanTimeHours: live.finalHumanTimeHours,
        finalHumanProfile: formValues.finalHumanProfile,
        directCost: live.directCost,
        profitMargin: formValues.profitMargin ?? 0,
        marketplaceId: formValues.marketplaceId || null,
        desiredNetValue: formValues.desiredNetValue ?? null,
        salePrice: live.pricing.salePrice,
      }
      if (mode === 'create') {
        const newId = await createProduct(wsId, { ...payload, version: 1, isArchived: false })
        toast.success('Produto salvo com sucesso')
        navigate(`/produtos/${newId}`)
      } else if (product) {
        await updateProduct(wsId, product.id, payload)
        toast.success('Produto salvo com sucesso')
        navigate(`/produtos/${product.id}`)
      }
    } catch {
      toast.error('Não foi possível salvar. Tente novamente.')
      setSaving(false)
    }
  }

  const firstLoading =
    loadingComponents || loadingSupplies || loadingMarketplaces || (mode === 'edit' && loadingProduct)

  if (mode === 'edit' && !loadingProduct && !product) {
    return (
      <div>
        <PageHeader title="Editar produto" />
        <Card>
          <p className="text-sm text-gray-600 mb-4">Produto não encontrado.</p>
          <Button variant="secondary" onClick={() => navigate('/produtos')}>
            Voltar para Produtos
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title={mode === 'create' ? 'Novo produto' : 'Editar produto'} />

      {firstLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Coluna esquerda — composição */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <FieldLabel htmlFor="name">Nome do produto</FieldLabel>
                <Input id="name" placeholder="Ex.: Caderno A5 Capa Dura" error={!!errors.name} {...register('name')} />
                {errors.name && <FieldError>{errors.name.message}</FieldError>}
              </Card>

              {/* Componentes semi-acabados */}
              <Card>
                <h3 className="font-semibold text-gray-900 mb-4">Componentes</h3>
                <div className="space-y-3">
                  {componentFields.fields.map((field, index) => {
                    const line = values.components?.[index]
                    const unitCost = line?.componentId
                      ? (componentsById.get(line.componentId)?.unitCost ?? 0)
                      : null
                    const subtotal =
                      unitCost != null && Number.isFinite(line?.quantity)
                        ? unitCost * (line?.quantity ?? 0)
                        : null
                    return (
                      <div key={field.id} className="flex gap-3 items-start">
                        <div className="flex-1">
                          <Select
                            error={!!errors.components?.[index]?.componentId}
                            {...register(`components.${index}.componentId`)}
                          >
                            <option value="">Selecione um componente</option>
                            {activeComponents.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </Select>
                          {errors.components?.[index]?.componentId && (
                            <FieldError>{errors.components?.[index]?.componentId?.message}</FieldError>
                          )}
                        </div>
                        <div className="w-28">
                          <Input
                            type="number"
                            step="any"
                            min={0}
                            placeholder="Qtd."
                            error={!!errors.components?.[index]?.quantity}
                            {...register(`components.${index}.quantity`, { valueAsNumber: true })}
                          />
                          {errors.components?.[index]?.quantity && (
                            <FieldError>{errors.components?.[index]?.quantity?.message}</FieldError>
                          )}
                        </div>
                        <div className="w-24 text-right text-sm text-gray-600 pt-2">
                          {subtotal != null ? formatBRL(subtotal) : '—'}
                        </div>
                        <button
                          type="button"
                          onClick={() => componentFields.remove(index)}
                          className="p-2 text-gray-400 hover:text-red-600 transition"
                          aria-label="Remover componente"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => componentFields.append({ componentId: '', quantity: 1 })}
                  >
                    <Plus className="w-4 h-4" /> Adicionar componente
                  </Button>
                </div>
              </Card>

              {/* Embalagem — insumos avulsos */}
              <Card>
                <h3 className="font-semibold text-gray-900 mb-4">Embalagem</h3>
                <div className="space-y-3">
                  {packagingFields.fields.map((field, index) => {
                    const line = values.packaging?.[index]
                    const supply = line?.supplyId ? suppliesById.get(line.supplyId) : undefined
                    const subtotal =
                      supply && Number.isFinite(line?.quantity)
                        ? supply.averageCost * (line?.quantity ?? 0)
                        : null
                    return (
                      <div key={field.id} className="flex gap-3 items-start">
                        <div className="flex-1">
                          <Select
                            error={!!errors.packaging?.[index]?.supplyId}
                            {...register(`packaging.${index}.supplyId`)}
                          >
                            <option value="">Selecione um insumo</option>
                            {activeSupplies.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name} ({s.unit})
                              </option>
                            ))}
                          </Select>
                          {errors.packaging?.[index]?.supplyId && (
                            <FieldError>{errors.packaging?.[index]?.supplyId?.message}</FieldError>
                          )}
                        </div>
                        <div className="w-28">
                          <Input
                            type="number"
                            step="any"
                            min={0}
                            placeholder="Qtd."
                            error={!!errors.packaging?.[index]?.quantity}
                            {...register(`packaging.${index}.quantity`, { valueAsNumber: true })}
                          />
                          {errors.packaging?.[index]?.quantity && (
                            <FieldError>{errors.packaging?.[index]?.quantity?.message}</FieldError>
                          )}
                        </div>
                        <div className="w-24 text-right text-sm text-gray-600 pt-2">
                          {subtotal != null ? formatBRL(subtotal) : '—'}
                        </div>
                        <button
                          type="button"
                          onClick={() => packagingFields.remove(index)}
                          className="p-2 text-gray-400 hover:text-red-600 transition"
                          aria-label="Remover embalagem"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => packagingFields.append({ supplyId: '', quantity: 1 })}
                  >
                    <Plus className="w-4 h-4" /> Adicionar embalagem
                  </Button>
                </div>
              </Card>

              {/* Acabamento final — tempo humano */}
              <Card>
                <h3 className="font-semibold text-gray-900 mb-4">Acabamento final</h3>
                <Controller
                  control={control}
                  name="finalHumanProfile"
                  render={({ field }) => (
                    <SegmentedControl options={profileOptions} value={field.value} onChange={field.onChange} />
                  )}
                />
                <div className="mt-4">
                  <FieldLabel htmlFor="finalHumanTimeMinutes">Tempo (minutos)</FieldLabel>
                  <Input
                    id="finalHumanTimeMinutes"
                    type="number"
                    step="any"
                    min={0}
                    error={!!errors.finalHumanTimeMinutes}
                    {...register('finalHumanTimeMinutes', { valueAsNumber: true })}
                  />
                  {errors.finalHumanTimeMinutes && (
                    <FieldError>{errors.finalHumanTimeMinutes.message}</FieldError>
                  )}
                </div>
              </Card>
            </div>

            {/* Coluna direita — precificação ao vivo + ações */}
            <div className="space-y-6">
              <Card>
                <h3 className="font-semibold text-gray-900 mb-4">Precificação</h3>
                <div className="space-y-4">
                  <div>
                    <FieldLabel>Margem de lucro (%)</FieldLabel>
                    <Controller
                      control={control}
                      name="profitMargin"
                      render={({ field }) => (
                        <PercentInput value={field.value} onChange={field.onChange} error={!!errors.profitMargin} />
                      )}
                    />
                    {errors.profitMargin && <FieldError>{errors.profitMargin.message}</FieldError>}
                  </div>
                  <div>
                    <FieldLabel htmlFor="marketplaceId">Marketplace</FieldLabel>
                    <Select id="marketplaceId" {...register('marketplaceId')}>
                      <option value="">Selecione um marketplace</option>
                      {marketplaces.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({formatPercent(m.feePercentage)}
                          {m.fixedFee ? ` + ${formatBRL(m.fixedFee)}` : ''})
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <FieldLabel>Valor líquido desejado</FieldLabel>
                    <Controller
                      control={control}
                      name="desiredNetValue"
                      render={({ field }) => (
                        <CurrencyInput
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Opcional"
                          error={!!errors.desiredNetValue}
                        />
                      )}
                    />
                    {errors.desiredNetValue ? (
                      <FieldError>{errors.desiredNetValue.message}</FieldError>
                    ) : (
                      <p className="text-xs text-gray-500 mt-1">
                        Preencha para calcular o preço de venda a partir do líquido desejado.
                      </p>
                    )}
                  </div>
                  <PricingBreakdown
                    pricing={live.pricing}
                    directCost={live.directCost}
                    hasMarketplace={!!live.marketplace}
                  />
                </div>
              </Card>

              <Card className="space-y-2">
                <Button type="submit" className="w-full" loading={saving}>
                  Salvar produto
                </Button>
                <Button type="button" variant="secondary" className="w-full" onClick={handleCancel} disabled={saving}>
                  Cancelar
                </Button>
              </Card>
            </div>
          </div>
        </form>
      )}

      <ConfirmDialog
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        onConfirm={() => {
          setDiscardOpen(false)
          navigate(mode === 'edit' && product ? `/produtos/${product.id}` : '/produtos')
        }}
        title="Descartar alterações?"
        body="As alterações não salvas serão perdidas."
        confirmLabel="Descartar"
        variant="danger"
      />
    </div>
  )
}

/** /produtos/novo */
export function ProdutoNovoPage() {
  return <ProdutoFormPage mode="create" />
}

/** /produtos/:id/editar */
export function ProdutoEditarPage() {
  return <ProdutoFormPage mode="edit" />
}
