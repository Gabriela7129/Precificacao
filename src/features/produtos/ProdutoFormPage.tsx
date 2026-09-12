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
import { SelectSearchable } from '../../components/ui'
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
  useLightTools,
  useMarketplaces,
  useSemiFinishedComponents,
  useSupplies,
  useHeavyAssets,
} from '../../services/firestore'
import type { HumanProfile, ProductComponentLine, ProductLightToolLine, ProductMachineLine, ProductPackagingLine, ProductSupplyLine } from '../../types'
import { analisarLevesCompartilhados, hourlyRateForProfile, useProduct, useSettingsDoc } from './data'
import { computePricing } from './pricing'
import { productFormSchema, type ProductFormValues } from './schema'
import { PricingBreakdown } from './components/PricingBreakdown'

const profileOptions = [
  { value: 'operational' as HumanProfile, label: 'Operacional' },
  { value: 'creative' as HumanProfile, label: 'Criativa' },
]

const emptyDefaults: ProductFormValues = {
  name: '',
  supplies: [],
  components: [],
  packaging: [],
  machineAssets: [],
  lightTools: [],
  // snapshots are populated on edit; create leaves them null
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
  const { data: marketplaces, loading: loadingMarketplaces } = useMarketplaces()
  const { data: lightTools } = useLightTools()
  const { data: supplies, loading: loadingSupplies } = useSupplies()
  const { data: heavyAssets } = useHeavyAssets()

  const [saving, setSaving] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)

  const activeComponents = useMemo(() => components.filter((c) => !c.isArchived && !c.isPackaging), [components])
  const packagingComponents = useMemo(() => components.filter((c) => !c.isArchived && c.isPackaging), [components])
  const componentsById = useMemo(() => new Map(components.map((c) => [c.id, c])), [components])
  const activeLightTools = useMemo(() => lightTools.filter((t) => t.isActive), [lightTools])
  const lightToolsById = useMemo(() => new Map(lightTools.map((t) => [t.id, t])), [lightTools])
  const heavyAssetsById = useMemo(() => new Map(heavyAssets.map((a) => [a.id, a])), [heavyAssets])
  const activeSupplies = useMemo(() => supplies.filter((s) => s.isActive), [supplies])
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

  const supplyFields = useFieldArray({ control, name: 'supplies' })
  const componentFields = useFieldArray({ control, name: 'components' })
  const packagingFields = useFieldArray({ control, name: 'packaging' })
  const machineFields = useFieldArray({ control, name: 'machineAssets' })
  const lightToolFields = useFieldArray({ control, name: 'lightTools' })

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
      supplies: (product.supplies ?? []).map((l) => ({ supplyId: l.supplyId, quantity: l.quantity, unitCostSnapshot: l.unitCostSnapshot })),
      components: product.components.map((l) => ({ componentId: l.componentId, quantity: l.quantity, unitCostSnapshot: l.unitCostSnapshot })),
      packaging: product.packaging.map((l) => ({ componentId: l.componentId ?? l.supplyId, quantity: l.quantity, unitCostSnapshot: l.unitCostSnapshot })),
      machineAssets: (product.machineAssets ?? []).map((l) => ({ assetId: l.assetId, timeMinutes: l.timeMinutes, costPerHourSnapshot: l.costPerHourSnapshot })),
      lightTools: (product.lightTools ?? []).map((l) => ({ toolId: l.toolId, costSnapshot: l.costSnapshot })),
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

  // F1 (integridade histórica): na edição, o valor-hora salvo no produto é
  // preservado; trocar o perfil de mão de obra resolve para as settings atuais.
  const savedFinalHumanHourlyRate =
    mode === 'edit' && product && values.finalHumanProfile === product.finalHumanProfile
      ? (product.finalHumanHourlyRate ?? null)
      : null

  // Cálculo ao vivo: F1 — snapshots salvos são PRESERVADOS na edição; linhas
  // novas (ou com entidade trocada) usam o custo ATUAL.
  const live = useMemo(() => {
    const supplyLines: ProductSupplyLine[] = (values.supplies ?? [])
      .filter((l) => l.supplyId && Number.isFinite(l.quantity))
      .map((l) => ({
        supplyId: l.supplyId,
        quantity: l.quantity,
        unitCostSnapshot: l.unitCostSnapshot ?? suppliesById.get(l.supplyId)?.averageCost ?? 0,
      }))
    const componentLines: ProductComponentLine[] = (values.components ?? [])
      .filter((l) => l.componentId && Number.isFinite(l.quantity))
      .map((l) => ({
        componentId: l.componentId,
        quantity: l.quantity,
        unitCostSnapshot: l.unitCostSnapshot ?? componentsById.get(l.componentId)?.unitCost ?? 0,
      }))
    const packagingLines: ProductPackagingLine[] = (values.packaging ?? [])
      .filter((l) => l.componentId && Number.isFinite(l.quantity))
      .map((l) => ({
        componentId: l.componentId,
        quantity: l.quantity,
        unitCostSnapshot: l.unitCostSnapshot ?? componentsById.get(l.componentId)?.unitCost ?? 0,
      }))
    const machineLines: ProductMachineLine[] = (values.machineAssets ?? [])
      .filter((l) => l.assetId && Number.isFinite(l.timeMinutes))
      .map((l) => ({
        assetId: l.assetId,
        timeMinutes: l.timeMinutes,
        costPerHourSnapshot: l.costPerHourSnapshot ?? heavyAssetsById.get(l.assetId)?.totalCostPerHour ?? 0,
      }))
    const directLightToolLines: ProductLightToolLine[] = (values.lightTools ?? [])
      .filter((l) => l.toolId)
      .map((l) => ({
        toolId: l.toolId,
        costSnapshot: l.costSnapshot ?? lightToolsById.get(l.toolId)?.monthlyMaintenanceCost ?? 0,
      }))
    const profile = values.finalHumanProfile ?? 'operational'
    const settingsHourlyRate = hourlyRateForProfile(settings, profile)
    // F1: valor-hora do acabamento — snapshot preservado na edição; fallback
    // (criação/legado/troca de perfil) usa as settings atuais.
    const hourlyRate = savedFinalHumanHourlyRate ?? settingsHourlyRate
    const finalHumanTimeHours = (values.finalHumanTimeMinutes ?? 0) / 60
    // Materiais leves compartilhados: contados 1× no produto (dedução das repetições).
    // Inclui os materiais leves adicionados diretamente ao produto.
    const sharedLightTools = analisarLevesCompartilhados(
      componentLines,
      packagingLines,
      componentsById,
      lightToolsById,
      directLightToolLines,
    )
    const directCost = productDirectCost({
      components: componentLines,
      packaging: packagingLines,
      supplies: supplyLines,
      machineAssets: machineLines,
      lightTools: directLightToolLines,
      finalHumanTimeHours,
      finalHumanHourlyRate: hourlyRate,
      lightToolDeduction: sharedLightTools.deduction,
    })
    const marketplace = marketplaces.find((m) => m.id === values.marketplaceId) ?? null
    const pricing = computePricing({
      directCost,
      profitMargin: values.profitMargin ?? 0,
      marketplace,
      desiredNetValue: values.desiredNetValue ?? null,
    })
    return { supplyLines, componentLines, packagingLines, machineLines, directLightToolLines, finalHumanTimeHours, finalHumanHourlyRate: hourlyRate, directCost, marketplace, pricing, sharedLightTools }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, componentsById, lightToolsById, suppliesById, heavyAssetsById, settings, marketplaces, savedFinalHumanHourlyRate])

  const handleCancel = () => {
    if (isDirty) setDiscardOpen(true)
    else navigate(mode === 'edit' && product ? `/produtos/${product.id}` : '/produtos')
  }

  const onSubmit = async (formValues: ProductFormValues) => {
    setSaving(true)
    try {
      const payload = {
        name: formValues.name.trim(),
        supplies: live.supplyLines,
        components: live.componentLines,
        packaging: live.packagingLines,
        machineAssets: live.machineLines,
        lightTools: live.directLightToolLines,
        finalHumanTimeHours: live.finalHumanTimeHours,
        finalHumanProfile: formValues.finalHumanProfile,
        finalHumanHourlyRate: live.finalHumanHourlyRate,
        directCost: live.directCost,
        lightToolDeduction: live.sharedLightTools.deduction,
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
    loadingComponents || loadingMarketplaces || loadingSupplies || (mode === 'edit' && loadingProduct)

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

              {/* Insumos extras — detalhes pequenos direto no produto (mesma lógica dos componentes) */}
              <Card>
                <h3 className="font-semibold text-gray-900 mb-1">Insumos extras</h3>
                <p className="text-xs text-gray-500 mb-4">
                  Para detalhes pequenos colocados direto no produto (ex.: uma fita de cetim a
                  mais) sem precisar criar um componente.
                </p>
                <div className="space-y-3">
                  {supplyFields.fields.map((field, index) => {
                    const line = values.supplies?.[index]
                    const supply = line?.supplyId ? suppliesById.get(line.supplyId) : undefined
                    const currentUnitCost = supply?.averageCost ?? null
                    const savedSnapshot = line?.unitCostSnapshot
                    const hasChanged = currentUnitCost != null && savedSnapshot != null && Math.abs(currentUnitCost - savedSnapshot) > 1e-6
                    // F1: o subtotal exibido (e salvo) usa o snapshot preservado; linha nova usa o custo atual.
                    const effectiveUnitCost = savedSnapshot ?? currentUnitCost
                    const subtotal =
                      effectiveUnitCost != null && Number.isFinite(line?.quantity)
                        ? effectiveUnitCost * (line?.quantity ?? 0)
                        : null
                    return (
                      <div key={field.id} className="flex gap-3 items-start">
                        <div className="flex-1">
                          <Controller
                            control={control}
                            name={`supplies.${index}.supplyId`}
                            render={({ field: { onChange, value } }) => (
                              <SelectSearchable
                                options={activeSupplies
                                  .filter((s) => !values.supplies?.some((existing, i) => existing.supplyId === s.id && i !== index))
                                  .map((s) => ({
                                    value: s.id,
                                    label: `${s.name} (${formatBRL(s.averageCost)}/${s.unit})`,
                                  }))}
                                value={value}
                                onChange={(next) => {
                                  // F1: trocar o insumo descarta o snapshot (custo atual será resolvido).
                                  if (next !== value) setValue(`supplies.${index}.unitCostSnapshot`, null)
                                  onChange(next)
                                }}
                                placeholder="Selecione um insumo"
                              />
                            )}
                          />
                          {errors.supplies?.[index]?.supplyId && (
                            <FieldError>{errors.supplies?.[index]?.supplyId?.message}</FieldError>
                          )}
                          {hasChanged && (
                            <p className="text-xs text-amber-600 mt-1">
                              Valor atual: {formatBRL(currentUnitCost)} — use Reavaliar custos para atualizar.
                            </p>
                          )}
                        </div>
                        <div className="w-28">
                          <Input
                            type="number"
                            step="any"
                            min={0}
                            placeholder="Qtd."
                            error={!!errors.supplies?.[index]?.quantity}
                            {...register(`supplies.${index}.quantity`, { valueAsNumber: true })}
                          />
                          {errors.supplies?.[index]?.quantity && (
                            <FieldError>{errors.supplies?.[index]?.quantity?.message}</FieldError>
                          )}
                        </div>
                        <div className="w-24 text-right text-sm text-gray-600 pt-2">
                          {subtotal != null ? formatBRL(subtotal) : '—'}
                        </div>
                        <button
                          type="button"
                          onClick={() => supplyFields.remove(index)}
                          className="p-2 text-gray-400 hover:text-red-600 transition"
                          aria-label="Remover insumo"
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
                    onClick={() => supplyFields.append({ supplyId: '', quantity: 1, unitCostSnapshot: null })}
                  >
                    <Plus className="w-4 h-4" /> Adicionar insumo
                  </Button>
                </div>
              </Card>

              {/* Componentes semi-acabados */}
              <Card>
                <h3 className="font-semibold text-gray-900 mb-4">Componentes</h3>
                <div className="space-y-3">
                  {componentFields.fields.map((field, index) => {
                    const line = values.components?.[index]
                    const component = line?.componentId ? componentsById.get(line.componentId) : undefined
                    const currentUnitCost = component?.unitCost ?? null
                    const savedSnapshot = line?.unitCostSnapshot
                    const hasChanged = currentUnitCost != null && savedSnapshot != null && Math.abs(currentUnitCost - savedSnapshot) > 1e-6
                    // F1: o subtotal exibido (e salvo) usa o snapshot preservado; linha nova usa o custo atual.
                    const unitCost = savedSnapshot ?? currentUnitCost
                    const subtotal =
                      unitCost != null && Number.isFinite(line?.quantity)
                        ? unitCost * (line?.quantity ?? 0)
                        : null
                    return (
                      <div key={field.id} className="flex gap-3 items-start">
                        <div className="flex-1">
                          <Controller
                            control={control}
                            name={`components.${index}.componentId`}
                            render={({ field: { onChange, value } }) => (
                              <SelectSearchable
                                options={activeComponents
                                  .filter((c) => !values.components?.some((existing, i) => existing.componentId === c.id && i !== index))
                                  .map((c) => ({ value: c.id, label: c.name }))}
                                value={value}
                                onChange={(next) => {
                                  // F1: trocar o componente descarta o snapshot (custo atual será resolvido).
                                  if (next !== value) setValue(`components.${index}.unitCostSnapshot`, null)
                                  onChange(next)
                                }}
                                placeholder="Selecione um componente"
                              />
                            )}
                          />
                          {errors.components?.[index]?.componentId && (
                            <FieldError>{errors.components?.[index]?.componentId?.message}</FieldError>
                          )}
                          {hasChanged && (
                            <p className="text-xs text-amber-600 mt-1">
                              Valor atual: {formatBRL(currentUnitCost)} — use Reavaliar custos para atualizar.
                            </p>
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
                    onClick={() => componentFields.append({ componentId: '', quantity: 1, unitCostSnapshot: null })}
                  >
                    <Plus className="w-4 h-4" /> Adicionar componente
                  </Button>
                </div>
              </Card>

              {/* Embalagem — componentes marcados como embalagem */}
              <Card>
                <h3 className="font-semibold text-gray-900 mb-4">Embalagem</h3>
                <div className="space-y-3">
                  {packagingFields.fields.map((field, index) => {
                    const line = values.packaging?.[index]
                    const component = line?.componentId ? componentsById.get(line.componentId) : undefined
                    const currentUnitCost = component?.unitCost ?? null
                    const savedSnapshot = line?.unitCostSnapshot
                    const hasChanged = currentUnitCost != null && savedSnapshot != null && Math.abs(currentUnitCost - savedSnapshot) > 1e-6
                    // F1: o subtotal exibido (e salvo) usa o snapshot preservado; linha nova usa o custo atual.
                    const unitCost = savedSnapshot ?? currentUnitCost
                    const subtotal =
                      unitCost != null && Number.isFinite(line?.quantity)
                        ? unitCost * (line?.quantity ?? 0)
                        : null
                    return (
                      <div key={field.id} className="flex gap-3 items-start">
                        <div className="flex-1">
                          <Controller
                            control={control}
                            name={`packaging.${index}.componentId`}
                            render={({ field: { onChange, value } }) => (
                              <SelectSearchable
                                options={packagingComponents
                                  .filter((c) => !values.packaging?.some((existing, i) => existing.componentId === c.id && i !== index))
                                  .map((c) => ({ value: c.id, label: c.name }))}
                                value={value}
                                onChange={(next) => {
                                  // F1: trocar a embalagem descarta o snapshot (custo atual será resolvido).
                                  if (next !== value) setValue(`packaging.${index}.unitCostSnapshot`, null)
                                  onChange(next)
                                }}
                                placeholder="Selecione uma embalagem"
                              />
                            )}
                          />
                          {errors.packaging?.[index]?.componentId && (
                            <FieldError>{errors.packaging?.[index]?.componentId?.message}</FieldError>
                          )}
                          {hasChanged && (
                            <p className="text-xs text-amber-600 mt-1">
                              Valor atual: {formatBRL(currentUnitCost)} — use Reavaliar custos para atualizar.
                            </p>
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
                    onClick={() => packagingFields.append({ componentId: '', quantity: 1, unitCostSnapshot: null })}
                  >
                    <Plus className="w-4 h-4" /> Adicionar embalagem
                  </Button>
                </div>
              </Card>

              {/* Ativos pesados diretos no produto (tempo de uso × custo/hora) */}
              <Card>
                <h3 className="font-semibold text-gray-900 mb-1">Ativos pesados</h3>
                <p className="text-xs text-gray-500 mb-4">
                  Uso direto de ativos pesados no produto (tempo de uso × custo/hora do ativo).
                </p>
                <div className="space-y-3">
                  {machineFields.fields.map((field, index) => {
                    const line = values.machineAssets?.[index]
                    const asset = line?.assetId ? heavyAssetsById.get(line.assetId) : undefined
                    const currentCostPerHour = asset?.totalCostPerHour ?? null
                    const savedSnapshot = line?.costPerHourSnapshot
                    const hasChanged = currentCostPerHour != null && savedSnapshot != null && Math.abs(currentCostPerHour - savedSnapshot) > 1e-6
                    // F1: o subtotal exibido (e salvo) usa o snapshot preservado; linha nova usa o custo atual.
                    const effectiveCostPerHour = savedSnapshot ?? currentCostPerHour
                    const subtotal =
                      effectiveCostPerHour != null && Number.isFinite(line?.timeMinutes)
                        ? ((line?.timeMinutes ?? 0) / 60) * effectiveCostPerHour
                        : null
                    return (
                      <div key={field.id} className="flex gap-3 items-start">
                        <div className="flex-1">
                          <Controller
                            control={control}
                            name={`machineAssets.${index}.assetId`}
                            render={({ field: { onChange, value } }) => (
                              <SelectSearchable
                                options={heavyAssets
                                  .filter((a) => !values.machineAssets?.some((existing, i) => existing.assetId === a.id && i !== index))
                                  .map((a) => ({
                                    value: a.id,
                                    label: `${a.name} (${formatBRL(a.totalCostPerHour)}/h)`,
                                  }))}
                                value={value}
                                onChange={(next) => {
                                  // F1: trocar o ativo descarta o snapshot (custo atual será resolvido).
                                  if (next !== value) setValue(`machineAssets.${index}.costPerHourSnapshot`, null)
                                  onChange(next)
                                }}
                                placeholder="Selecione um ativo"
                              />
                            )}
                          />
                          {errors.machineAssets?.[index]?.assetId && (
                            <FieldError>{errors.machineAssets?.[index]?.assetId?.message}</FieldError>
                          )}
                          {hasChanged && (
                            <p className="text-xs text-amber-600 mt-1">
                              Valor atual: {formatBRL(currentCostPerHour)}/h — use Reavaliar custos para atualizar.
                            </p>
                          )}
                        </div>
                        <div className="w-28">
                          <Input
                            type="number"
                            step="1"
                            min={0}
                            placeholder="Min."
                            error={!!errors.machineAssets?.[index]?.timeMinutes}
                            {...register(`machineAssets.${index}.timeMinutes`, { valueAsNumber: true })}
                          />
                          {errors.machineAssets?.[index]?.timeMinutes && (
                            <FieldError>{errors.machineAssets?.[index]?.timeMinutes?.message}</FieldError>
                          )}
                        </div>
                        <div className="w-24 text-right text-sm text-gray-600 pt-2">
                          {subtotal != null ? formatBRL(subtotal) : '—'}
                        </div>
                        <button
                          type="button"
                          onClick={() => machineFields.remove(index)}
                          className="p-2 text-gray-400 hover:text-red-600 transition"
                          aria-label="Remover ativo"
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
                    onClick={() => machineFields.append({ assetId: '', timeMinutes: 0, costPerHourSnapshot: null })}
                  >
                    <Plus className="w-4 h-4" /> Adicionar ativo
                  </Button>
                </div>
              </Card>

              {/* Materiais leves diretos no produto (custo fixo; regra de contagem 1×) */}
              <Card>
                <h3 className="font-semibold text-gray-900 mb-1">Materiais leves</h3>
                <p className="text-xs text-gray-500 mb-4">
                  Cada material entra com custo fixo (manutenção mensal). Se o mesmo material já
                  estiver em um componente/embalagem, ele é contado <strong>apenas uma vez</strong>{' '}
                  no produto.
                </p>
                <div className="space-y-3">
                  {lightToolFields.fields.map((field, index) => {
                    const line = values.lightTools?.[index]
                    const tool = line?.toolId ? lightToolsById.get(line.toolId) : undefined
                    const currentCost = tool?.monthlyMaintenanceCost ?? null
                    const savedSnapshot = line?.costSnapshot
                    const hasChanged = currentCost != null && savedSnapshot != null && Math.abs(currentCost - savedSnapshot) > 1e-6
                    // F1: o custo exibido (e salvo) usa o snapshot preservado; linha nova usa o custo atual.
                    const effectiveCost = savedSnapshot ?? currentCost
                    return (
                      <div key={field.id} className="flex gap-3 items-start">
                        <div className="flex-1">
                          <Controller
                            control={control}
                            name={`lightTools.${index}.toolId`}
                            render={({ field: { onChange, value } }) => (
                              <SelectSearchable
                                options={activeLightTools
                                  .filter((t) => !values.lightTools?.some((existing, i) => existing.toolId === t.id && i !== index))
                                  .map((t) => ({
                                    value: t.id,
                                    label: `${t.name} (${formatBRL(t.monthlyMaintenanceCost)})`,
                                  }))}
                                value={value}
                                onChange={(next) => {
                                  // F1: trocar o material descarta o snapshot (custo atual será resolvido).
                                  if (next !== value) setValue(`lightTools.${index}.costSnapshot`, null)
                                  onChange(next)
                                }}
                                placeholder="Selecione um material leve"
                              />
                            )}
                          />
                          {errors.lightTools?.[index]?.toolId && (
                            <FieldError>{errors.lightTools?.[index]?.toolId?.message}</FieldError>
                          )}
                          {hasChanged && (
                            <p className="text-xs text-amber-600 mt-1">
                              Valor atual: {formatBRL(currentCost)} — use Reavaliar custos para atualizar.
                            </p>
                          )}
                        </div>
                        <div className="w-24 text-right text-sm text-gray-600 pt-2">
                          {effectiveCost != null ? formatBRL(effectiveCost) : '—'}
                        </div>
                        <button
                          type="button"
                          onClick={() => lightToolFields.remove(index)}
                          className="p-2 text-gray-400 hover:text-red-600 transition"
                          aria-label="Remover material leve"
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
                    onClick={() => lightToolFields.append({ toolId: '', costSnapshot: null })}
                  >
                    <Plus className="w-4 h-4" /> Adicionar material leve
                  </Button>
                </div>
              </Card>

              {/* Materiais leves compartilhados — informação entre embalagem e acabamento */}
              {live.sharedLightTools.infos.length > 0 && (
                <Card className="bg-amber-50 border-amber-200">
                  <h3 className="font-semibold text-gray-900 mb-1">
                    Materiais leves compartilhados
                  </h3>
                  <p className="text-xs text-gray-600 mb-3">
                    Estes materiais aparecem em mais de um componente/embalagem (ou em
                    quantidade maior que 1) e são contabilizados <strong>apenas uma vez</strong> no
                    custo do produto.
                  </p>
                  <div className="space-y-1.5">
                    {live.sharedLightTools.infos.map((info) => (
                      <div key={info.toolId} className="flex justify-between items-center text-sm">
                        <span className="text-gray-700">
                          {info.toolName}{' '}
                          <span className="text-xs text-gray-500">
                            ({info.occurrences}× {formatBRL(info.unitCost)})
                          </span>
                        </span>
                        <span className="font-medium text-green-700">
                          − {formatBRL(info.deduction)}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center border-t border-amber-200 pt-1.5 text-sm">
                      <span className="font-medium text-gray-900">Dedução total</span>
                      <span className="font-bold text-green-700">
                        − {formatBRL(live.sharedLightTools.deduction)}
                      </span>
                    </div>
                  </div>
                </Card>
              )}

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
