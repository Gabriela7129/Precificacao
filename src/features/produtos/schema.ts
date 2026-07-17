/**
 * Schema Zod do formulário de produto (montagem + precificação).
 * Tempos na UI em minutos; convertidos para horas na persistência.
 */

import { z } from 'zod'

const quantitySchema = z
  .number({ invalid_type_error: 'Obrigatório' })
  .positive('Informe um valor maior que zero')

export const productFormSchema = z.object({
  name: z.string().min(2, 'Informe um nome com pelo menos 2 caracteres'),
  components: z.array(
    z.object({
      componentId: z.string().min(1, 'Selecione um componente'),
      quantity: quantitySchema,
    }),
  ),
  packaging: z.array(
    z.object({
      supplyId: z.string().min(1, 'Selecione um insumo'),
      quantity: quantitySchema,
    }),
  ),
  /** Tempo de acabamento final, em MINUTOS na UI. */
  finalHumanTimeMinutes: z
    .number({ invalid_type_error: 'Obrigatório' })
    .min(0, 'Informe zero ou mais'),
  finalHumanProfile: z.enum(['operational', 'creative']),
  profitMargin: z.number().min(0, 'Informe zero ou mais').nullable(),
  /** '' = nenhum marketplace selecionado. */
  marketplaceId: z.string(),
  desiredNetValue: z.number().positive('Informe um valor maior que zero').nullable(),
})

export type ProductFormValues = z.infer<typeof productFormSchema>
