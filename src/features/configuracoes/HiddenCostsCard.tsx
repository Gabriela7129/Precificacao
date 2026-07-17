import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { CurrencyInput } from '../../components/ui/CurrencyInput'
import { PercentInput } from '../../components/ui/PercentInput'
import { FieldError, FieldHint, FieldLabel } from '../../components/ui/Input'
import type { WithId, WorkspaceSettings } from '../../types'
import { saveSettings } from './data'
import { hiddenCostsSchema, type HiddenCostsValues } from './schemas'

/**
 * Card "Custos ocultos": taxa de manutenção de materiais leves (%) e tarifa
 * de energia (R$/kWh, opcional).
 */
export function HiddenCostsCard({
  wsId,
  settings,
}: {
  wsId: string
  settings: WithId<WorkspaceSettings> | null
}) {
  const [saving, setSaving] = useState(false)

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<HiddenCostsValues>({
    resolver: zodResolver(hiddenCostsSchema),
    mode: 'onBlur',
    defaultValues: {
      lightMaintenanceRate: settings?.lightMaintenanceRate ?? 7,
      electricityRate: settings?.electricityRate ?? null,
    },
  })

  const settingsId = settings?.id ?? null
  useEffect(() => {
    if (settings) {
      reset({
        lightMaintenanceRate: settings.lightMaintenanceRate,
        electricityRate: settings.electricityRate,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsId])

  const onSubmit = async (values: HiddenCostsValues) => {
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
      <h2 className="font-semibold text-gray-900 mb-4">Custos ocultos</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div>
          <FieldLabel htmlFor="lightMaintenanceRate">Taxa de manutenção leve (%)</FieldLabel>
          <Controller
            control={control}
            name="lightMaintenanceRate"
            render={({ field }) => (
              <PercentInput
                id="lightMaintenanceRate"
                value={field.value}
                onChange={(v) => field.onChange(v ?? 0)}
                error={!!errors.lightMaintenanceRate}
              />
            )}
          />
          {errors.lightMaintenanceRate ? (
            <FieldError>{errors.lightMaintenanceRate.message}</FieldError>
          ) : (
            <FieldHint>Aplicada sobre o valor de cada material leve.</FieldHint>
          )}
        </div>

        <div>
          <FieldLabel htmlFor="electricityRate">Tarifa de energia (R$/kWh)</FieldLabel>
          <Controller
            control={control}
            name="electricityRate"
            render={({ field }) => (
              <CurrencyInput
                id="electricityRate"
                value={field.value}
                onChange={field.onChange}
                error={!!errors.electricityRate}
              />
            )}
          />
          {errors.electricityRate ? (
            <FieldError>{errors.electricityRate.message}</FieldError>
          ) : (
            <FieldHint>Deixe em branco se não quiser calcular energia.</FieldHint>
          )}
        </div>

        <div>
          <Button type="submit" loading={saving}>
            Salvar
          </Button>
        </div>
      </form>
    </Card>
  )
}
