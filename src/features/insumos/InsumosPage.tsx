/**
 * /insumos — Estoque de insumos (consumíveis).
 * Tabela com busca + filtro por categoria, card de resumo (valor total em
 * estoque), CRUD em modal, gestão de categorias e entradas de estoque com
 * custo médio ponderado.
 */

import { useMemo, useState } from 'react'
import { Package, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  PageHeader,
  SearchInput,
  Select,
  Table,
  TableSkeleton,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '../../components/ui'
import { formatBRL, formatDate, formatNumber } from '../../lib/format'
import {
  createSupply,
  createSupplyCategory,
  deleteSupply,
  useActiveWorkspaceId,
  useSupplies,
  useSupplyCategories,
  useSupplyEntries,
} from '../../services/firestore'
import type { Supply, WithId } from '../../types'
import { CategoriasModal } from './CategoriasModal'
import { EntradaEstoqueModal } from './EntradaEstoqueModal'
import { InsumoFormModal } from './InsumoFormModal'
import { downloadExcel, parseCurrency, parseExcelFile, parseNumber } from '../../lib/excel'
import { todayYmd } from './data'
import { ImportExportButtons } from '../../components/ui'

/** Alterna a cor do Badge por hash da categoria (amber/rose, ver design.md). */
function categoryBadgeVariant(categoryId: string): 'amber' | 'rose' {
  let hash = 0
  for (const char of categoryId) hash += char.charCodeAt(0)
  return hash % 2 === 0 ? 'amber' : 'rose'
}

export function InsumosPage() {
  const wsId = useActiveWorkspaceId()
  const { data: supplies, loading: loadingSupplies } = useSupplies()
  const { data: categories } = useSupplyCategories()
  const { data: entries } = useSupplyEntries()

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [editingSupply, setEditingSupply] = useState<WithId<Supply> | null>(null)
  const [entryOpen, setEntryOpen] = useState(false)
  const [entrySupply, setEntrySupply] = useState<WithId<Supply> | null>(null)
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<WithId<Supply> | null>(null)
  const [deleting, setDeleting] = useState(false)

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  )

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.order - b.order),
    [categories],
  )

  /** supplyId → data ("yyyy-mm-dd") da compra mais recente. */
  const lastEntryDateBySupply = useMemo(() => {
    const map = new Map<string, string>()
    for (const entry of entries) {
      const current = map.get(entry.supplyId)
      if (!current || entry.date > current) map.set(entry.supplyId, entry.date)
    }
    return map
  }, [entries])

  const totalStockValue = useMemo(
    () => supplies.reduce((sum, supply) => sum + supply.totalStockValue, 0),
    [supplies],
  )

  const filteredSupplies = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR')
    return supplies
      .filter((supply) => {
        if (categoryFilter && supply.categoryId !== categoryFilter) return false
        if (term && !supply.name.toLocaleLowerCase('pt-BR').includes(term)) return false
        return true
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  }, [supplies, search, categoryFilter])

  const openCreateForm = () => {
    setEditingSupply(null)
    setFormOpen(true)
  }

  const openEditForm = (supply: WithId<Supply>) => {
    setEditingSupply(supply)
    setFormOpen(true)
  }

  const openEntry = (supply: WithId<Supply> | null) => {
    setEntrySupply(supply)
    setEntryOpen(true)
  }

  const handleDelete = async () => {
    if (!wsId || !deleteTarget) return
    setDeleting(true)
    try {
      await deleteSupply(wsId, deleteTarget.id)
      toast.success('Insumo excluído')
      setDeleteTarget(null)
    } catch {
      toast.error('Não foi possível salvar. Tente novamente.')
    } finally {
      setDeleting(false)
    }
  }

  const handleExport = () => {
    const rows = supplies.map((s) => {
      const category = categoryById.get(s.categoryId)
      return {
        Nome: s.name,
        Unidade: s.unit,
        Categoria: category?.name ?? '',
        Estoque: s.currentStock,
        'Valor total em estoque': s.totalStockValue,
      }
    })
    downloadExcel(
      'insumos.xlsx',
      'Insumos',
      rows,
      [
        { header: 'Nome', key: 'Nome', width: 35 },
        { header: 'Unidade', key: 'Unidade', width: 15 },
        { header: 'Categoria', key: 'Categoria', width: 25 },
        { header: 'Estoque', key: 'Estoque', width: 15 },
        { header: 'Valor total em estoque', key: 'Valor total em estoque', width: 25 },
      ],
    )
  }

  const handleImport = async (file: File) => {
    if (!wsId) return
    interface SupplyImportRow {
      Nome: string
      Unidade: string
      Categoria: string
      Estoque: number
      'Valor total em estoque': number
    }
    const rows = await parseExcelFile<SupplyImportRow>(file, [
      { header: 'Nome', key: 'Nome' },
      { header: 'Unidade', key: 'Unidade' },
      { header: 'Categoria', key: 'Categoria' },
      { header: 'Estoque', key: 'Estoque', parse: parseNumber },
      { header: 'Valor total em estoque', key: 'Valor total em estoque', parse: parseCurrency },
    ])

    const nameMap = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c.id]))
    let created = 0
    for (const row of rows) {
      const name = String(row.Nome ?? '').trim()
      const unit = String(row.Unidade ?? '').trim()
      const categoryName = String(row.Categoria ?? '').trim()
      const stock = Number(row.Estoque) || 0
      const totalValue = Number(row['Valor total em estoque']) || 0
      if (!name || !unit || stock <= 0) continue

      let categoryId = nameMap.get(categoryName.toLowerCase())
      if (!categoryId && categoryName) {
        const newCategory = await createSupplyCategory(wsId, {
          name: categoryName,
          isDefault: false,
          order: categories.length,
        })
        categoryId = newCategory
        nameMap.set(categoryName.toLowerCase(), newCategory)
      }
      if (!categoryId) {
        // Categoria padrão: usa a primeira existente ou cria "Sem categoria".
        if (categories.length > 0) {
          categoryId = categories[0].id
        } else {
          const fallback = await createSupplyCategory(wsId, {
            name: 'Sem categoria',
            isDefault: true,
            order: 0,
          })
          categoryId = fallback
          nameMap.set('sem categoria', fallback)
          categories.push({ id: fallback, name: 'Sem categoria', isDefault: true, order: 0, workspaceId: wsId })
        }
      }
      await createSupply(wsId, {
        name,
        unit,
        categoryId,
        purchaseDate: todayYmd(),
        currentStock: stock,
        averageCost: stock > 0 ? totalValue / stock : 0,
        totalStockValue: totalValue,
        isActive: true,
      })
      created++
    }
    toast.success(`${created} insumo(s) importado(s)`)
  }

  if (loadingSupplies) {
    return (
      <div>
        <PageHeader title="Insumos" />
        <TableSkeleton />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Insumos"
        actions={
          <>
            <ImportExportButtons
              entityLabel="insumos"
              onExport={handleExport}
              onImport={handleImport}
            />
            <Button variant="secondary" onClick={() => openEntry(null)}>
              + Entrada
            </Button>
            <Button onClick={openCreateForm}>+ Novo insumo</Button>
          </>
        }
      />

      {supplies.length > 0 && (
        <Card className="mb-6">
          <p className="text-sm text-gray-500">Valor total em estoque</p>
          <p className="text-2xl font-bold text-rose-500 mt-1">{formatBRL(totalStockValue)}</p>
          <p className="text-xs text-gray-500 mt-1">
            {supplies.length} {supplies.length === 1 ? 'insumo cadastrado' : 'insumos cadastrados'}
          </p>
        </Card>
      )}

      {supplies.length > 0 && (
        <>
          <div className="flex gap-3 mb-4">
            <SearchInput
              className="flex-1 max-w-none"
              value={search}
              onChange={setSearch}
              placeholder="Buscar insumo..."
            />
            <Select
              surface="white"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-auto"
              aria-label="Filtrar por categoria"
            >
              <option value="">Todas as categorias</option>
              {sortedCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="mb-4">
            <button
              type="button"
              onClick={() => setCategoriesOpen(true)}
              className="text-rose-500 hover:text-rose-600 text-sm font-medium transition"
            >
              Gerenciar categorias
            </button>
          </div>
        </>
      )}

      {supplies.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Nenhum insumo cadastrado"
          description="Cadastre papéis, linhas, colas e tecidos para montar seus componentes."
          actionLabel="+ Novo insumo"
          onAction={openCreateForm}
        />
      ) : filteredSupplies.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Nenhum insumo encontrado"
          description="Ajuste a busca ou o filtro de categoria para encontrar o insumo."
        />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Nome</TH>
              <TH>Categoria</TH>
              <TH>Estoque</TH>
              <TH>Custo médio</TH>
              <TH>Última compra</TH>
              <TH className="text-right">Ações</TH>
            </tr>
          </THead>
          <TBody>
            {filteredSupplies.map((supply) => {
              const category = categoryById.get(supply.categoryId)
              const lastEntry = lastEntryDateBySupply.get(supply.id)
              return (
                <TR key={supply.id}>
                  <TD className="font-medium text-gray-900">{supply.name}</TD>
                  <TD>
                    {category ? (
                      <Badge variant={categoryBadgeVariant(supply.categoryId)}>
                        {category.name}
                      </Badge>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </TD>
                  <TD>{formatNumber(supply.currentStock, { unit: supply.unit })}</TD>
                  <TD>{formatBRL(supply.averageCost)}</TD>
                  <TD>{lastEntry ? formatDate(lastEntry) : '—'}</TD>
                  <TD>
                    <div className="flex gap-1 justify-end">
                      <button
                        type="button"
                        onClick={() => openEntry(supply)}
                        className="p-2 rounded-lg text-gray-500 hover:bg-rose-50 hover:text-rose-500 transition"
                        aria-label={`Entrada de estoque de ${supply.name}`}
                        title="Entrada de estoque"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditForm(supply)}
                        className="p-2 rounded-lg text-gray-500 hover:bg-rose-50 hover:text-rose-500 transition"
                        aria-label={`Editar ${supply.name}`}
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(supply)}
                        className="p-2 rounded-lg text-gray-500 hover:bg-rose-50 hover:text-red-600 transition"
                        aria-label={`Excluir ${supply.name}`}
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </TD>
                </TR>
              )
            })}
          </TBody>
        </Table>
      )}

      <InsumoFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        supply={editingSupply}
        onManageCategories={() => setCategoriesOpen(true)}
      />
      <EntradaEstoqueModal
        open={entryOpen}
        onClose={() => setEntryOpen(false)}
        supply={entrySupply}
      />
      <CategoriasModal open={categoriesOpen} onClose={() => setCategoriesOpen(false)} />
      <ConfirmDialog
        open={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        title="Excluir insumo?"
        body={`Esta ação não pode ser desfeita. ${deleteTarget?.name ?? ''} será removido permanentemente.`}
        confirmLabel="Excluir"
        variant="danger"
        loading={deleting}
      />
    </div>
  )
}
