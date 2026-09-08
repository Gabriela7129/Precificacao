/**
 * EntradaEstoqueModal — registra compra/entrada de estoque.
 * Preview ao vivo do novo custo médio ponderado; salva em batch atômico
 * (atualiza insumo + cria supplyEntry). Exibe o histórico de entradas do
 * insumo selecionado.
 */

import { useEffect, useMemo } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import {
  Button,
  CurrencyInput,
  FieldError,
  FieldLabel,
  Input,
  Modal,
  Select,
} from '../../components/ui'
import { weightedAverageCost } from '../../lib/calculations'
import { formatBRL, formatDate, formatNumber } from '../../lib/format'
import {
  useActiveWorkspaceId,
  useSupplies,
  useSupplyEntries,
} from '../../services/firestore'
import type { Supply, WithId } from '../../types'
import { registerSupplyEntry, todayYmd } from './data'
import { supplyEntryFormSchema, type SupplyEntryFormValues } from './schemas'

export interface EntradaEstoqueModalProps {
  open: boolean
  onClose: () => void
  /** Insumo pré-selecionado (aberto a partir da linha da tabela). */
  supply: WithId<Supply> | null
}

export function EntradaEstoqueModal({ open, onClose, supply }: EntradaEstoqueModalProps) {
  const wsId = useActiveWorkspaceId()
  const { data: supplies } = useSupplies()
  const { data: entries } = useSupplyEntries()

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SupplyEntryFormValues>({
    resolver: zodResolver(supplyEntryFormSchema),
    mode: 'onBlur',
    defaultValues: {
      supplyId: supply?.id ?? '',
      quantity: '' as unknown as number,
      totalValue: null as unknown as number,
      date: todayYmd(),
      note: '',
    },
  })

  useEffect(() => {
    if (!open) return
    reset({
      supplyId: supply?.id ?? '',
      quantity: '' as unknown as number,
      totalValue: null as unknown as number,
      date: todayYmd(),
      note: '',
    })
  }, [open, supply, reset])

  const selectedSupplyId = watch('supplyId')
  // Sempre usa a versão mais fresca do insumo (listener em tempo real).
  const selectedSupply = useMemo(
    () => supplies.find((s) => s.id === selectedSupplyId) ?? null,
    [supplies, selectedSupplyId],
  )

  const [watchedQuantity, watchedTotal] = watch(['quantity', 'totalValue'])
  const hasPreview =
    selectedSupply != null &&
    Number.isFinite(watchedQuantity) &&
    watchedQuantity > 0 &&
    Number.isFinite(watchedTotal) &&
    watchedTotal > 0

  const previewUnitCost = hasPreview ? watchedTotal / watchedQuantity : null
  const previewNewAverage = hasPreview
    ? weightedAverageCost(
        selectedSupply.currentStock,
        selectedSupply.averageCost,
        watchedQuantity,
        watchedTotal,
      )
    : null

  const history = useMemo(() => {
    if (!selectedSupplyId) return []
    return entries
      .filter((entry) => entry.supplyId === selectedSupplyId)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 10)
  }, [entries, selectedSupplyId])

  const onSubmit = handleSubmit(async (values) => {
    if (!wsId || !selectedSupply) return
    try {
      await registerSupplyEntry(wsId, selectedSupply, {
        quantity: values.quantity,
        totalValue: values.totalValue,
        date: values.date,
        note: values.note.trim(),
      })
      toast.success('Entrada registrada com sucesso')
      onClose()
    } catch {
      toast.error('Não foi possível salvar. Tente novamente.')
    }
  })

  const activeSupplies = useMemo(
    () => [...supplies].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [supplies],
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Entrada de estoque"
      footer={
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={() => void onSubmit()} loading={isSubmitting} disabled={!selectedSupply}>
            Registrar entrada
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
          <FieldLabel htmlFor="entrada-insumo">Insumo</FieldLabel>
          <Controller
            control={control}
            name="supplyId"
            render={({ field }) => (
              <Select
                id="entrada-insumo"
                value={field.value}
                onBlur={field.onBlur}
                onChange={(e) => field.onChange(e.target.value)}
                disabled={supply != null}
                error={!!errors.supplyId}
              >
                <option value="">Selecione um insumo</option>
                {activeSupplies.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            )}
          />
          {errors.supplyId && <FieldError>{errors.supplyId.message}</FieldError>}
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <FieldLabel htmlFor="entrada-quantidade">Quantidade</FieldLabel>
            <Input
              id="entrada-quantidade"
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              autoFocus={supply != null}
              placeholder={selectedSupply ? `em ${selectedSupply.unit}` : ''}
              error={!!errors.quantity}
              {...register('quantity', { valueAsNumber: true })}
            />
            {errors.quantity && <FieldError>{errors.quantity.message}</FieldError>}
          </div>
          <div className="flex-1">
            <FieldLabel htmlFor="entrada-valor">Valor total da compra</FieldLabel>
            <Controller
              control={control}
              name="totalValue"
              render={({ field }) => (
                <CurrencyInput
                  id="entrada-valor"
                  value={field.value ?? null}
                  onChange={field.onChange}
                  error={!!errors.totalValue}
                />
              )}
            />
            {errors.totalValue && <FieldError>{errors.totalValue.message}</FieldError>}
          </div>
        </div>

        <div>
          <FieldLabel htmlFor="entrada-data">Data da compra</FieldLabel>
          <Input
            id="entrada-data"
            type="date"
            error={!!errors.date}
            {...register('date')}
          />
          {errors.date && <FieldError>{errors.date.message}</FieldError>}
        </div>

        <div>
          <FieldLabel htmlFor="entrada-obs">Observação (opcional)</FieldLabel>
          <Input
            id="entrada-obs"
            placeholder="Ex.: compra no armarinho do centro"
            {...register('note')}
          />
        </div>

        {hasPreview && previewUnitCost != null && previewNewAverage != null && (
          <div className="bg-amber-50 rounded-xl p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-600">Custo unitário desta compra</span>
              <span className="text-gray-900">{formatBRL(previewUnitCost)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Novo custo médio</span>
              <span className="font-medium text-gray-900">{formatBRL(previewNewAverage)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Novo estoque</span>
              <span className="text-gray-900">
                {formatNumber(selectedSupply.currentStock + watchedQuantity, {
                  unit: selectedSupply.unit,
                })}
              </span>
            </div>
          </div>
        )}

        {selectedSupply && (
          <div>
            <p className="block text-sm font-medium text-gray-700 mb-1">
              Histórico de entradas
            </p>
            {history.length === 0 ? (
              <p className="text-xs text-gray-500">Nenhuma entrada registrada ainda.</p>
            ) : (
              <ul className="border border-rose-200 rounded-xl divide-y divide-rose-100 max-h-40 overflow-y-auto">
                {history.map((entry) => (
                  <li key={entry.id} className="px-3 py-2 text-sm flex justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-gray-900">
                        {formatNumber(entry.quantity, { unit: selectedSupply.unit })}
                      </span>
                      <span className="text-gray-500"> · {formatDate(entry.date)}</span>
                      {entry.note && (
                        <span className="block text-xs text-gray-500 truncate">{entry.note}</span>
                      )}
                    </div>
                    <span className="text-gray-900 whitespace-nowrap">
                      {formatBRL(entry.totalValue)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </form>
    </Modal>
  )
}
