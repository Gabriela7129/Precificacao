/**
 * Schemas Zod dos formulários do módulo (React Hook Form + zodResolver).
 * Regras de negócio: docs/documento-requisitos.md (Módulos 1 e 2) —
 * materiais leves até R$ 500,00; ativos pesados acima de R$ 500,00.
 */

import { z } from 'zod'
import { LIGHT_TOOL_MAX_VALUE } from '../../lib/calculations'

const ymdRegex = /^\d{4}-\d{2}-\d{2}$/

const requiredNumber = () =>
  z.number({ required_error: 'Obrigatório', invalid_type_error: 'Obrigatório' })

/** Material leve: valor > 0 e ≤ R$ 500,00. */
export const lightToolFormSchema = z.object({
  name: z.string().trim().min(1, 'Obrigatório'),
  purchaseValue: requiredNumber()
    .positive('Informe um valor maior que zero')
    .max(LIGHT_TOOL_MAX_VALUE, 'Máximo R$ 500,00'),
  purchaseDate: z.string().regex(ymdRegex, 'Obrigatório'),
})
export type LightToolFormValues = z.infer<typeof lightToolFormSchema>

/** Ativo pesado: valor > R$ 500,00. */
export const heavyAssetFormSchema = z.object({
  name: z.string().trim().min(1, 'Obrigatório'),
  purchaseValue: requiredNumber().gt(LIGHT_TOOL_MAX_VALUE, 'Informe um valor acima de R$ 500,00'),
  purchaseDate: z.string().regex(ymdRegex, 'Obrigatório'),
  usefulLifeMonths: requiredNumber()
    .int('Informe meses inteiros')
    .positive('Informe um valor maior que zero'),
  powerWatts: requiredNumber().min(0, 'Informe zero ou mais'),
  /** R$/kWh — opcional; em branco (null) = energia/hora 0. */
  electricityRate: z
    .number({ invalid_type_error: 'Valor inválido' })
    .min(0, 'Informe zero ou mais')
    .nullable(),
})
export type HeavyAssetFormValues = z.infer<typeof heavyAssetFormSchema>
