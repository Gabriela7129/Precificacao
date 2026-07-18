/**
 * InsumoFormModal — criar/editar insumo.
 * Na criação: estoque inicial + custo médio inicial (com preview do valor
 * total em estoque). Na edição: esses campos ficam somente leitura —
 * estoque só muda por Entradas.
 */

import { useEffect } from 'react'
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
  Select,
} from '../../components/ui'
import { formatBRL } from '../../lib/format'
import {
  createSupply,
  updateSupply,
  useActiveWorkspaceId,
  useSupplyCategories,
} from '../../services/firestore'
import type { Supply, SupplyCategory, WithId } from '../../types'
import { supplyFormSchema, type SupplyFormValues } from './schemas'

const NEW_CATEGORY_OPTION = '__nova_categoria__'

const UNIT_SUGGESTIONS = ['unidade', 'folha', 'cm', 'm', 'g', 'ml']

export interface InsumoFormModalProps {
  open: boolean
  onClose: () => void
  /** `null` = criar novo; insumo preenchido = editar. */
  supply: WithId<Supply> | null
  /** Abre o CategoriasModal (opção "Nova categoria…" do Select). */
  onManageCategories: () => void
}

const emptyValues: SupplyFormValues = {
  name: '',
  unit: '',
  categoryId: '',
  initialStock: 0,
  totalValue: 0,
}

export function InsumoFormModal({
  open,
  onClose,
  supply,
  onManageCategories,
}: InsumoFormModalProps) {
  const wsId = useActiveWorkspaceId()
  const { data: categories } = useSupplyCategories()
  const isEdit = supply != null

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SupplyFormValues>({
    resolver: zodResolver(supplyFormSchema),
    mode: 'onBlur',
    defaultValues: emptyValues,
  })

  useEffect(() => {
    if (!open) return
    reset(
      supply
        ? {
            name: supply.name,
            unit: supply.unit,
            categoryId: supply.categoryId,
            initialStock: supply.currentStock,
            totalValue: supply.currentStock * supply.averageCost,
          }
        : emptyValues,
    )
  }, [open, supply, reset])

  const sortedCategories = [...categories].sort((a, b) => a.order - b.order)

  const [watchedStock, watchedTotal] = watch(['initialStock', 'totalValue'])
  const computedAverageCost =
    Number.isFinite(watchedStock) && watchedStock > 0 && Number.isFinite(watchedTotal) && watchedTotal >= 0
      ? watchedTotal / watchedStock
      : 0
  const previewTotal = computedAverageCost * (Number.isFinite(watchedStock) ? watchedStock : 0)

  const onSubmit = handleSubmit(async (values) => {
    if (!wsId) return
    try {
      const averageCost =
        values.initialStock > 0 ? values.totalValue / values.initialStock : 0
      if (isEdit && supply) {
        await updateSupply(wsId, supply.id, {
          name: values.name.trim(),
          unit: values.unit.trim(),
          categoryId: values.categoryId,
        })
      } else {
        await createSupply(wsId, {
          name: values.name.trim(),
          unit: values.unit.trim(),
          categoryId: values.categoryId,
          currentStock: values.initialStock,
          averageCost,
          totalStockValue: values.totalValue,
          isActive: true,
        })
      }
      toast.success('Insumo salvo com sucesso')
      onClose()
    } catch {
      toast.error('Não foi possível salvar. Tente novamente.')
    }
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar insumo' : 'Novo insumo'}
      footer={
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={() => void onSubmit()} loading={isSubmitting}>
            Salvar
          </Button>
        </div>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void onSubmit()
        }}
      >
        <div>
          <FieldLabel htmlFor="insumo-nome">Nome</FieldLabel>
          <Input
            id="insumo-nome"
            autoFocus
            placeholder="Ex.: Papel Kraft 180g"
            error={!!errors.name}
            {...register('name')}
          />
          {errors.name && <FieldError>{errors.name.message}</FieldError>}
        </div>

        <div>
          <FieldLabel htmlFor="insumo-unidade">Unidade de medida</FieldLabel>
          <Input
            id="insumo-unidade"
            list="insumo-unidades-sugestao"
            placeholder="Ex.: folha"
            error={!!errors.unit}
            {...register('unit')}
          />
          <datalist id="insumo-unidades-sugestao">
            {UNIT_SUGGESTIONS.map((unit) => (
              <option key={unit} value={unit} />
            ))}
          </datalist>
          <FieldHint>Texto livre — use as sugestões ou crie a sua.</FieldHint>
          {errors.unit && <FieldError>{errors.unit.message}</FieldError>}
        </div>

        <div>
          <FieldLabel htmlFor="insumo-categoria">Categoria</FieldLabel>
          <Controller
            control={control}
            name="categoryId"
            render={({ field }) => (
              <Select
                id="insumo-categoria"
                value={field.value}
                onBlur={field.onBlur}
                error={!!errors.categoryId}
                onChange={(e) => {
                  if (e.target.value === NEW_CATEGORY_OPTION) {
                    onManageCategories()
                    return
                  }
                  field.onChange(e.target.value)
                }}
              >
                <option value="">Selecione uma categoria</option>
                {sortedCategories.map((category: WithId<SupplyCategory>) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
                <option value={NEW_CATEGORY_OPTION}>+ Nova categoria…</option>
              </Select>
            )}
          />
          {errors.categoryId && <FieldError>{errors.categoryId.message}</FieldError>}
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <FieldLabel htmlFor="insumo-estoque">
              {isEdit ? 'Estoque atual' : 'Estoque inicial'}
            </FieldLabel>
            <Input
              id="insumo-estoque"
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              disabled={isEdit}
              error={!!errors.initialStock}
              {...register('initialStock', { valueAsNumber: true })}
            />
            {errors.initialStock && <FieldError>{errors.initialStock.message}</FieldError>}
          </div>
          <div className="flex-1">
            <FieldLabel htmlFor="insumo-custo">
              {isEdit ? 'Custo médio (R$)' : 'Valor total pago (R$)'}
            </FieldLabel>
            <Controller
              control={control}
              name="totalValue"
              render={({ field }) => (
                <CurrencyInput
                  id="insumo-custo"
                  value={field.value}
                  onChange={(value) => field.onChange(value ?? 0)}
                  disabled={isEdit}
                  error={!!errors.totalValue}
                />
              )}
            />
            {errors.totalValue && (
              <FieldError>{errors.totalValue.message}</FieldError>
            )}
          </div>
        </div>
        {isEdit && (
          <FieldHint>O estoque e o custo médio só mudam por entradas de estoque.</FieldHint>
        )}

        {!isEdit && (
          <div className="bg-amber-50 rounded-xl p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-600">Custo médio unitário</span>
              <span className="font-medium text-gray-900">{formatBRL(computedAverageCost)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Valor total em estoque</span>
              <span className="font-medium text-gray-900">{formatBRL(previewTotal)}</span>
            </div>
          </div>
        )}
      </form>
    </Modal>
  )
}
