import { Package, Scissors, Settings, Tag, Wrench, Zap, type LucideIcon } from 'lucide-react'

export interface NavItemDef {
  label: string
  to: string
  icon: LucideIcon
  /** Prefixo para match ativo (ex.: "/produtos" casa /produtos/novo). */
  matchPrefix: string
}

/** Ordem fixa dos itens de navegação (sem gestão de equipe). */
export const NAV_ITEMS: NavItemDef[] = [
  { label: 'Configurações', to: '/configuracoes', icon: Settings, matchPrefix: '/configuracoes' },
  { label: 'Materiais Leves', to: '/materiais-leves', icon: Scissors, matchPrefix: '/materiais-leves' },
  { label: 'Ativos Pesados', to: '/ativos-pesados', icon: Zap, matchPrefix: '/ativos-pesados' },
  { label: 'Insumos', to: '/insumos', icon: Package, matchPrefix: '/insumos' },
  { label: 'Componentes', to: '/componentes', icon: Wrench, matchPrefix: '/componentes' },
  { label: 'Produtos', to: '/produtos', icon: Tag, matchPrefix: '/produtos' },
]
