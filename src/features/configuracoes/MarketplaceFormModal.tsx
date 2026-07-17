import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '../../components/ui/Button'
import { CurrencyInput } from '../../components/ui/CurrencyInput'
import { PercentInput } from '../../components/ui/PercentInput'
import { FieldError, FieldLabel, Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { createMarketplace, updateMarketplace } from '../../services/firestore'
import type { Marketplace, WithId } from '../../types'
import { ensureSingleDefaultMarketplace } from './data'
import { marketplaceFormSchema, type MarketplaceFormValues } from './schemas'

export interface MarketplaceFormModalProps {
  open: boolean
  onClose: () => void
  wsId: string
  /** Lista atual (para garantir um único "Padrão"). */
  marketplaces: WithId<Marketplace>[]
  /** Preenchido em edição; `null` em criação. */
  editing: WithId<Marketplace> | null
}

/** Modal de criação/edição de marketplace (nome, taxa %, taxa fixa, padrão). */
export function MarketplaceFormModal({
  open,
  onClose,
  wsId,
  marketplaces,
  editing,
}: MarketplaceFormModalProps) {
  const [saving, setSaving] = useState(false)

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MarketplaceFormValues>({
    resolver: zodResolver(marketplaceFormSchema),
    mode: 'onBlur',
    defaultValues: { name: '', feePercentage: 0, fixedFee: null, isDefault: false },
  })

  useEffect(() => {
    if (open) {
      reset(
        editing
          ? {
              name: editing.name,
              feePercentage: editing.feePercentage,
              fixedFee: editing.fixedFee,
              isDefault: editing.isDefault,
            }
          : { name: '', feePercentage: 0, fixedFee: null, isDefault: false },
      )
    }
  }, [open, editing, reset])

  const onSubmit = async (values: MarketplaceFormValues) => {
    setSaving(true)
    try {
      const payload = {
        name: values.name.trim(),
        feePercentage: values.feePercentage,
        fixedFee: values.fixedFee,
        isDefault: values.isDefault,
      }
      let id: string
      if (editing) {
        await updateMarketplace(wsId, editing.id, payload)
        id = editing.id
      } else {
        id = await createMarketplace(wsId, payload)
      }
      if (values.isDefault) await ensureSingleDefaultMarketplace(wsId, marketplaces, id)
      toast.success('Marketplace salvo com sucesso')
      onClose()
    } catch {
      toast.error('Não foi possível salvar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Editar marketplace' : 'Novo marketplace'}
      footer={
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit(onSubmit)} loading={saving}>
            Salvar
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div>
          <FieldLabel htmlFor="marketplace-name">Nome</FieldLabel>
          <Input
            id="marketplace-name"
            placeholder="Ex.: Elo7"
            autoFocus
            error={!!errors.name}
            {...register('name')}
          />
          {errors.name && <FieldError>{errors.name.message}</FieldError>}
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <FieldLabel htmlFor="marketplace-fee">Taxa (%)</FieldLabel>
            <Controller
              control={control}
              name="feePercentage"
              render={({ field }) => (
                <PercentInput
                  id="marketplace-fee"
                  value={field.value}
                  onChange={(v) => field.onChange(v ?? 0)}
                  error={!!errors.feePercentage}
                />
              )}
            />
            {errors.feePercentage && <FieldError>{errors.feePercentage.message}</FieldError>}
          </div>
          <div className="flex-1">
            <FieldLabel htmlFor="marketplace-fixed-fee">Taxa fixa (R$)</FieldLabel>
            <Controller
              control={control}
              name="fixedFee"
              render={({ field }) => (
                <CurrencyInput
                  id="marketplace-fixed-fee"
                  value={field.value}
                  onChange={field.onChange}
                  error={!!errors.fixedFee}
                />
              )}
            />
            {errors.fixedFee && <FieldError>{errors.fixedFee.message}</FieldError>}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" className="w-4 h-4 accent-rose-500" {...register('isDefault')} />
          Marketplace padrão
        </label>
      </form>
    </Modal>
  )
}
