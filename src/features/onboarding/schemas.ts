import { z } from 'zod'

/** Formulário de criação de workspace (nome do ateliê). */
export const workspaceFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Informe um nome com pelo menos 2 caracteres'),
})
export type WorkspaceFormValues = z.infer<typeof workspaceFormSchema>

/**
 * Linhas dinâmicas de convite por e-mail.
 * Linha vazia ('') é permitida e ignorada no submit; preenchida, precisa ser
 * um e-mail válido.
 */
export const inviteRowsSchema = z.object({
  rows: z.array(
    z.object({
      email: z.union([
        z.literal(''),
        z.string().trim().email('E-mail inválido'),
      ]),
    }),
  ),
})
export type InviteRowsValues = z.infer<typeof inviteRowsSchema>
