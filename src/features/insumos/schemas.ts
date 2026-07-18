/**
 * Schemas Zod dos formulários do módulo de Insumos.
 * (O design previa `src/lib/schemas.ts`, mas `src/lib/` é fora do escopo
 * deste worker — os schemas vivem localmente na feature.)
 */

import { z } from 'zod'

export const supplyFormSchema = z.object({
  name: z.string().trim().min(1, 'Obrigatório'),
  unit: z.string().trim().min(1, 'Obrigatório'),
  categoryId: z.string().min(1, 'Selecione uma categoria'),
  initialStock: z
    .number({ invalid_type_error: 'Obrigatório' })
    .min(0, 'Não pode ser negativo'),
  totalValue: z
    .number({ invalid_type_error: 'Obrigatório' })
    .min(0, 'Não pode ser negativo'),
})

export type SupplyFormValues = z.infer<typeof supplyFormSchema>

export const supplyEntryFormSchema = z.object({
  supplyId: z.string().min(1, 'Selecione um insumo'),
  quantity: z
    .number({ invalid_type_error: 'Obrigatório' })
    .positive('Informe um valor maior que zero'),
  totalValue: z
    .number({ invalid_type_error: 'Obrigatório' })
    .positive('Informe um valor maior que zero'),
  date: z.string().min(1, 'Obrigatório'),
  note: z.string(),
})

export type SupplyEntryFormValues = z.infer<typeof supplyEntryFormSchema>
