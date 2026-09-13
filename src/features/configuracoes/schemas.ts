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

/** Faixa de taxa por valor (toggle "Taxa por valor" do marketplace). */
export const marketplaceFeeTierSchema = z.object({
  minValue: z
    .number({ invalid_type_error: 'Informe um valor válido' })
    .min(0, 'Informe um valor igual ou maior que zero')
    .nullable(),
  maxValue: z
    .number({ invalid_type_error: 'Informe um valor válido' })
    .min(0, 'Informe um valor igual ou maior que zero')
    .nullable(),
  feePercentage: requiredNumber()
    .min(0, 'Informe um valor igual ou maior que zero')
    .max(100, 'Máximo 100%'),
  fixedFee: z
    .number({ invalid_type_error: 'Informe um valor válido' })
    .min(0, 'Informe um valor igual ou maior que zero')
    .nullable(),
})

/** Modal de marketplace (criar/editar). */
const marketplaceFormSchemaBase = z.object({
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
  /** Toggle "Taxa por valor" — quando ativo, exige ao menos uma faixa. */
  feeByValue: z.boolean(),
  feeTiers: z.array(marketplaceFeeTierSchema),
  isDefault: z.boolean(),
})
export type MarketplaceFeeTierValues = z.infer<typeof marketplaceFeeTierSchema>
export const marketplaceFormSchema = marketplaceFormSchemaBase.superRefine((data, ctx) => {
  if (!data.feeByValue) return
  if (data.feeTiers.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['feeTiers'],
      message: 'Adicione pelo menos uma faixa de taxa',
    })
    return
  }
  data.feeTiers.forEach((tier, i) => {
    if (tier.minValue != null && tier.maxValue != null && tier.minValue > tier.maxValue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['feeTiers', i, 'maxValue'],
        message: 'O máximo deve ser maior ou igual ao mínimo',
      })
    }
  })
})
export type MarketplaceFormValues = z.infer<typeof marketplaceFormSchema>
