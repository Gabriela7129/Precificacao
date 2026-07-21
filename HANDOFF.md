# Handoff do Precificador de Artesanato

Use este arquivo para dar contexto ao iniciar um novo chat de ajustes no projeto.

## Contexto atual

- **Projeto:** PWA em React + Vite + TypeScript + Tailwind + Firebase/Firestore.
- **Pasta local:** `C:\Users\Gabi\Documents\kimi\workspace\precificacao`
- **Workspace ativo:** `th1su6PkVx9Gjwkdocqr` (Laeti Essentia)
- **Login:** Google popup com allowlist de 4 e-mails; sem papéis.
- **Deploy:** Firebase Hosting — `https://precificador-de-artesanato.web.app`
- **Comando de build:** `npm run build`
- **Comando de deploy:** `firebase deploy --only hosting`

## Regras de negócio

- Custo de insumo = valor total pago ÷ quantidade inicial.
- Custo de componente = insumos + ativos pesados + materiais leves + mão de obra (criativa/operacional).
- Histórico de versões: produto e componente são versionados; ao reavaliar, a versão atual é arquivada e uma nova é criada com custos de hoje.
- Marketplace e lógica de precificação **não devem ser alterados** sem confirmação explícita.
- Documentos legados podem ter `machineAssets`, `lightTools` ou `supplies` ausentes; sempre usar `?? []`.
- Build deve passar antes de qualquer deploy.

## Mudanças recentes já deployadas

1. **Aviso de snapshot desatualizado:** no formulário e no detalhe do produto, componentes e embalagens mostram o custo atual entre parênteses quando divergem do snapshot salvo.
2. **Embalagens como componentes:** `SemiFinishedComponent` tem `isPackaging`; formulário de componente tem checkbox; lista de componentes filtra embalagens; produto usa componentes de embalagem. `ProductPackagingLine` mantém `supplyId` opcional para compatibilidade.
3. **Prevenção de duplicatas:** selects de insumos, ativos pesados e materiais leves no componente, e de componentes/embalagens no produto, filtram itens já usados em outras linhas.
4. **Data da primeira compra:** campo `purchaseDate` adicionado ao tipo `Supply`, schema e formulário de novo insumo; padrão é hoje quando não preenchido.

## Arquivos centrais

- `src/types/index.ts` — tipos principais.
- `src/lib/calculations.ts` — cálculos de custo.
- `src/features/componentes/ComponenteFormPage.tsx`, `ComponentesPage.tsx`, `ComponenteDetalhePage.tsx`, `data.ts`.
- `src/features/produtos/ProdutoFormPage.tsx`, `ProdutoDetalhePage.tsx`, `schema.ts`, `pricing.ts`.
- `src/features/insumos/InsumoFormModal.tsx`, `InsumosPage.tsx`, `schemas.ts`, `data.ts`.
- `src/components/ui/SelectSearchable.tsx`.
- `src/services/firestore.ts` — CRUDs e hooks do Firestore.
- `HANDOFF.md` — este arquivo.

---

## Prompt para novo chat

Copie e cole no início de um novo chat de ajustes:

```text
Vamos continuar o projeto de precificação de artesanato. Leia o handoff em C:\Users\Gabi\Documents\kimi\workspace\precificacao\HANDOFF.md para contexto. Confirme que entendeu e espere eu dizer "tudo certo" antes de começar a codar.
```
