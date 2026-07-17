import { useState } from 'react'
import { toast } from 'sonner'
import { Store } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Skeleton } from '../../components/ui/Skeleton'
import { deleteMarketplace, useMarketplaces, useProducts } from '../../services/firestore'
import { formatBRL, formatPercent } from '../../lib/format'
import type { Marketplace, WithId } from '../../types'
import { MarketplaceFormModal } from './MarketplaceFormModal'

/** "Taxa: 20% + R$ 4,00" */
function feeLabel(m: Marketplace): string {
  const parts = [`Taxa: ${formatPercent(m.feePercentage)}`]
  if (m.fixedFee != null && m.fixedFee > 0) parts.push(`+ ${formatBRL(m.fixedFee)}`)
  return parts.join(' ')
}

/**
 * Card "Marketplaces" (largura total): grid de mini-cards editáveis com CRUD
 * completo. Exclusão bloqueada quando há produto usando o marketplace.
 */
export function MarketplacesCard({ wsId }: { wsId: string }) {
  const { data: marketplaces, loading } = useMarketplaces()
  const { data: products } = useProducts()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<WithId<Marketplace> | null>(null)
  const [deleting, setDeleting] = useState<WithId<Marketplace> | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const openCreate = () => {
    setEditing(null)
    setModalOpen(true)
  }
  const openEdit = (m: WithId<Marketplace>) => {
    setEditing(m)
    setModalOpen(true)
  }

  const handleDelete = async () => {
    if (!deleting) return
    const inUse = products.some((p) => p.marketplaceId === deleting.id && !p.isArchived)
    if (inUse) {
      toast.error('Este marketplace está em uso por produtos')
      setDeleting(null)
      return
    }
    setDeleteBusy(true)
    try {
      await deleteMarketplace(wsId, deleting.id)
      toast.success('Marketplace excluído')
      setDeleting(null)
    } catch {
      toast.error('Não foi possível excluir. Tente novamente.')
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <Card className="mt-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-semibold text-gray-900">Marketplaces</h2>
        <Button variant="ghost" onClick={openCreate}>
          + Adicionar marketplace
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : marketplaces.length === 0 ? (
        <div className="text-center py-10">
          <Store className="w-12 h-12 text-rose-300 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-900">Nenhum marketplace cadastrado</h3>
          <p className="text-sm text-gray-500 mt-1 mb-4">
            Cadastre as plataformas onde você vende para calcular as taxas no preço final.
          </p>
          <Button variant="ghost" onClick={openCreate}>
            + Adicionar marketplace
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {marketplaces.map((m) => (
            <div
              key={m.id}
              className="border border-rose-200 rounded-2xl p-4 bg-amber-50 hover:bg-amber-100 transition"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-gray-900 truncate">{m.name}</span>
                {m.isDefault && <Badge variant="default">Padrão</Badge>}
              </div>
              <p className="text-sm text-gray-600">{feeLabel(m)}</p>
              <div className="flex gap-3 mt-3">
                <Button variant="ghost" className="text-xs px-0" onClick={() => openEdit(m)}>
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  className="text-xs px-0 text-red-600 hover:text-red-700"
                  onClick={() => setDeleting(m)}
                >
                  Excluir
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <MarketplaceFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        wsId={wsId}
        marketplaces={marketplaces}
        editing={editing}
      />

      <ConfirmDialog
        open={deleting != null}
        onClose={() => setDeleting(null)}
        onConfirm={() => void handleDelete()}
        title="Excluir marketplace?"
        body={`Esta ação não pode ser desfeita. ${deleting?.name ?? ''} será removido permanentemente.`}
        confirmLabel="Excluir"
        variant="danger"
        loading={deleteBusy}
      />
    </Card>
  )
}
