import { Wrench } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'

/**
 * Stub de página ainda não implementada (rotas das próximas fatias).
 * Será substituído pelos workers de módulo.
 */
export function PlaceholderPage({ nome }: { nome: string }) {
  return (
    <div>
      <PageHeader title={nome} />
      <Card className="text-center py-12">
        <Wrench className="w-12 h-12 text-rose-300 mx-auto mb-4" />
        <h2 className="font-semibold text-gray-900">Em construção</h2>
        <p className="text-sm text-gray-500 mt-1">
          Esta página será implementada em breve.
        </p>
      </Card>
    </div>
  )
}
