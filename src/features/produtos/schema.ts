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
  /** Insumos extras adicionados diretamente ao produto (detalhes pequenos). */
  supplies: z.array(
    z.object({
      supplyId: z.string().min(1, 'Selecione um insumo'),
      quantity: quantitySchema,
      /** Snapshot salvo do custo médio no momento da montagem (para detectar valores desatualizados). */
      unitCostSnapshot: z.number().nullable(),
    }),
  ),
  components: z.array(
    z.object({
      componentId: z.string().min(1, 'Selecione um componente'),
      quantity: quantitySchema,
      /** Snapshot salvo do custo unitário no momento da montagem (para detectar valores desatualizados). */
      unitCostSnapshot: z.number().nullable(),
    }),
  ),
  packaging: z.array(
    z.object({
      componentId: z.string().min(1, 'Selecione uma embalagem'),
      quantity: quantitySchema,
      /** Snapshot salvo do custo unitário no momento da montagem (para detectar valores desatualizados). */
      unitCostSnapshot: z.number().nullable(),
    }),
  ),
  /** Ativos pesados usados diretamente no produto (tempo em minutos na UI). */
  machineAssets: z.array(
    z.object({
      assetId: z.string().min(1, 'Selecione um ativo'),
      timeMinutes: z
        .number({ invalid_type_error: 'Obrigatório' })
        .min(0, 'Não pode ser negativo'),
      /** Snapshot salvo do custo/hora no momento da montagem. */
      costPerHourSnapshot: z.number().nullable(),
    }),
  ),
  /** Materiais leves usados diretamente no produto (custo fixo; entram na regra 1×). */
  lightTools: z.array(
    z.object({
      toolId: z.string().min(1, 'Selecione um material leve'),
      /** Snapshot salvo do custo fixo no momento da montagem. */
      costSnapshot: z.number().nullable(),
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
