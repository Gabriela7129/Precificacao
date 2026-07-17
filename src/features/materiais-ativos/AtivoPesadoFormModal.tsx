/**
 * Modal de cadastro/edição de Ativo Pesado (itens acima de R$ 500,00).
 * Depreciação/hora, energia/hora e custo total/hora são calculados no
 * momento do cadastro/edição (calculations.ts) e persistidos no documento.
 * O rodapé do modal mostra o preview de cálculo ao vivo, sem fórmulas.
 */

import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import {
  Button,
  CurrencyInput,
  FieldError,
  FieldHint,
  FieldLabel,
  Input,
  Modal,
} from '../../components/ui'
import {
  heavyAssetDepreciationPerHour,
  heavyAssetEnergyPerHour,
  heavyAssetTotalCostPerHour,
} from '../../lib/calculations'
import { formatBRL } from '../../lib/format'
import { createHeavyAsset, updateHeavyAsset, useActiveWorkspaceId } from '../../services/firestore'
import type { HeavyAsset, WithId } from '../../types'
import { safeNumber, todayYMD } from './data'
import { heavyAssetFormSchema, type HeavyAssetFormValues } from './schemas'

export interface AtivoPesadoFormModalProps {
  open: boolean
  onClose: () => void
  /** Ativo em edição; null/omitido = novo cadastro. */
  asset?: WithId<HeavyAsset> | null
  /** Horas produtivas/semana das settings (base da depreciação). */
  productiveHoursPerWeek: number
  /** Tarifa de energia padrão das settings — pré-preenche novos cadastros. */
  defaultElectricityRate: number | null
}

export function AtivoPesadoFormModal({
  open,
  onClose,
  asset,
  productiveHoursPerWeek,
  defaultElectricityRate,
}: AtivoPesadoFormModalProps) {
  const wsId = useActiveWorkspaceId()
  const [submitting, setSubmitting] = useState(false)
  const editing = asset != null

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<HeavyAssetFormValues>({
    resolver: zodResolver(heavyAssetFormSchema),
    mode: 'onBlur',
    defaultValues: {
      name: asset?.name ?? '',
      purchaseValue: asset?.purchaseValue,
      purchaseDate: asset?.purchaseDate ?? todayYMD(),
      usefulLifeMonths: asset?.usefulLifeMonths,
      powerWatts: asset?.powerWatts,
      electricityRate: asset ? asset.electricityRate : defaultElectricityRate,
    },
  })

  // Preview de cálculo ao vivo (recalcula a cada keystroke via watch).
  const [purchaseValue, usefulLifeMonths, powerWatts, electricityRate] = watch([
    'purchaseValue',
    'usefulLifeMonths',
    'powerWatts',
    'electricityRate',
  ])
  const previewDepreciation = heavyAssetDepreciationPerHour(
    safeNumber(purchaseValue),
    safeNumber(usefulLifeMonths),
    productiveHoursPerWeek,
  )
  const previewEnergy = heavyAssetEnergyPerHour(safeNumber(powerWatts), electricityRate ?? null)
  const previewTotal = previewDepreciation + previewEnergy

  const onSubmit = async (values: HeavyAssetFormValues) => {
    if (!wsId) return
    setSubmitting(true)
    try {
      const payload = {
        name: values.name,
        purchaseValue: values.purchaseValue,
        purchaseDate: values.purchaseDate,
        usefulLifeMonths: values.usefulLifeMonths,
        powerWatts: values.powerWatts,
        electricityRate: values.electricityRate ?? null,
        depreciationPerHour: heavyAssetDepreciationPerHour(
          values.purchaseValue,
          values.usefulLifeMonths,
          productiveHoursPerWeek,
        ),
        energyCostPerHour: heavyAssetEnergyPerHour(values.powerWatts, values.electricityRate),
        totalCostPerHour: heavyAssetTotalCostPerHour(
          values.purchaseValue,
          values.usefulLifeMonths,
          productiveHoursPerWeek,
          values.powerWatts,
          values.electricityRate,
        ),
      }
      if (editing) {
        await updateHeavyAsset(wsId, asset.id, payload)
      } else {
        await createHeavyAsset(wsId, payload)
      }
      toast.success('Ativo salvo com sucesso')
      onClose()
    } catch {
      toast.error('Não foi possível salvar. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Editar ativo' : 'Novo ativo'}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div>
          <FieldLabel htmlFor="ha-name">Nome</FieldLabel>
          <Input
            id="ha-name"
            autoFocus
            placeholder="Ex.: Máquina de costura"
            error={!!errors.name}
            {...register('name')}
          />
          {errors.name && <FieldError>{errors.name.message}</FieldError>}
        </div>

        <div>
          <FieldLabel htmlFor="ha-value">Valor pago</FieldLabel>
          <Controller
            name="purchaseValue"
            control={control}
            render={({ field }) => (
              <CurrencyInput
                id="ha-value"
                value={field.value ?? null}
                onChange={field.onChange}
                error={!!errors.purchaseValue}
              />
            )}
          />
          {errors.purchaseValue ? (
            <FieldError>{errors.purchaseValue.message}</FieldError>
          ) : (
            <FieldHint>Itens acima de R$ 500,00. Até R$ 500,00, cadastre em Materiais Leves.</FieldHint>
          )}
        </div>

        <div>
          <FieldLabel htmlFor="ha-date">Data de compra</FieldLabel>
          <Input id="ha-date" type="date" error={!!errors.purchaseDate} {...register('purchaseDate')} />
          {errors.purchaseDate && <FieldError>{errors.purchaseDate.message}</FieldError>}
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <FieldLabel htmlFor="ha-life">Vida útil estimada (meses)</FieldLabel>
            <Input
              id="ha-life"
              type="number"
              inputMode="numeric"
              min={1}
              placeholder="Ex.: 60"
              error={!!errors.usefulLifeMonths}
              {...register('usefulLifeMonths', { valueAsNumber: true })}
            />
            {errors.usefulLifeMonths && <FieldError>{errors.usefulLifeMonths.message}</FieldError>}
          </div>
          <div className="flex-1">
            <FieldLabel htmlFor="ha-watts">Potência (Watts)</FieldLabel>
            <Input
              id="ha-watts"
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="Ex.: 850"
              error={!!errors.powerWatts}
              {...register('powerWatts', { valueAsNumber: true })}
            />
            {errors.powerWatts && <FieldError>{errors.powerWatts.message}</FieldError>}
          </div>
        </div>

        <div>
          <FieldLabel htmlFor="ha-rate">Tarifa de energia (R$/kWh)</FieldLabel>
          <Controller
            name="electricityRate"
            control={control}
            render={({ field }) => (
              <CurrencyInput
                id="ha-rate"
                value={field.value ?? null}
                onChange={field.onChange}
                error={!!errors.electricityRate}
              />
            )}
          />
          {errors.electricityRate ? (
            <FieldError>{errors.electricityRate.message}</FieldError>
          ) : (
            <FieldHint>Pré-preenchida das configurações. Deixe em branco para não calcular energia.</FieldHint>
          )}
        </div>

        <div className="bg-amber-50 rounded-xl p-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-600">Depreciação/hora</span>
            <span className="font-medium text-gray-900">{formatBRL(previewDepreciation)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Energia/hora</span>
            <span className="font-medium text-gray-900">{formatBRL(previewEnergy)}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold text-gray-900">Total/hora</span>
            <span className="font-semibold text-gray-900">{formatBRL(previewTotal)}</span>
          </div>
          {productiveHoursPerWeek <= 0 && (
            <p className="text-xs text-gray-500 pt-1">
              Configure as horas produtivas em Configurações para calcular a depreciação.
            </p>
          )}
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" loading={submitting}>
            Salvar
          </Button>
        </div>
      </form>
    </Modal>
  )
}
