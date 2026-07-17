import { z } from 'zod'

const requiredNumber = (message = 'Obrigatório') =>
  z.number({ required_error: message, invalid_type_error: message })

/** Card "Perfil financeiro" — calculadora de valor hora. */
export const financialProfileSchema = z.object({
  desiredSalary: requiredNumber().min(0, 'Informe um valor igual ou maior que zero'),
  productiveHoursPerWeek: requiredNumber()
    .gt(0, 'Informe um valor maior que zero')
    .max(168, 'Máximo de 168 horas por semana'),
  hourlyOperational: requiredNumber().min(0, 'Informe um valor igual ou maior que zero'),
  hourlyCreative: requiredNumber().min(0, 'Informe um valor igual ou maior que zero'),
})
export type FinancialProfileValues = z.infer<typeof financialProfileSchema>

/** Card "Custos ocultos" — manutenção leve e energia. */
export const hiddenCostsSchema = z.object({
  lightMaintenanceRate: requiredNumber()
    .min(0, 'Informe um valor igual ou maior que zero')
    .max(100, 'Máximo 100%'),
  electricityRate: z
    .number({ invalid_type_error: 'Informe um valor válido' })
    .min(0, 'Informe um valor igual ou maior que zero')
    .nullable(),
})
export type HiddenCostsValues = z.infer<typeof hiddenCostsSchema>

/** Modal de marketplace (criar/editar). */
export const marketplaceFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Informe um nome com pelo menos 2 caracteres'),
  feePercentage: requiredNumber()
    .min(0, 'Informe um valor igual ou maior que zero')
    .max(100, 'Máximo 100%'),
  fixedFee: z
    .number({ invalid_type_error: 'Informe um valor válido' })
    .min(0, 'Informe um valor igual ou maior que zero')
    .nullable(),
  isDefault: z.boolean(),
})
export type MarketplaceFormValues = z.infer<typeof marketplaceFormSchema>
