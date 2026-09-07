/**
 * Schemas Zod dos formulários do módulo (React Hook Form + zodResolver).
 * A classificação leve × pesado é definida APENAS pela página onde o item é
 * cadastrado — não há limite de valor.
 */

import { z } from 'zod'

const ymdRegex = /^\d{4}-\d{2}-\d{2}$/

const requiredNumber = () =>
  z.number({ required_error: 'Obrigatório', invalid_type_error: 'Obrigatório' })

/** Material leve: qualquer valor > 0. */
export const lightToolFormSchema = z.object({
  name: z.string().trim().min(1, 'Obrigatório'),
  purchaseValue: requiredNumber().positive('Informe um valor maior que zero'),
  purchaseDate: z.string().regex(ymdRegex, 'Obrigatório'),
})
export type LightToolFormValues = z.infer<typeof lightToolFormSchema>

/** Ativo pesado: qualquer valor > 0. */
export const heavyAssetFormSchema = z.object({
  name: z.string().trim().min(1, 'Obrigatório'),
  purchaseValue: requiredNumber().positive('Informe um valor maior que zero'),
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
