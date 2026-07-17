import { PageHeader } from '../../components/ui/PageHeader'
import { Skeleton } from '../../components/ui/Skeleton'
import { useActiveWorkspaceId } from '../../services/firestore'
import { FinancialProfileCard } from './FinancialProfileCard'
import { HiddenCostsCard } from './HiddenCostsCard'
import { MarketplacesCard } from './MarketplacesCard'
import { useWorkspaceSettings } from './data'

/**
 * /configuracoes — Perfil financeiro, custos ocultos e marketplaces.
 * Sem ação primária no cabeçalho: cada card salva a si.
 */
export function ConfiguracoesPage() {
  const wsId = useActiveWorkspaceId()
  const { settings, loading } = useWorkspaceSettings()

  if (!wsId) return null // RequireWorkspace garante workspace ativo

  return (
    <div>
      <PageHeader title="Configurações" />

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <FinancialProfileCard wsId={wsId} settings={settings} />
          <HiddenCostsCard wsId={wsId} settings={settings} />
        </div>
      )}

      <MarketplacesCard wsId={wsId} />
    </div>
  )
}
