# Serviços Firestore — contrato para os workers de módulo

Toda leitura/escrita de dados passa por `src/services/firestore.ts`. Nunca usar
`collection(db, ...)` diretamente em páginas ou hooks de módulo.

## Leitura em tempo real

```tsx
import { useLightTools } from '../../services/firestore'

function MateriaisLevesPage() {
  const { data: tools, loading, error } = useLightTools() // WithId<LightTool>[]
  // listener em tempo real, já filtrado pelo workspace ativo
}
```

Hooks disponíveis: `useSettings`, `useLightTools`, `useHeavyAssets`,
`useSupplyCategories`, `useSupplies`, `useSupplyEntries`, `useMarketplaces`,
`useSemiFinishedComponents`, `useProducts`.

## Escrita

```tsx
import { createLightTool, updateLightTool, deleteLightTool, useActiveWorkspaceId } from '../../services/firestore'

const wsId = useActiveWorkspaceId()! // RequireWorkspace garante não-nulo
const id = await createLightTool(wsId, { name, purchaseValue, purchaseDate, monthlyMaintenanceCost, isActive: true })
await updateLightTool(wsId, id, { name: 'Novo nome' })
await deleteLightTool(wsId, id)
```

- `createDoc` injeta `workspaceId` + `createdAt` automaticamente.
- `updateDoc` injeta `updatedAt` automaticamente.
- Cada coleção tem o trio `create*/update*/delete*` tipado (ver `firestore.ts`).

## Workspace

- `createWorkspace(name, ownerId)` (`src/services/workspaces.ts`): cria
  workspace + membro owner + settings default + categorias e marketplaces
  pré-semente. Retorna o id criado.
- O workspace ativo fica em `useWorkspaceStore` (`activeWorkspace`).
