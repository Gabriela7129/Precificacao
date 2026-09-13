import { useEffect, useState } from 'react'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../../components/ui/Button'
import { CurrencyInput } from '../../components/ui/CurrencyInput'
import { PercentInput } from '../../components/ui/PercentInput'
import { FieldError, FieldHint, FieldLabel, Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { createMarketplace, updateMarketplace } from '../../services/firestore'
import { hasFeeTiers } from '../../lib/marketplaceTiers'
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

const emptyForm: MarketplaceFormValues = {
  name: '',
  feePercentage: 0,
  fixedFee: null,
  feeByValue: false,
  feeTiers: [],
  isDefault: false,
}

/** Modal de criação/edição de marketplace (nome, taxa %, taxa fixa, faixas, padrão). */
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
    watch,
    formState: { errors },
  } = useForm<MarketplaceFormValues>({
    resolver: zodResolver(marketplaceFormSchema),
    mode: 'onBlur',
    defaultValues: emptyForm,
  })

  const tierFields = useFieldArray({ control, name: 'feeTiers' })
  const feeByValue = watch('feeByValue')

  useEffect(() => {
    if (open) {
      reset(
        editing
          ? {
              name: editing.name,
              feePercentage: editing.feePercentage,
              fixedFee: editing.fixedFee,
              feeByValue: hasFeeTiers(editing),
              feeTiers: (editing.feeTiers ?? []).map((t) => ({
                minValue: t.minValue,
                maxValue: t.maxValue,
                feePercentage: t.feePercentage,
                fixedFee: t.fixedFee,
              })),
              isDefault: editing.isDefault,
            }
          : emptyForm,
      )
    }
  }, [open, editing, reset])

  const onSubmit = async (values: MarketplaceFormValues) => {
    setSaving(true)
    try {
      // Com faixas ativas: feePercentage/fixedFee espelham a primeira faixa
      // (compatibilidade com documentos/códigos antigos que leem o campo raiz).
      const tiers = values.feeByValue ? values.feeTiers : null
      const firstTier = tiers?.[0]
      const payload = {
        name: values.name.trim(),
        feePercentage: firstTier ? firstTier.feePercentage : values.feePercentage,
        fixedFee: firstTier ? firstTier.fixedFee : values.fixedFee,
        feeTiers: tiers,
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

        {/* Toggle Taxa por valor — logo abaixo do nome */}
        <label className="flex items-center gap-3 cursor-pointer">
          <Controller
            control={control}
            name="feeByValue"
            render={({ field: { value, onChange } }) => (
              <input
                type="checkbox"
                className="w-5 h-5 rounded border-rose-200 text-rose-500 focus:ring-rose-400 accent-rose-500"
                checked={value}
                onChange={(e) => {
                  onChange(e.target.checked)
                  // Ao ativar sem faixas, cria uma faixa inicial vazia.
                  if (e.target.checked && tierFields.fields.length === 0) {
                    tierFields.append({ minValue: null, maxValue: null, feePercentage: 0, fixedFee: null })
                  }
                }}
              />
            )}
          />
          <span className="text-sm text-gray-700">
            Taxa por valor
            <span className="block text-xs text-gray-500">
              A taxa muda conforme o valor do produto na plataforma (faixas)
            </span>
          </span>
        </label>

        {feeByValue ? (
          <div className="space-y-3">
            {tierFields.fields.map((field, index) => (
              <div key={field.id} className="border border-rose-200 rounded-xl p-3 bg-rose-50/40">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-medium text-gray-600">Faixa {index + 1}</span>
                  {tierFields.fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => tierFields.remove(index)}
                      className="p-1 text-gray-400 hover:text-red-600 transition"
                      aria-label={`Remover faixa ${index + 1}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel htmlFor={`tier-min-${index}`}>Mínimo (R$)</FieldLabel>
                    <Controller
                      control={control}
                      name={`feeTiers.${index}.minValue`}
                      render={({ field }) => (
                        <CurrencyInput
                          id={`tier-min-${index}`}
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="0"
                          error={!!errors.feeTiers?.[index]?.minValue}
                        />
                      )}
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor={`tier-max-${index}`}>Máximo (R$)</FieldLabel>
                    <Controller
                      control={control}
                      name={`feeTiers.${index}.maxValue`}
                      render={({ field }) => (
                        <CurrencyInput
                          id={`tier-max-${index}`}
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="sem limite"
                          error={!!errors.feeTiers?.[index]?.maxValue}
                        />
                      )}
                    />
                    {errors.feeTiers?.[index]?.maxValue && (
                      <FieldError>{errors.feeTiers[index]?.maxValue?.message}</FieldError>
                    )}
                  </div>
                  <div>
                    <FieldLabel htmlFor={`tier-pct-${index}`}>Taxa (%)</FieldLabel>
                    <Controller
                      control={control}
                      name={`feeTiers.${index}.feePercentage`}
                      render={({ field }) => (
                        <PercentInput
                          id={`tier-pct-${index}`}
                          value={field.value}
                          onChange={(v) => field.onChange(v ?? 0)}
                          error={!!errors.feeTiers?.[index]?.feePercentage}
                        />
                      )}
                    />
                    {errors.feeTiers?.[index]?.feePercentage && (
                      <FieldError>{errors.feeTiers[index]?.feePercentage?.message}</FieldError>
                    )}
                  </div>
                  <div>
                    <FieldLabel htmlFor={`tier-fixed-${index}`}>Taxa fixa (R$)</FieldLabel>
                    <Controller
                      control={control}
                      name={`feeTiers.${index}.fixedFee`}
                      render={({ field }) => (
                        <CurrencyInput
                          id={`tier-fixed-${index}`}
                          value={field.value}
                          onChange={field.onChange}
                          error={!!errors.feeTiers?.[index]?.fixedFee}
                        />
                      )}
                    />
                  </div>
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="ghost"
              onClick={() => tierFields.append({ minValue: null, maxValue: null, feePercentage: 0, fixedFee: null })}
            >
              <Plus className="w-4 h-4" /> Adicionar faixa de taxa
            </Button>
            {errors.feeTiers && !Array.isArray(errors.feeTiers) && (
              <FieldError>{errors.feeTiers.message as string}</FieldError>
            )}
            <FieldHint>
              A faixa é escolhida pelo preço de venda do produto na plataforma.
              Mínimo/máximo em branco = sem limite.
            </FieldHint>
          </div>
        ) : (
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
        )}

        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" className="w-4 h-4 accent-rose-500" {...register('isDefault')} />
          Marketplace padrão
        </label>
      </form>
    </Modal>
  )
}
