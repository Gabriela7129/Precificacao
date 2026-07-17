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

import { useMemo, useState } from 'react'
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
  Select,
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

const componentFormSchema = z.object({
  name: z.string().min(2, 'Informe um nome com pelo menos 2 caracteres'),
  supplies: z.array(supplyLineSchema),
  machineAssetId: z.string(), // '' = Nenhum
  machineTimeMinutes: z.coerce
    .number({ invalid_type_error: 'Obrigatório' })
    .min(0, 'Não pode ser negativo'),
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
  const { supplies, heavyAssets, settings } = useComposicaoData()

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
          supplies: componente.supplies.map((l) => ({
            supplyId: l.supplyId,
            quantity: l.quantity,
          })),
          machineAssetId: componente.machineAssetId ?? '',
          machineTimeMinutes: Math.round(componente.machineTimeHours * 60),
          humanProfile: componente.humanProfile,
          humanTimeMinutes: Math.round(componente.humanTimeHours * 60),
        }
      : {
          name: '',
          supplies: [],
          machineAssetId: '',
          machineTimeMinutes: 0,
          humanProfile: 'operational',
          humanTimeMinutes: 0,
        },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'supplies' })
  const values = watch()

  // Recálculo ao vivo do painel de custo (sempre com os custos atuais).
  const custo = useMemo(
    () =>
      calcularCustoComposicao(
        {
          supplies: (values.supplies ?? []).map((l) => ({
            supplyId: l?.supplyId ?? '',
            quantity: Number(l?.quantity) || 0,
          })),
          machineAssetId: values.machineAssetId || null,
          machineTimeMinutes: Number(values.machineTimeMinutes) || 0,
          humanProfile: values.humanProfile ?? 'operational',
          humanTimeMinutes: Number(values.humanTimeMinutes) || 0,
        },
        supplies,
        heavyAssets,
        settings,
      ),
    [values, supplies, heavyAssets, settings],
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
        supplies: custo.lines,
        machineTimeHours: custo.machineTimeHours,
        machineAssetId: formValues.machineAssetId || null,
        humanTimeHours: custo.humanTimeHours,
        humanProfile: formValues.humanProfile,
        unitCost: custo.unitCost,
      }
      if (componente) {
        await updateComponent(wsId, componente.id, payload)
      } else {
        await createComponent(wsId, { ...payload, version: 1, isArchived: false })
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
      const novoId = await reavaliarComponente(wsId, componente, supplies, heavyAssets, settings)
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
            </Card>

            <Card>
              <h2 className="font-semibold text-gray-900 mb-4">Insumos</h2>
              <div className="space-y-3">
                {fields.map((field, index) => {
                  const line = values.supplies?.[index]
                  const supply = supplies.find((s) => s.id === line?.supplyId)
                  const subtotal = supply ? (Number(line?.quantity) || 0) * supply.averageCost : 0
                  return (
                    <div key={field.id}>
                      <div className="flex gap-3 items-center">
                        <div className="flex-1">
                          <Select
                            error={!!errors.supplies?.[index]?.supplyId}
                            {...register(`supplies.${index}.supplyId`)}
                          >
                            <option value="">Selecione um insumo</option>
                            {supplies.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name} ({formatBRL(s.averageCost)}/{s.unit})
                              </option>
                            ))}
                          </Select>
                        </div>
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          placeholder="Qtd."
                          className="w-28"
                          error={!!errors.supplies?.[index]?.quantity}
                          {...register(`supplies.${index}.quantity`)}
                        />
                        <span className="text-sm text-gray-600 w-24 text-right">
                          {formatBRL(subtotal)}
                        </span>
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-rose-50 rounded-lg transition"
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
                {fields.length === 0 && (
                  <p className="text-sm text-gray-500">Nenhum insumo adicionado.</p>
                )}
              </div>
              <div className="mt-4">
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => append({ supplyId: '', quantity: 1 })}
                >
                  + Adicionar insumo
                </Button>
              </div>
            </Card>

            <Card>
              <h2 className="font-semibold text-gray-900 mb-4">Tempo de máquina</h2>
              <div className="space-y-4">
                <div>
                  <FieldLabel htmlFor="machineAssetId">Ativo pesado</FieldLabel>
                  <Select id="machineAssetId" {...register('machineAssetId')}>
                    <option value="">Nenhum</option>
                    {heavyAssets.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({formatBRL(a.totalCostPerHour)}/hora)
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <FieldLabel htmlFor="machineTimeMinutes">Tempo (minutos)</FieldLabel>
                  <Input
                    id="machineTimeMinutes"
                    type="number"
                    min="0"
                    step="1"
                    error={!!errors.machineTimeMinutes}
                    {...register('machineTimeMinutes')}
                  />
                  {errors.machineTimeMinutes && (
                    <FieldError>{errors.machineTimeMinutes.message}</FieldError>
                  )}
                </div>
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
