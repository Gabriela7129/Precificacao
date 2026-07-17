/**
 * Allowlist de e-mails autorizados a usar o app (espelho da regra
 * `isAllowedUser()` do firestore.rules — a segurança real está nas regras;
 * esta lista existe apenas para mostrar uma tela amigável de bloqueio).
 */
export const ALLOWED_EMAILS: readonly string[] = [
  'laetiessentia@gmail.com',
  'gabriela2004t@gmail.com',
  'lettprincesa@gmail.com',
  'ltomio@hotmail.com',
]

export function isEmailAllowed(email: string | null | undefined): boolean {
  if (!email) return false
  return ALLOWED_EMAILS.includes(email.trim().toLowerCase())
}
