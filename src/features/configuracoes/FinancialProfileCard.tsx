import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { CurrencyInput } from '../../components/ui/CurrencyInput'
import { FieldError, FieldHint, FieldLabel, Input } from '../../components/ui/Input'
import {
  creativeHourlyRate,
  operationalHourlyRate,
} from '../../lib/calculations'
import { formatBRL } from '../../lib/format'
import type { WithId, WorkspaceSettings } from '../../types'
import { saveSettings } from './data'
import { financialProfileSchema, type FinancialProfileValues } from './schemas'

const round2 = (v: number) => Math.round(v * 100) / 100

/**
 * Card "Perfil financeiro": salário desejado, horas produtivas e os valores
 * de Hora Operacional/Criativa — calculados automaticamente (fatores 1,0 e
 * 1,4 sobre o valor hora base), com ajuste manual persistido.
 */
export function FinancialProfileCard({
  wsId,
  settings,
}: {
  wsId: string
  settings: WithId<WorkspaceSettings> | null
}) {
  const [saving, setSaving] = useState(false)

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FinancialProfileValues>({
    resolver: zodResolver(financialProfileSchema),
    mode: 'onBlur',
    defaultValues: {
      desiredSalary: settings?.desiredSalary ?? 0,
      productiveHoursPerWeek: settings?.productiveHoursPerWeek ?? 0,
      hourlyOperational: settings?.hourlyOperational ?? 0,
      hourlyCreative: settings?.hourlyCreative ?? 0,
    },
  })

  // Primeira carga do doc de settings (listener chega depois do mount).
  const settingsId = settings?.id ?? null
  useEffect(() => {
    if (settings) {
      reset({
        desiredSalary: settings.desiredSalary,
        productiveHoursPerWeek: settings.productiveHoursPerWeek,
        hourlyOperational: settings.hourlyOperational,
        hourlyCreative: settings.hourlyCreative,
      })
    }
    // Só reinicializa quando o doc muda de identidade (não a cada snapshot).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsId])

  const desiredSalary = watch('desiredSalary')
  const productiveHoursPerWeek = watch('productiveHoursPerWeek')
  const hourlyOperational = watch('hourlyOperational')
  const hourlyCreative = watch('hourlyCreative')

  const canCompute = desiredSalary > 0 && productiveHoursPerWeek > 0
  const computedOperational = canCompute
    ? operationalHourlyRate(desiredSalary, productiveHoursPerWeek)
    : 0
  const computedCreative = canCompute
    ? creativeHourlyRate(desiredSalary, productiveHoursPerWeek)
    : 0

  const handleRecalculate = () => {
    if (!canCompute) {
      toast.error('Preencha salário e horas produtivas para recalcular.')
      return
    }
    setValue('hourlyOperational', round2(computedOperational), { shouldDirty: true })
    setValue('hourlyCreative', round2(computedCreative), { shouldDirty: true })
  }

  const onSubmit = async (values: FinancialProfileValues) => {
    setSaving(true)
    try {
      await saveSettings(wsId, settingsId, values)
      toast.success('Configurações salvas')
    } catch {
      toast.error('Não foi possível salvar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <h2 className="font-semibold text-gray-900 mb-4">Perfil financeiro</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div>
          <FieldLabel htmlFor="desiredSalary">Salário líquido desejado/mês</FieldLabel>
          <Controller
            control={control}
            name="desiredSalary"
            render={({ field }) => (
              <CurrencyInput
                id="desiredSalary"
                value={field.value}
                onChange={(v) => field.onChange(v ?? 0)}
                error={!!errors.desiredSalary}
              />
            )}
          />
          {errors.desiredSalary && <FieldError>{errors.desiredSalary.message}</FieldError>}
        </div>

        <div>
          <FieldLabel htmlFor="productiveHoursPerWeek">Horas produtivas/semana</FieldLabel>
          <Input
            id="productiveHoursPerWeek"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.5"
            placeholder="Ex.: 30"
            error={!!errors.productiveHoursPerWeek}
            {...register('productiveHoursPerWeek', { valueAsNumber: true })}
          />
          {errors.productiveHoursPerWeek ? (
            <FieldError>{errors.productiveHoursPerWeek.message}</FieldError>
          ) : (
            <FieldHint>Horas realmente dedicadas à produção em uma semana.</FieldHint>
          )}
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <FieldLabel htmlFor="hourlyOperational">Hora Operacional</FieldLabel>
            <Controller
              control={control}
              name="hourlyOperational"
              render={({ field }) => (
                <CurrencyInput
                  id="hourlyOperational"
                  value={field.value}
                  onChange={(v) => field.onChange(v ?? 0)}
                  error={!!errors.hourlyOperational}
                />
              )}
            />
            {errors.hourlyOperational && (
              <FieldError>{errors.hourlyOperational.message}</FieldError>
            )}
          </div>
          <div className="flex-1">
            <FieldLabel htmlFor="hourlyCreative">Hora Criativa</FieldLabel>
            <Controller
              control={control}
              name="hourlyCreative"
              render={({ field }) => (
                <CurrencyInput
                  id="hourlyCreative"
                  value={field.value}
                  onChange={(v) => field.onChange(v ?? 0)}
                  error={!!errors.hourlyCreative}
                />
              )}
            />
            {errors.hourlyCreative && (
              <FieldError>{errors.hourlyCreative.message}</FieldError>
            )}
          </div>
        </div>
        <FieldHint>Calculados automaticamente — ajuste se quiser.</FieldHint>

        {/* Valores calculados em destaque */}
        <div className="bg-amber-50 rounded-xl p-3 text-sm space-y-1">
          <p className="flex justify-between">
            <span className="text-gray-600">Hora Operacional calculada</span>
            <span className="font-medium text-gray-900">
              {canCompute ? formatBRL(computedOperational) : '—'}
            </span>
          </p>
          <p className="flex justify-between">
            <span className="text-gray-600">Hora Criativa calculada</span>
            <span className="font-medium text-gray-900">
              {canCompute ? formatBRL(computedCreative) : '—'}
            </span>
          </p>
          {(hourlyOperational !== round2(computedOperational) ||
            hourlyCreative !== round2(computedCreative)) &&
            canCompute && (
              <p className="text-xs text-gray-500 pt-1">
                Valores em uso ajustados manualmente: {formatBRL(hourlyOperational)} ·{' '}
                {formatBRL(hourlyCreative)}
              </p>
            )}
        </div>

        <div className="flex gap-3">
          <Button type="button" variant="secondary" onClick={handleRecalculate}>
            Recalcular
          </Button>
          <Button type="submit" loading={saving}>
            Salvar
          </Button>
        </div>
      </form>
    </Card>
  )
}
