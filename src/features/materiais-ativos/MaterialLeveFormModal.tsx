/**
 * Modal de cadastro/edição de Material Leve (itens até R$ 500,00).
 * A manutenção mensal é calculada no momento do cadastro/edição
 * (purchaseValue × taxa/100 das settings) e persistida no documento.
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
import { lightToolMonthlyMaintenance } from '../../lib/calculations'
import { formatBRL } from '../../lib/format'
import { createLightTool, updateLightTool, useActiveWorkspaceId } from '../../services/firestore'
import type { LightTool, WithId } from '../../types'
import { safeNumber, todayYMD } from './data'
import { lightToolFormSchema, type LightToolFormValues } from './schemas'

export interface MaterialLeveFormModalProps {
  open: boolean
  onClose: () => void
  /** Material em edição; null/omitido = novo cadastro. */
  tool?: WithId<LightTool> | null
  /** Taxa % de manutenção leve vigente nas settings do workspace. */
  maintenanceRate: number
}

export function MaterialLeveFormModal({
  open,
  onClose,
  tool,
  maintenanceRate,
}: MaterialLeveFormModalProps) {
  const wsId = useActiveWorkspaceId()
  const [submitting, setSubmitting] = useState(false)
  const editing = tool != null

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<LightToolFormValues>({
    resolver: zodResolver(lightToolFormSchema),
    mode: 'onBlur',
    defaultValues: {
      name: tool?.name ?? '',
      purchaseValue: tool?.purchaseValue,
      purchaseDate: tool?.purchaseDate ?? todayYMD(),
    },
  })

  // Preview ao vivo da manutenção mensal (sem fórmulas na UI).
  const purchaseValue = watch('purchaseValue')
  const maintenancePreview = lightToolMonthlyMaintenance(safeNumber(purchaseValue), maintenanceRate)

  const onSubmit = async (values: LightToolFormValues) => {
    if (!wsId) return
    setSubmitting(true)
    try {
      const payload = {
        name: values.name,
        purchaseValue: values.purchaseValue,
        purchaseDate: values.purchaseDate,
        monthlyMaintenanceCost: lightToolMonthlyMaintenance(
          values.purchaseValue,
          maintenanceRate,
        ),
      }
      if (editing) {
        await updateLightTool(wsId, tool.id, payload)
      } else {
        await createLightTool(wsId, { ...payload, isActive: true })
      }
      toast.success('Material salvo com sucesso')
      onClose()
    } catch {
      toast.error('Não foi possível salvar. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Editar material' : 'Novo material'}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div>
          <FieldLabel htmlFor="lt-name">Nome</FieldLabel>
          <Input
            id="lt-name"
            autoFocus
            placeholder="Ex.: Tesoura de picotar"
            error={!!errors.name}
            {...register('name')}
          />
          {errors.name && <FieldError>{errors.name.message}</FieldError>}
        </div>

        <div>
          <FieldLabel htmlFor="lt-value">Valor pago</FieldLabel>
          <Controller
            name="purchaseValue"
            control={control}
            render={({ field }) => (
              <CurrencyInput
                id="lt-value"
                value={field.value ?? null}
                onChange={field.onChange}
                error={!!errors.purchaseValue}
              />
            )}
          />
          {errors.purchaseValue ? (
            <FieldError>{errors.purchaseValue.message}</FieldError>
          ) : (
            <FieldHint>Itens até R$ 500,00. Acima disso, cadastre em Ativos Pesados.</FieldHint>
          )}
        </div>

        <div>
          <FieldLabel htmlFor="lt-date">Data de compra</FieldLabel>
          <Input id="lt-date" type="date" error={!!errors.purchaseDate} {...register('purchaseDate')} />
          {errors.purchaseDate && <FieldError>{errors.purchaseDate.message}</FieldError>}
        </div>

        <div className="bg-amber-50 rounded-xl p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Manutenção mensal</span>
            <span className="font-medium text-gray-900">{formatBRL(maintenancePreview)}</span>
          </div>
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
