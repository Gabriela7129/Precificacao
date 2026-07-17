import type { ReactNode } from 'react'

export interface PageHeaderProps {
  title: string
  /** Ações à direita (botão primário etc.). */
  actions?: ReactNode
}

/** Cabeçalho canônico de página: título à esquerda, ações à direita. */
export function PageHeader({ title, actions }: PageHeaderProps) {
  return (
    <div className="flex justify-between items-center mb-6">
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      {actions && <div className="flex gap-3">{actions}</div>}
    </div>
  )
}
