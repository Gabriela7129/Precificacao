/**
 * CategoriasModal — gestão de categorias de insumos.
 * Lista ordenada por `order`; cria novas; renomeia inline (inclusive as
 * padrão, conforme o documento de requisitos); exclui apenas categorias
 * não-padrão e sem insumos vinculados.
 */

import { useState } from 'react'
import { CheckCircle2, Pencil, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Badge, Button, ConfirmDialog, Input, Modal } from '../../components/ui'
import {
  createSupplyCategory,
  deleteSupplyCategory,
  updateSupplyCategory,
  useActiveWorkspaceId,
  useSupplies,
  useSupplyCategories,
} from '../../services/firestore'
import type { SupplyCategory, WithId } from '../../types'

export interface CategoriasModalProps {
  open: boolean
  onClose: () => void
}

export function CategoriasModal({ open, onClose }: CategoriasModalProps) {
  const wsId = useActiveWorkspaceId()
  const { data: categories } = useSupplyCategories()
  const { data: supplies } = useSupplies()

  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<WithId<SupplyCategory> | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const sortedCategories = [...categories].sort((a, b) => a.order - b.order)

  const handleCreate = async () => {
    const name = newName.trim()
    if (!wsId || !name) return
    setSaving(true)
    try {
      const nextOrder = categories.reduce((max, c) => Math.max(max, c.order), -1) + 1
      await createSupplyCategory(wsId, { name, isDefault: false, order: nextOrder })
      setNewName('')
      toast.success('Categoria salva com sucesso')
    } catch {
      toast.error('Não foi possível salvar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const startRename = (category: WithId<SupplyCategory>) => {
    setEditingId(category.id)
    setEditingName(category.name)
  }

  const cancelRename = () => {
    setEditingId(null)
    setEditingName('')
  }

  const handleRename = async (category: WithId<SupplyCategory>) => {
    const name = editingName.trim()
    if (!wsId || !name) return
    setSaving(true)
    try {
      await updateSupplyCategory(wsId, category.id, { name })
      cancelRename()
      toast.success('Categoria salva com sucesso')
    } catch {
      toast.error('Não foi possível salvar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const requestDelete = (category: WithId<SupplyCategory>) => {
    const inUse = supplies.some((supply) => supply.categoryId === category.id)
    if (inUse) {
      toast.error('Categoria em uso: não é possível excluir.')
      return
    }
    setDeleteTarget(category)
  }

  const handleDelete = async () => {
    if (!wsId || !deleteTarget) return
    setDeleting(true)
    try {
      await deleteSupplyCategory(wsId, deleteTarget.id)
      toast.success('Categoria excluída')
      setDeleteTarget(null)
    } catch {
      toast.error('Não foi possível salvar. Tente novamente.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title="Categorias de insumos">
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Nova categoria"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void handleCreate()
                }
              }}
            />
            <Button
              onClick={() => void handleCreate()}
              loading={saving && newName.trim().length > 0}
              disabled={!newName.trim()}
              className="whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Adicionar
            </Button>
          </div>

          {sortedCategories.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma categoria cadastrada.</p>
          ) : (
            <ul className="border border-rose-200 rounded-xl divide-y divide-rose-100 max-h-72 overflow-y-auto">
              {sortedCategories.map((category) => (
                <li key={category.id} className="px-3 py-2 flex items-center gap-2">
                  {editingId === category.id ? (
                    <>
                      <Input
                        autoFocus
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            void handleRename(category)
                          }
                          if (e.key === 'Escape') cancelRename()
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => void handleRename(category)}
                        disabled={!editingName.trim() || saving}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition disabled:opacity-50"
                        aria-label="Salvar nome"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={cancelRename}
                        className="p-1.5 rounded-lg text-gray-500 hover:bg-rose-50 transition"
                        aria-label="Cancelar edição"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm text-gray-900 truncate">
                        {category.name}
                      </span>
                      {category.isDefault && <Badge variant="default">Padrão</Badge>}
                      <button
                        type="button"
                        onClick={() => startRename(category)}
                        className="p-1.5 rounded-lg text-gray-500 hover:bg-rose-50 hover:text-rose-500 transition"
                        aria-label={`Renomear ${category.name}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {!category.isDefault && (
                        <button
                          type="button"
                          onClick={() => requestDelete(category)}
                          className="p-1.5 rounded-lg text-gray-500 hover:bg-rose-50 hover:text-red-600 transition"
                          aria-label={`Excluir ${category.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-gray-500">
            Categorias padrão podem ser renomeadas, mas não excluídas.
          </p>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        title="Excluir categoria?"
        body={`Esta ação não pode ser desfeita. ${deleteTarget?.name ?? ''} será removida permanentemente.`}
        confirmLabel="Excluir"
        variant="danger"
        loading={deleting}
      />
    </>
  )
}
