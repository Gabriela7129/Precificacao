# Precificador de Artesanato

App web para precificação de produtos artesanais (costura, encadernação, papelaria).
Calcula custo real de produção (mão de obra, materiais, máquinas, energia e custos
ocultos) e gera preços de venda por marketplace.

**Stack:** React + Vite + TypeScript, Tailwind CSS v4, React Router v7, Firebase
(Auth Google + Firestore), Zustand, React Hook Form + Zod, Sonner, Lucide.

## Configuração do Firebase

1. Crie um projeto em <https://console.firebase.google.com>.
2. Ative **Authentication → Login do Google**.
3. Crie um banco **Cloud Firestore** (modo de produção).
4. Em **Configurações do projeto → Seus apps**, registre um app da Web (`</>`) e
   copie as credenciais.
5. Copie `.env.example` para `.env` e preencha as chaves `VITE_FIREBASE_*`.
6. Publique as regras do Firestore: o conteúdo de `firestore.rules` pode ser
   colado em **Firestore → Regras** (ou via `firebase deploy --only firestore:rules`).

## Rodando

```bash
npm install        # no Windows (Git Bash): npm.cmd install
npm run dev        # no Windows (Git Bash): npm.cmd run dev
npm run build      # no Windows (Git Bash): npm.cmd run build
```

## Estrutura

- `src/types/index.ts` — modelos Firestore (seção 6 do documento de requisitos).
- `src/lib/calculations.ts` — todas as fórmulas de negócio (puras).
- `src/lib/format.ts` — moeda BRL, datas e percentuais pt-BR.
- `src/lib/firebase.ts` — inicialização do Firebase (`auth`, `db`, `googleProvider`).
- `src/services/firestore.ts` — CRUD com escopo de workspace + hooks em tempo
  real (**contrato para todos os módulos** — ver `src/services/README.md`).
- `src/services/workspaces.ts` — criação de workspace, membros e seeds.
- `src/stores/` — auth e workspace ativo (Zustand).
- `src/router/guards.tsx` — `RequireAuth` / `RequireWorkspace`.
- `src/components/ui/` — UI kit canônico (design.md §3.4).
- `src/components/layout/` — AppShell (sidebar + topbar + bottom nav).

## Documentos de referência

- `docs/documento-requisitos.md` — regras de negócio e modelagem.
- `docs/prototipo.html` — direção visual aprovada.
- `design/design.md` — design system, rotas e especificação de UI.
