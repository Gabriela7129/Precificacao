import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react'

/**
 * Tabela canônica do design system.
 *
 * Uso:
 *   <Table>
 *     <THead><tr><TH>Nome</TH><TH>Valor</TH></tr></THead>
 *     <TBody>
 *       <TR><TD>...</TD><TD>...</TD></TR>
 *     </TBody>
 *   </Table>
 *
 * Em mobile a tabela rola horizontalmente (min-w-[640px]).
 */
export function Table({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-3xl shadow-sm border border-rose-200 overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">{children}</table>
      </div>
    </div>
  )
}

export function THead({ children }: { children: ReactNode }) {
  return <thead className="bg-amber-100">{children}</thead>
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-rose-100">{children}</tbody>
}

export function TR({ children, className = '', ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={`hover:bg-rose-50 ${className}`} {...props}>
      {children}
    </tr>
  )
}

export function TH({ children, className = '', ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={`text-left px-6 py-3 font-medium text-gray-600 ${className}`} {...props}>
      {children}
    </th>
  )
}

export function TD({ children, className = '', ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={`px-6 py-4 text-sm ${className}`} {...props}>
      {children}
    </td>
  )
}
