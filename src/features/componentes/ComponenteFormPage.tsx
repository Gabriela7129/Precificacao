/**
 * `/componentes/novo` e `/componentes/:id` — página de composição em duas
 * colunas: composição à esquerda, painel de custo (ao vivo) à direita.
 *
 * Regras críticas:
 * - Ao salvar, persiste `unitCostSnapshot` de cada insumo (custo médio do
 *   momento), os custos calculados e `version` (1 na criação).
 * - Versões arquivadas (`isArchived`) são somente leitura: banner âmbar,
 *   campos desabilitados e sem card de ações.
 * - "Reavaliar custos" arquiva a versão atual e cria a próxima (version+1)
 *   com os custos recalculados — ver `data.ts`.
 */

import { useState } from 'react'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Archive, ArrowLeft, Trash2 } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  FieldError,
  FieldHint,
  FieldLabel,
  Input,
  SegmentedControl,
  SelectSearchable,
} from '../../components/ui'
import { formatBRL } from '../../lib/format'
import {
  createComponent,
  updateComponent,
  useActiveWorkspaceId,
} from '../../services/firestore'
import type { SemiFinishedComponent, WithId } from '../../types'
import { calcularCustoComposicao, reavaliarComponente, useComposicaoData } from './data'

// ---------------------------------------------------------------------------
// Schema do formulário (tempos em minutos na UI)
// ---------------------------------------------------------------------------

const supplyLineSchema = z.object({
  supplyId: z.string().min(1, 'Selecione um insumo'),
  quantity: z.coerce
    .number({ invalid_type_error: 'Obrigatório' })
    .positive('Informe um valor maior que zero'),
})

const machineLineSchema = z.object({
  assetId: z.string().min(1, 'Selecione um ativo'),
  timeMinutes: z.coerce
    .number({ invalid_type_error: 'Obrigatório' })
    .min(0, 'Não pode ser negativo'),
})

const lightToolLineSchema = z.object({
  toolId: z.string().min(1, 'Selecione um material leve'),
  timeMinutes: z.coerce
    .number({ invalid_type_error: 'Obrigatório' })
    .min(0, 'Não pode ser negativo'),
})

const componentFormSchema = z.object({
  name: z.string().min(2, 'Informe um nome com pelo menos 2 caracteres'),
  isPackaging: z.boolean(),
  supplies: z.array(supplyLineSchema),
  machineAssets: z.array(machineLineSchema),
  lightTools: z.array(lightToolLineSchema),
  humanProfile: z.enum(['operational', 'creative']),
  humanTimeMinutes: z.coerce
    .number({ invalid_type_error: 'Obrigatório' })
    .min(0, 'Não pode ser negativo'),
})

type ComponentFormValues = z.infer<typeof componentFormSchema>

// ---------------------------------------------------------------------------
// Página de composição (criação quando `componente` é ausente)
// ---------------------------------------------------------------------------

export interface ComponenteFormPageProps {
  componente?: WithId<SemiFinishedComponent>
}

export function ComponenteFormPage({ componente }: ComponenteFormPageProps) {
  const isEdit = componente != null
  const readOnly = componente?.isArchived ?? false

  const navigate = useNavigate()
  const wsId = useActiveWorkspaceId()
  const { supplies, heavyAssets, lightTools, settings } = useComposicaoData()

  const [confirmReavaliar, setConfirmReavaliar] = useState(false)
  const [reavaliando, setReavaliando] = useState(false)

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ComponentFormValues>({
    resolver: zodResolver(componentFormSchema),
    mode: 'onBlur',
    defaultValues: componente
      ? {
          name: componente.name,
          isPackaging: componente.isPackaging ?? false,
          supplies: (componente.supplies ?? []).map((l) => ({
            supplyId: l.supplyId,
            quantity: l.quantity,
          })),
          machineAssets: (componente.machineAssets ?? []).map((l) => ({
            assetId: l.assetId,
            timeMinutes: l.timeMinutes,
          })),
          lightTools: (componente.lightTools ?? []).map((l) => ({
            toolId: l.toolId,
            timeMinutes: l.timeMinutes,
          })),
          humanProfile: componente.humanProfile,
          humanTimeMinutes: Math.round(componente.humanTimeHours * 60),
        }
      : {
          name: '',
          isPackaging: false,
          supplies: [],
          machineAssets: [],
          lightTools: [],
          humanProfile: 'operational',
          humanTimeMinutes: 0,
        },
  })

  const { fields: supplyFields, append: appendSupply, remove: removeSupply } = useFieldArray({ control, name: 'supplies' })
  const { fields: machineFields, append: appendMachine, remove: removeMachine } = useFieldArray({ control, name: 'machineAssets' })
  const { fields: lightToolFields, append: appendLightTool, remove: removeLightTool } = useFieldArray({ control, name: 'lightTools' })
  const values = watch()

  // Recálculo ao vivo do painel de custo (sempre com os custos atuais).
  const custo = calcularCustoComposicao(
    {
      supplies: (values.supplies ?? []).map((l) => ({
        supplyId: l?.supplyId ?? '',
        quantity: Number(l?.quantity) || 0,
      })),
      machineAssets: (values.machineAssets ?? []).map((l) => ({
        assetId: l?.assetId ?? '',
        timeMinutes: Number(l?.timeMinutes) || 0,
      })),
      lightTools: (values.lightTools ?? []).map((l) => ({
        toolId: l?.toolId ?? '',
        timeMinutes: Number(l?.timeMinutes) || 0,
      })),
      humanProfile: values.humanProfile ?? 'operational',
      humanTimeMinutes: Number(values.humanTimeMinutes) || 0,
    },
    supplies,
    heavyAssets,
    lightTools,
    settings,
  )

  const humanHourlyRate =
    values.humanProfile === 'creative'
      ? (settings?.hourlyCreative ?? 0)
      : (settings?.hourlyOperational ?? 0)

  const onSubmit = handleSubmit(async (formValues) => {
    if (!wsId) return
    try {
      const payload = {
        name: formValues.name.trim(),
        isPackaging: formValues.isPackaging,
        supplies: custo.lines,
        machineAssets: custo.machineLines,
        lightTools: custo.lightToolLines,
        humanTimeHours: custo.humanTimeHours,
        humanProfile: formValues.humanProfile,
        unitCost: custo.unitCost,
      }
      if (componente) {
        await updateComponent(wsId, componente.id, payload)
      } else {
        await createComponent(wsId, { ...payload, version: 1, isArchived: false, isPackaging: formValues.isPackaging })
      }
      toast.success('Componente salvo com sucesso')
      navigate('/componentes')
    } catch {
      toast.error('Não foi possível salvar. Tente novamente.')
    }
  })

  const handleReavaliar = async () => {
    if (!wsId || !componente) return
    setReavaliando(true)
    try {
      const novoId = await reavaliarComponente(wsId, componente, supplies, heavyAssets, lightTools, settings)
      toast.success(`Nova versão criada (v${componente.version + 1})`)
      setConfirmReavaliar(false)
      navigate(`/componentes/${novoId}`)
    } catch {
      toast.error('Não foi possível salvar. Tente novamente.')
    } finally {
      setReavaliando(false)
    }
  }

  return (
    <div>
      {/* Cabeçalho com voltar */}
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => navigate('/componentes')}
          className="p-2 hover:bg-rose-100 rounded-lg text-gray-600 transition"
          aria-label="Voltar para componentes"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          {isEdit ? componente.name : 'Novo componente'}
        </h1>
        {isEdit && <Badge variant="rose">v{componente.version}</Badge>}
      </div>

      {readOnly && (
        <div className="bg-amber-100 border border-amber-300 text-amber-900 rounded-2xl p-4 text-sm flex gap-2 items-center mb-6">
          <Archive className="w-4 h-4 flex-shrink-0" />
          <span>
            Versão arquivada (v{componente?.version}) — somente leitura. Reavalie para gerar uma
            nova versão.
          </span>
        </div>
      )}

      <form onSubmit={onSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna principal — composição */}
          <fieldset disabled={readOnly} className="lg:col-span-2 space-y-6 border-0 p-0 m-0 min-w-0">
            <Card>
              <h2 className="font-semibold text-gray-900 mb-4">Dados básicos</h2>
              <div className="space-y-4">
                <div>
                  <FieldLabel htmlFor="name">Nome do componente</FieldLabel>
                  <Input
                    id="name"
                    placeholder="Ex.: Miolo A5 Costurado"
                    error={!!errors.name}
                    {...register('name')}
                  />
                  {errors.name && <FieldError>{errors.name.message}</FieldError>}
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-5 h-5 rounded border-rose-200 text-rose-500 focus:ring-rose-400"
                    {...register('isPackaging')}
                  />
                  <span className="text-sm text-gray-700">Este componente é uma embalagem</span>
                </label>
              </div>
            </Card>

            <Card>
              <h2 className="font-semibold text-gray-900 mb-4">Insumos</h2>
              <div className="space-y-3">
                {supplyFields.map((field, index) => {
                  const line = values.supplies?.[index]
                  const supply = supplies.find((s) => s.id === line?.supplyId)
                  const subtotal = supply ? (Number(line?.quantity) || 0) * supply.averageCost : 0
                  return (
                    <div key={field.id}>
                      <div className="flex gap-3 items-start">
                        <div className="flex-[3] min-w-0">
                          <Controller
                            control={control}
                            name={`supplies.${index}.supplyId`}
                            render={({ field: { onChange, value } }) => (
                              <SelectSearchable
                                options={supplies
                                  .filter((s) => !values.supplies?.some((existing, i) => existing.supplyId === s.id && i !== index))
                                  .map((s) => ({
                                    value: s.id,
                                    label: `${s.name} (${formatBRL(s.averageCost)}/${s.unit})`,
                                  }))}
                                value={value}
                                onChange={onChange}
                                placeholder="Selecione um insumo"
                              />
                            )}
                          />
                        </div>
                        <div className="w-24 flex-shrink-0">
                          <FieldLabel htmlFor={`supply-qty-${index}`} className="sr-only">
                            Qtd.
                          </FieldLabel>
                          <Input
                            id={`supply-qty-${index}`}
                            type="number"
                            min="0"
                            step="any"
                            placeholder="Qtd."
                            error={!!errors.supplies?.[index]?.quantity}
                            {...register(`supplies.${index}.quantity`)}
                          />
                        </div>
                        <span className="text-sm text-gray-600 w-20 text-right pt-2">
                          {formatBRL(subtotal)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeSupply(index)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-rose-50 rounded-lg transition mt-0.5"
                          aria-label="Remover insumo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {(errors.supplies?.[index]?.supplyId || errors.supplies?.[index]?.quantity) && (
                        <FieldError>
                          {errors.supplies[index]?.supplyId?.message ??
                            errors.supplies[index]?.quantity?.message}
                        </FieldError>
                      )}
                    </div>
                  )
                })}
                {supplyFields.length === 0 && (
                  <p className="text-sm text-gray-500">Nenhum insumo adicionado.</p>
                )}
              </div>
              <div className="mt-4">
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => appendSupply({ supplyId: '', quantity: 1 })}
                >
                  + Adicionar insumo
                </Button>
              </div>
            </Card>

            <Card>
              <h2 className="font-semibold text-gray-900 mb-4">Ativo pesado</h2>
              <div className="space-y-3">
                {machineFields.map((field, index) => {
                  const line = values.machineAssets?.[index]
                  const asset = heavyAssets.find((a) => a.id === line?.assetId)
                  const subtotal = asset ? ((line?.timeMinutes || 0) / 60) * asset.totalCostPerHour : 0
                  return (
                    <div key={field.id}>
                      <div className="flex gap-3 items-start">
                        <div className="flex-[3] min-w-0">
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
                                onChange={onChange}
                                placeholder="Selecione um ativo"
                              />
                            )}
                          />
                        </div>
                        <div className="w-24 flex-shrink-0">
                          <FieldLabel htmlFor={`machine-min-${index}`} className="sr-only">
                            Min.
                          </FieldLabel>
                          <Input
                            id={`machine-min-${index}`}
                            type="number"
                            min="0"
                            step="1"
                            placeholder="Min."
                            error={!!errors.machineAssets?.[index]?.timeMinutes}
                            {...register(`machineAssets.${index}.timeMinutes`)}
                          />
                        </div>
                        <span className="text-sm text-gray-600 w-20 text-right pt-2">
                          {formatBRL(subtotal)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeMachine(index)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-rose-50 rounded-lg transition mt-0.5"
                          aria-label="Remover ativo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {(errors.machineAssets?.[index]?.assetId || errors.machineAssets?.[index]?.timeMinutes) && (
                        <FieldError>
                          {errors.machineAssets[index]?.assetId?.message ??
                            errors.machineAssets[index]?.timeMinutes?.message}
                        </FieldError>
                      )}
                    </div>
                  )
                })}
                {machineFields.length === 0 && (
                  <p className="text-sm text-gray-500">Nenhum ativo adicionado.</p>
                )}
              </div>
              <div className="mt-4">
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => appendMachine({ assetId: '', timeMinutes: 0 })}
                >
                  + Adicionar ativo
                </Button>
              </div>
            </Card>

            <Card>
              <h2 className="font-semibold text-gray-900 mb-4">Materiais leves</h2>
              <div className="space-y-3">
                {lightToolFields.map((field, index) => {
                  const line = values.lightTools?.[index]
                  const tool = lightTools.find((t) => t.id === line?.toolId)
                  const subtotal = tool ? ((line?.timeMinutes || 0) / 60) * tool.monthlyMaintenanceCost : 0
                  return (
                    <div key={field.id}>
                      <div className="flex gap-3 items-start">
                        <div className="flex-[3] min-w-0">
                          <Controller
                            control={control}
                            name={`lightTools.${index}.toolId`}
                            render={({ field: { onChange, value } }) => (
                              <SelectSearchable
                                options={lightTools
                                  .filter((t) => !values.lightTools?.some((existing, i) => existing.toolId === t.id && i !== index))
                                  .map((t) => ({
                                    value: t.id,
                                    label: `${t.name} (${formatBRL(t.monthlyMaintenanceCost)}/h)`,
                                  }))}
                                value={value}
                                onChange={onChange}
                                placeholder="Selecione um material leve"
                              />
                            )}
                          />
                        </div>
                        <div className="w-24 flex-shrink-0">
                          <FieldLabel htmlFor={`light-min-${index}`} className="sr-only">
                            Min.
                          </FieldLabel>
                          <Input
                            id={`light-min-${index}`}
                            type="number"
                            min="0"
                            step="1"
                            placeholder="Min."
                            error={!!errors.lightTools?.[index]?.timeMinutes}
                            {...register(`lightTools.${index}.timeMinutes`)}
                          />
                        </div>
                        <span className="text-sm text-gray-600 w-20 text-right pt-2">
                          {formatBRL(subtotal)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeLightTool(index)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-rose-50 rounded-lg transition mt-0.5"
                          aria-label="Remover material leve"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {(errors.lightTools?.[index]?.toolId || errors.lightTools?.[index]?.timeMinutes) && (
                        <FieldError>
                          {errors.lightTools[index]?.toolId?.message ??
                            errors.lightTools[index]?.timeMinutes?.message}
                        </FieldError>
                      )}
                    </div>
                  )
                })}
                {lightToolFields.length === 0 && (
                  <p className="text-sm text-gray-500">Nenhum material leve adicionado.</p>
                )}
              </div>
              <div className="mt-4">
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => appendLightTool({ toolId: '', timeMinutes: 0 })}
                >
                  + Adicionar material leve
                </Button>
              </div>
            </Card>

            <Card>
              <h2 className="font-semibold text-gray-900 mb-4">Mão de obra</h2>
              <div className="space-y-4">
                <div>
                  <FieldLabel>Perfil</FieldLabel>
                  <Controller
                    control={control}
                    name="humanProfile"
                    render={({ field }) => (
                      <SegmentedControl
                        options={[
                          { value: 'operational' as const, label: 'Operacional' },
                          { value: 'creative' as const, label: 'Criativa' },
                        ]}
                        value={field.value}
                        onChange={field.onChange}
                      />
                    )}
                  />
                  <FieldHint>
                    Valor hora {values.humanProfile === 'creative' ? 'criativo' : 'operacional'}:{' '}
                    {formatBRL(humanHourlyRate)}
                  </FieldHint>
                </div>
                <div>
                  <FieldLabel htmlFor="humanTimeMinutes">Tempo (minutos)</FieldLabel>
                  <Input
                    id="humanTimeMinutes"
                    type="number"
                    min="0"
                    step="1"
                    error={!!errors.humanTimeMinutes}
                    {...register('humanTimeMinutes')}
                  />
                  {errors.humanTimeMinutes && (
                    <FieldError>{errors.humanTimeMinutes.message}</FieldError>
                  )}
                </div>
              </div>
            </Card>
          </fieldset>

          {/* Coluna lateral — painel de custo ao vivo + ações */}
          <div className="space-y-6">
            <Card className="lg:sticky lg:top-8">
              <h2 className="font-semibold text-gray-900 mb-4">Resumo</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Insumos</span>
                  <span className="font-medium text-gray-800">{formatBRL(custo.suppliesCost)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Máquina</span>
                  <span className="font-medium text-gray-800">{formatBRL(custo.machineCost)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Materiais leves</span>
                  <span className="font-medium text-gray-800">{formatBRL(custo.lightToolCost)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Mão de obra</span>
                  <span className="font-medium text-gray-800">{formatBRL(custo.humanCost)}</span>
                </div>
                <div className="border-t border-rose-100 pt-2 mt-2 flex justify-between items-end">
                  <span className="text-gray-600">Custo unitário</span>
                  <span className="text-2xl font-bold text-rose-500">
                    {formatBRL(custo.unitCost)}
                  </span>
                </div>
              </div>
            </Card>

            {!readOnly && (
              <Card className="space-y-2">
                <Button type="submit" className="w-full" loading={isSubmitting}>
                  {isEdit ? 'Salvar alterações' : 'Salvar componente'}
                </Button>
                {isEdit && (
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full"
                    onClick={() => setConfirmReavaliar(true)}
                  >
                    Reavaliar custos
                  </Button>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={() => navigate('/componentes')}
                >
                  Cancelar
                </Button>
              </Card>
            )}
          </div>
        </div>
      </form>

      {isEdit && (
        <ConfirmDialog
          open={confirmReavaliar}
          onClose={() => setConfirmReavaliar(false)}
          onConfirm={() => void handleReavaliar()}
          title="Reavaliar custos?"
          body={`A versão atual (v${componente.version}) será arquivada e uma nova versão (v${componente.version + 1}) será criada com os custos de hoje.`}
          confirmLabel="Reavaliar"
          variant="primary"
          loading={reavaliando}
        />
      )}
    </div>
  )
}
