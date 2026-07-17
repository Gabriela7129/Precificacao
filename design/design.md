# Precificador de Artesanato — Design System & Especificação de UI

> Artefato de design para o build greenfield. Stack fixa: React + Vite + TypeScript + Tailwind CSS + Firebase (Firestore/Auth) + Zustand + React Hook Form + Zod + React Router.
> Fontes de verdade: `docs/documento-requisitos.md` (regras de negócio e modelagem) e `docs/prototipo.html` (direção visual aprovada). Este documento **não** reabre essas decisões — apenas as traduz em tokens, componentes, rotas e fatias de trabalho.

---

## 1. Conceito global e princípios visuais

**Conceito:** uma ferramenta de trabalho calma e acolhedora para artesãos (costura, encadernação, papelaria). A estética "atelier de papelaria" vem da paleta pastel rosa + amarelo sobre fundo creme. Nada de dashboards densos de contador: cada tela responde uma pergunta só ("quanto custa?", "quanto cobro?", "o que tenho em estoque?").

**Princípios (nesta ordem):**

1. **Só resultados claros.** Fórmulas nunca aparecem na UI. O usuário vê "Custo/hora: R$ 2,29", nunca "valor/(vida útil × horas)". Cálculos vivem em `src/lib/calculations.ts`.
2. **Minimalismo quente.** Fundo `amber-50`, superfícies brancas, bordas `rose-200` finas, sombras discretas. Zero gradientes decorativos em fundos — o único gradiente do app é o do logo.
3. **Uma ação primária por tela.** Botão rosa sólido no canto superior direito do cabeçalho da página. Tudo mais é secundário (outline) ou ghost (link).
4. **Linguagem de artesã, não de ERP.** Labels curtos e humanos: "Materiais Leves", "Custos ocultos", "Preço sem taxas" (nomenclatura mantida do protótipo).
5. **Previsível e repetível.** Toda listagem usa o mesmo padrão (PageHeader + busca/filtro + tabela ou grid de cards + empty state). Todo formulário simples é modal; toda composição complexa é página dedicada.
6. **Denso o suficiente, nunca apertado.** Tabelas com `px-6 py-4`, cards com `p-6`, ritmo vertical `space-y-6`.

---

## 2. Mapa de rotas / páginas

Níveis de acesso: **pública** (sem auth), **auth** (logado, sem workspace), **app** (logado + workspace selecionado/criado). Guards em `src/router/guards.tsx` (`RequireAuth`, `RequireWorkspace`).

| Rota | Arquivo da página | Acesso | Descrição |
|---|---|---|---|
| `/login` | `src/pages/LoginPage.tsx` | pública | Entrada com Google Sign-In |
| `/onboarding/workspace` | `src/pages/onboarding/WorkspaceCreatePage.tsx` | auth | Criar workspace (nome do ateliê) |
| `/onboarding/convites` | `src/pages/onboarding/InviteMembersPage.tsx` | auth | Convidar membros (todos Administradores no MVP) |
| `/configuracoes` | `src/pages/ConfiguracoesPage.tsx` | app | Perfil financeiro, custos ocultos, marketplaces |
| `/materiais-leves` | `src/pages/MateriaisLevesPage.tsx` | app | Lista + CRUD de materiais leves (≤ R$ 500) |
| `/ativos-pesados` | `src/pages/AtivosPesadosPage.tsx` | app | Lista + CRUD de ativos pesados (> R$ 500) |
| `/insumos` | `src/pages/InsumosPage.tsx` | app | Estoque de insumos, entradas, categorias |
| `/componentes` | `src/pages/ComponentesPage.tsx` | app | Grid de cards de componentes semi-acabados |
| `/componentes/novo` | `src/pages/ComponenteFormPage.tsx` | app | Composição de novo componente (página, não modal) |
| `/componentes/:id` | `src/pages/ComponenteFormPage.tsx` | app | Edição/visualização da composição |
| `/produtos` | `src/pages/ProdutosPage.tsx` | app | Grid de cards de produtos ativos |
| `/produtos/arquivados` | `src/pages/ProdutosArquivadosPage.tsx` | app | Versões arquivadas (somente leitura) |
| `/produtos/novo` | `src/pages/ProdutoFormPage.tsx` | app | Montagem + precificação de novo produto |
| `/produtos/:id` | `src/pages/ProdutoDetalhePage.tsx` | app | Detalhe em duas colunas (composição + precificação) |
| `/produtos/:id/editar` | `src/pages/ProdutoFormPage.tsx` | app | Edição de produto |
| `*` | redirect | — | Redireciona para `/produtos` (app) ou `/login` |

Regras de redirecionamento:
- Usuário logado sem workspace → qualquer rota **app** redireciona para `/onboarding/workspace`.
- Usuário logado com workspace → `/login` e `/onboarding/*` redirecionam para `/produtos`.
- Após criar workspace em `/onboarding/workspace` → navega para `/onboarding/convites`. "Criar workspace" ou "Pular" em convites → `/produtos`.

---

## 3. Sistema visual

### 3.1 Cores (Tailwind default palette — já validada no protótipo)

Usar as escalas **padrão** `rose` e `amber` do Tailwind (valores idênticos aos do protótipo: rose-50 `#fff1f2` … rose-900 `#881337`; amber-50 `#fffbeb` … amber-900 `#78350f`). Nenhuma cor custom extra além de `gray` e `green`/`red` semânticos.

| Papel | Classe | Uso |
|---|---|---|
| Fundo do app | `bg-amber-50` | `body` / `<main>` |
| Superfície | `bg-white` | cards, sidebar, modais, tabelas |
| Texto base | `text-gray-800` | corpo |
| Títulos | `text-gray-900` | h1/h2/h3 de cards |
| Texto secundário | `text-gray-500` / `text-gray-600` | helpers, meta, th |
| Borda padrão | `border-rose-200` | cards, inputs, sidebar, divisores fortes |
| Divisor suave | `divide-rose-100` / `border-rose-100` | linhas de tabela, separadores internos |
| Primária | `bg-rose-500` → hover `bg-rose-600` | botão primário, valores em destaque (`text-rose-500`) |
| Seleção/nav ativa | `bg-rose-100 text-rose-700` | item de menu ativo, badges rose |
| Hover suave | `hover:bg-rose-50` | linhas de tabela, botões secundários |
| Hover nav inativo | `hover:bg-amber-100` | itens de menu |
| Cabeçalho de tabela | `bg-amber-100` | `<thead>` |
| Fundo de input | `bg-amber-50` | inputs dentro de cards brancos |
| Badge categoria | `bg-amber-100 text-amber-800` ou `bg-rose-100 text-rose-700` | alternar por categoria (hash) |
| Badge "Padrão" | `bg-amber-300 text-amber-900` | marketplace default |
| Sucesso / Ativo | `bg-green-100 text-green-700` | badge de status |
| Arquivado | `bg-gray-100 text-gray-600` | badge de status |
| Perigo | `bg-red-600` (botão), `text-red-600` (erro) | exclusão, validação |

**Único gradiente permitido:** logo — `bg-gradient-to-br from-rose-400 to-amber-300`.

### 3.2 Tipografia

- Família: `font-sans` (recomendado adicionar `@fontsource-variable/inter` e configurar `fontFamily.sans: ['Inter Variable', 'ui-sans-serif', 'system-ui', 'sans-serif']`; se optar por não instalar, o stack default do Tailwind é o fallback oficial).
- Título de página: `text-2xl font-bold text-gray-900`.
- Título de card: `font-semibold text-gray-900` (opcionalmente `text-lg` em cards de lista).
- Corpo: `text-sm` em tabelas e meta; `text-base` em textos corridos (raro).
- Labels: `block text-sm font-medium text-gray-700 mb-1`.
- Helper: `text-xs text-gray-500 mt-1`.
- Valores monetários em destaque: `text-xl font-bold text-rose-500` (cards de produto) e `text-2xl font-bold text-rose-500` (custo unitário de componente).

### 3.3 Raios, sombras, espaçamento

- Raios: inputs/botões/linhas internas `rounded-xl`; cards de marketplace e pills internas `rounded-2xl`; cards principais, containers de tabela e cards de login `rounded-3xl`; badges `rounded-full`.
- Sombras: cards `shadow-sm`; hover de card clicável `hover:shadow-md`; card de login `shadow-lg`; botão primário `shadow-sm`; sidebar sem sombra (só `border-r`).
- Espaçamento: container principal `p-8` desktop / `p-4 pb-24` mobile; grids `gap-6`; seções verticais `space-y-6`; linhas de formulário `space-y-4`.
- Largura de conteúdo: sem max-width arbitrário no `<main>` (o grid usa a largura disponível); modais `max-w-md`; cards de auth `max-w-sm`/`max-w-md`.
- Breakpoints: mobile < `md` (768), tablet `md`, sidebar visível a partir de `lg` (1024). Desktop ≥ `lg`.

### 3.4 Classes utilitárias recorrentes (padrões-canônicos)

Criar como componentes em `src/components/ui/`. Nomes **obrigatórios** (workers não devem inventar variações):

- **Card** — `bg-white p-6 rounded-3xl shadow-sm border border-rose-200`
- **Button variant="primary"** — `bg-rose-500 hover:bg-rose-600 text-white font-medium rounded-xl px-4 py-2 text-sm shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed`
- **Button variant="secondary"** — `bg-white border border-rose-200 text-gray-700 hover:bg-rose-50 font-medium rounded-xl px-4 py-2 text-sm transition`
- **Button variant="ghost"** — `text-rose-500 hover:text-rose-600 text-sm font-medium` (ex.: "+ Adicionar marketplace")
- **Button variant="danger"** — `bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl px-4 py-2 text-sm transition`
- **Input / Select / CurrencyInput / PercentInput** — `w-full border border-rose-200 bg-amber-50 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-rose-400 placeholder:text-gray-400`; estado de erro: `border-red-400 focus:ring-red-400`. Variante de busca sobre fundo creme: `bg-white`.
- **SearchInput** — Input com ícone `Search` (lucide) à esquerda, `bg-white`, `max-w-md` quando sozinho.
- **Table** — wrapper `bg-white rounded-3xl shadow-sm border border-rose-200 overflow-hidden` (com `overflow-x-auto` interno); `<thead class="bg-amber-100">`, `<th class="text-left px-6 py-3 font-medium text-gray-600">`, `<tbody class="divide-y divide-rose-100">`, `<tr class="hover:bg-rose-50">`, `<td class="px-6 py-4 text-sm">`.
- **Badge** — base `text-xs px-2 py-1 rounded-full`; variants: `success` (green), `muted` (gray), `amber`, `rose`, `default` (amber-300/amber-900).
- **PageHeader** — `flex justify-between items-center mb-6` com título `text-2xl font-bold` à esquerda e ações à direita (`flex gap-3`).
- **EmptyState** — `bg-white rounded-3xl border border-rose-200 p-12 text-center` + ícone lucide `w-12 h-12 text-rose-300 mx-auto mb-4` + título `font-semibold text-gray-900` + descrição `text-sm text-gray-500` + Button primary.
- **Modal** — overlay `fixed inset-0 bg-black/30 z-50`; painel desktop `bg-white rounded-3xl border border-rose-200 shadow-lg p-6 w-full max-w-md`; em mobile vira bottom sheet: `fixed inset-x-0 bottom-0 rounded-t-3xl max-h-[90vh] overflow-y-auto`.
- **ConfirmDialog** — Modal com título `font-semibold`, corpo `text-sm text-gray-600`, rodapé `flex gap-3 justify-end` (Cancelar secondary + ação danger/primary).
- **Logo** — `bg-gradient-to-br from-rose-400 to-amber-300 rounded-xl flex items-center justify-center text-white font-bold shadow-sm` (tamanhos: `w-9 h-9 text-sm` sidebar, `w-20 h-20 rounded-2xl text-3xl` login).

---

## 4. Layout compartilhado (`AppShell`)

Arquivos: `src/components/layout/AppShell.tsx`, `Sidebar.tsx`, `BottomNav.tsx`, `NavItem.tsx`, `Topbar.tsx`.

### Desktop (≥ lg)

Estrutura idêntica ao protótipo: `flex h-screen overflow-hidden` com sidebar fixa + `<main class="flex-1 overflow-y-auto p-8 bg-amber-50">`.

**Sidebar** — `w-64 bg-white border-r border-rose-200 flex flex-col flex-shrink-0`, sem opção de recolher:
1. **Bloco de marca** (`p-5 border-b border-rose-200 flex items-center gap-3`): Logo `w-9 h-9` + nome do workspace `font-bold text-gray-900 truncate`.
2. **Nav** (`flex-1 p-3 space-y-1`) — ordem fixa dos itens (ícone lucide `w-5 h-5` + label):
   | # | Label | Rota | Ícone lucide |
   |---|---|---|---|
   | 1 | Configurações | `/configuracoes` | `Settings` |
   | 2 | Materiais Leves | `/materiais-leves` | `Scissors` |
   | 3 | Ativos Pesados | `/ativos-pesados` | `Zap` |
   | 4 | Insumos | `/insumos` | `Package` |
   | 5 | Componentes | `/componentes` | `Wrench` |
   | 6 | Produtos | `/produtos` | `Tag` |
   - Item ativo: `bg-rose-100 text-rose-700 font-medium`; inativo: `text-gray-700 hover:bg-amber-100`; base: `w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition`.
   - "Produtos" fica ativo também em `/produtos/arquivados`, `/produtos/novo`, `/produtos/:id` (match por prefixo). Mesma regra para `/componentes/*`.
3. **Bloco do usuário** (`p-4 border-t border-rose-200`): avatar (`img` do `photoURL` do Google, `w-8 h-8 rounded-full`, fallback `bg-amber-200` com inicial) + e-mail `font-medium text-gray-900 truncate` + papel `text-gray-500` ("Administrador"). Clique abre menu simples com "Sair" (logout → `/login`).

**Sem topbar no desktop** — a sidebar carrega toda a identidade.

### Mobile (< lg) — decisão: **topbar fina + bottom nav** (não drawer)

Justificativa: 6 destinos fixos de uso frequente; artesã usa o celular na bancada e precisa trocar de módulo com o polegar. Drawer esconderia a navegação principal.

- **Topbar** — `h-14 bg-white border-b border-rose-200 flex items-center gap-2 px-4 sticky top-0 z-40`: Logo `w-8 h-8` + nome do workspace `font-bold truncate` + avatar à direita (abre menu com "Sair").
- **Bottom nav** — `fixed bottom-0 inset-x-0 h-16 bg-white border-t border-rose-200 z-40 grid grid-cols-6`: mesmo conjunto de 6 itens, ícone `w-5 h-5` + label `text-[10px] leading-tight`; ativo `text-rose-600`, inativo `text-gray-500`; cada item `flex flex-col items-center justify-center gap-0.5`.
- **Conteúdo** — `<main class="p-4 pb-24 bg-amber-50 min-h-screen">` (o `pb-24` livra a bottom nav).
- Tabelas em mobile: wrapper com `overflow-x-auto` e `min-w-[640px]` na `<table>` — scroll horizontal, sem esmagar colunas.

---

## 5. Design por página

### 5.1 `/login` — LoginPage (pública)

- Hierarquia: tela centrada (`min-h-screen flex items-center justify-center p-6`), card `max-w-sm` com `shadow-lg` e texto centralizado.
- Conteúdo: Logo grande (`w-20 h-20 rounded-2xl text-3xl` + `shadow-md`), título "Precificador" (`text-2xl font-bold`), subtítulo "Cálculo de custos para artesanato" (`text-gray-500`), botão "Entrar com Google" (`w-full`, secondary com `border-rose-200 hover:bg-rose-50`, gap-3, contém o SVG oficial do "G" do Google — copiar o markup inline do protótipo, é o único SVG inline permitido).
- Interações: clique → `signInWithPopup(GoogleAuthProvider)`; loading no botão (`Loader2` `animate-spin` + disabled); erro → toast vermelho "Não foi possível entrar. Tente novamente." Usuário já logado → redirect automático.
- Mobile: idêntico (card já é `max-w-sm`).

### 5.2 `/onboarding/workspace` — WorkspaceCreatePage (auth)

- Card centrado `max-w-md`: título "Criar workspace", helper "Nome do ateliê ou empresa", label "Nome do workspace", Input (Zod: `min(2)`), Button primary full-width "Continuar".
- Interação: submit → cria doc `workspaces` + membro owner → navega para `/onboarding/convites`.
- Empty/erro: campo vazio → mensagem Zod `text-xs text-red-600` "Informe um nome com pelo menos 2 caracteres".

### 5.3 `/onboarding/convites` — InviteMembersPage (auth)

- Card centrado `max-w-md`: título "Convidar membros", helper "Adicione contas pessoais para colaborar. Neste primeiro momento, todos terão perfil de administrador."
- Lista dinâmica de linhas: Input email (`flex-1`) + Select **disabled** "Administrador" (`bg-gray-100 text-gray-500`); link ghost "+ Adicionar outro e-mail" adiciona linha.
- Rodapé `flex gap-3`: Button primary `flex-1` "Criar workspace" + Button secondary `flex-1` "Pular".
- Validação: e-mails inválidos bloqueiam submit com erro inline; linhas vazias são ignoradas.

### 5.4 `/configuracoes` — ConfiguracoesPage (app)

- PageHeader simples: título "Configurações" (sem ação primária — cada card salva a si).
- Grid `grid-cols-1 lg:grid-cols-2 gap-6`:
  - **Card "Perfil financeiro"** (`space-y-4`): CurrencyInput "Salário líquido desejado/mês"; Input numérico "Horas produtivas/semana"; linha `flex gap-4` com CurrencyInput "Hora Operacional" e "Hora Criativa" (ambos editáveis; helper compartilhado "Calculados automaticamente — ajuste se quiser"); Button primary pequeno "Recalcular" (reaplica fator 1,0 / 1,3–1,5 sobre o valor hora base; fatores ficam em `src/lib/calculations.ts`).
  - **Card "Custos ocultos"**: PercentInput "Taxa de manutenção leve (%)" (helper "Aplicada sobre o valor de cada material leve", default 7); CurrencyInput "Tarifa de energia (R$/kWh)" (helper "Deixe em branco se não quiser calcular energia", opcional); Button primary pequeno "Salvar".
- **Card "Marketplaces"** (`mt-6`, largura total): header interno `flex justify-between items-center mb-4` com título + ghost "+ Adicionar marketplace". Grid `grid-cols-1 md:grid-cols-3 gap-4` de mini-cards (`border border-rose-200 rounded-2xl p-4 bg-amber-50 hover:bg-amber-100 transition`): nome + Badge `default` "Padrão" quando aplicável, linha "Taxa: 20% + R$ 4,00" (`text-sm text-gray-600`), ações ghost "Editar" / "Excluir" (`text-xs`).
- Interações: Editar/Novo → **MarketplaceFormModal** (nome, taxa %, taxa fixa R$ opcional, checkbox "Padrão"); Excluir → ConfirmDialog (bloquear exclusão se houver produto usando — validar e exibir toast de erro "Este marketplace está em uso por produtos").
- Empty state de marketplaces: ícone `Store`, "Nenhum marketplace cadastrado", CTA ghost "+ Adicionar marketplace". (Pré-semente recomendada na criação do workspace: Shopee 20% + R$4, Mercado Livre 20%, Nuvemshop 1% — via `settings` seed, ver requisitos.)
- Toast de sucesso: "Configurações salvas".

### 5.5 `/materiais-leves` — MateriaisLevesPage (app)

- PageHeader: título "Materiais Leves" + Button primary "+ Novo material".
- SearchInput: placeholder "Buscar material leve...".
- Tabela colunas: Nome | Valor pago | Data compra | Manut. mensal | Status | Ações (ghost "Editar").
- Manut. mensal = `purchaseValue × lightMaintenanceRate/100` (exibida, nunca editada direto).
- **MaterialLeveFormModal** (criar/editar): Nome; CurrencyInput "Valor pago" (helper "Itens até R$ 500,00. Acima disso, cadastre em Ativos Pesados."; Zod: `> 0` e `<= 500`); Input `type="date"` "Data de compra".
- Empty state: ícone `Scissors`, "Nenhum material leve cadastrado", "Cadastre estiletes, réguas, tesouras e agulhas para ratear a manutenção na hora trabalhada.", CTA "+ Novo material".
- Excluir (ícone `Trash2` ghost na linha, além de Editar): ConfirmDialog "Excluir material?".

### 5.6 `/ativos-pesados` — AtivosPesadosPage (app)

- PageHeader: "Ativos Pesados" + Button primary "+ Novo ativo". SearchInput "Buscar ativo...".
- Tabela colunas: Nome | Valor | Data compra | Depreciação/hora | Energia/hora | Total/hora (`font-medium`) | Ações.
- **AtivoPesadoFormModal**: Nome; CurrencyInput "Valor pago" (helper "Itens acima de R$ 500,00. Até R$ 500,00, cadastre em Materiais Leves."; Zod `> 500`); Data de compra; Input numérico "Vida útil estimada (meses)"; Input numérico "Potência (Watts)"; CurrencyInput "Tarifa de energia (R$/kWh)" pré-preenchida das configurações, editável, pode ficar em branco (energia/hora = 0).
- **Preview de cálculo ao vivo** no rodapé do modal (`bg-amber-50 rounded-xl p-3 text-sm space-y-1`): "Depreciação/hora: R$ 1,95", "Energia/hora: R$ 0,34", "Total/hora: **R$ 2,29**" — recalcula a cada keystroke via `watch()` do RHF. Sem fórmulas visíveis.
- Empty state: ícone `Zap`, "Nenhum ativo pesado cadastrado", "Cadastre máquinas e equipamentos para calcular depreciação e energia por hora.", CTA "+ Novo ativo".

### 5.7 `/insumos` — InsumosPage (app)

- PageHeader: "Insumos" + `flex gap-3`: Button secondary "+ Entrada" e Button primary "+ Novo insumo".
- Barra de filtros `flex gap-3 mb-4`: SearchInput `flex-1` "Buscar insumo..." + Select de categoria ("Todas as categorias" + categorias do workspace) `bg-white`.
- Link ghost discreto abaixo do filtro: "Gerenciar categorias" → **CategoriasModal**.
- Tabela colunas: Nome | Categoria (Badge, cor alternada por hash da categoria) | Estoque ("250 folhas" — quantidade + unidade) | Custo médio | Última compra | Ações (Editar).
- **InsumoFormModal**: Nome; "Unidade de medida" — Input com `datalist` de sugestões (`unidade`, `folha`, `cm`, `m`, `g`, `ml`) mas texto livre; Select "Categoria" (+ opção "Nova categoria…" que abre CategoriasModal); ao criar: "Estoque inicial" e "Custo médio inicial (R$)" (na edição esses dois viram read-only — estoque só muda por Entradas).
- **EntradaEstoqueModal** (registrar compra): Select "Insumo"; Input "Quantidade"; CurrencyInput "Valor total da compra"; `type="date"` "Data da compra"; Input "Observação (opcional)". Preview ao vivo no rodapé (`bg-amber-50 rounded-xl p-3`): "Novo custo médio: **R$ 0,16**" (cálculo CMP do documento de requisitos, em `calculations.ts`).
- **CategoriasModal**: lista de categorias (Badge + nome; `isDefault` não pode ser excluída), renomear inline (lápis), criar nova (Input + botão), excluir só se nenhum insumo usa (caso contrário toast "Categoria em uso").
- Empty state: ícone `Package`, "Nenhum insumo cadastrado", "Cadastre papéis, linhas, colas e tecidos para montar seus componentes.", CTA "+ Novo insumo".

### 5.8 `/componentes` — ComponentesPage (app)

- PageHeader: "Componentes Semi-Acabados" + Button primary "+ Novo componente".
- Grid `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6` de cards clicáveis (`cursor-pointer hover:shadow-md transition` → `/componentes/:id`):
  - Título `font-semibold text-lg`, meta `text-sm text-gray-500` ("2 insumos · 1 ativo · 20 min"), rodapé `flex justify-between items-end`: label "Custo unitário" + valor `text-2xl font-bold text-rose-500`.
- Empty state: ícone `Wrench`, "Nenhum componente cadastrado", "Crie itens intermediários como 'Miolo A5 Costurado' para reutilizar nos produtos.", CTA "+ Novo componente".

### 5.9 `/componentes/novo` e `/componentes/:id` — ComponenteFormPage (app)

**Página dedicada** (composição é complexa demais para modal). Layout `grid grid-cols-1 lg:grid-cols-3 gap-6`:

- **Coluna principal (`lg:col-span-2 space-y-6`)**:
  1. Card "Dados básicos": Input "Nome do componente".
  2. Card "Insumos": linhas repetíveis (`flex gap-3 items-center`) — Select insumo (`flex-1`) + Input quantidade (`w-28`) + custo parcial read-only (`text-sm text-gray-600`, `w-24 text-right`) + botão `Trash2` ghost; link ghost "+ Adicionar insumo". Linhas dentro de `space-y-3`.
  3. Card "Tempo de máquina": Select "Ativo pesado" (lista de `heavyAssets`, com opção "Nenhum") + Input "Tempo (minutos)".
  4. Card "Mão de obra": segmented control (dois botões `flex-1` — ativo `bg-rose-100 text-rose-700 font-medium`, inativo `bg-white border border-rose-200 text-gray-700`) "Operacional" / "Criativa" + Input "Tempo (minutos)".
- **Coluna lateral (`space-y-6`)**:
  - Card "Resumo" sticky (`lg:sticky lg:top-8`): breakdown `space-y-2 text-sm` — "Insumos: R$ 5,20", "Máquina: R$ 0,76", "Mão de obra: R$ 2,44", divisor `border-t border-rose-100`, "Custo unitário" `text-2xl font-bold text-rose-500` — tudo recalculado ao vivo.
  - Card "Ações": Button primary full "Salvar componente" + Button secondary full "Cancelar" (volta para `/componentes`).
- Ao salvar: grava **snapshot** de custos (`unitCostSnapshot` por insumo, `version`) conforme regra de integridade histórica. Toast "Componente salvo".
- Mobile: coluna única; card Resumo perde o sticky e vai para o final, antes das Ações.

### 5.10 `/produtos` — ProdutosPage (app)

- PageHeader: "Produtos Finais" + `flex gap-3`: Button secondary com ícone `Archive` "Arquivados" (→ `/produtos/arquivados`) + Button primary "+ Novo produto" (→ `/produtos/novo`).
- Grid `grid-cols-1 lg:grid-cols-2 gap-6` de cards clicáveis (→ `/produtos/:id`):
  - Topo `flex justify-between items-start`: título + meta "v1 · criado em 12/07/2026" | Badge `success` "Ativo".
  - Linhas `space-y-2 text-sm`: "Custo direto" / "Margem" / "Preço sem taxas" (cada uma `flex justify-between`, valor `font-medium`); última linha `border-t border-rose-100 pt-2 mt-2`: "Preço de venda" + `text-xl font-bold text-rose-500`.
- Empty state: ícone `Tag`, "Nenhum produto cadastrado", "Monte seu primeiro produto a partir dos componentes e descubra o preço de venda ideal.", CTA "+ Novo produto".

### 5.11 `/produtos/arquivados` — ProdutosArquivadosPage (app)

- Header com back: botão `p-2 hover:bg-rose-100 rounded-lg text-gray-600` com ícone `ArrowLeft` (→ `/produtos`) + título "Produtos Arquivados".
- Mesmos cards de `/produtos`, mas com `opacity-70` e Badge `muted` "Arquivado" (meta: "v0 · arquivado em 01/06/2026").
- Clique → `/produtos/:id` (detalhe renderiza banner de somente-leitura, ver 5.12).
- Empty state: ícone `Archive`, "Nenhum produto arquivado", "Versões antigas aparecem aqui quando você reavalia custos ou arquiva um produto."

### 5.12 `/produtos/:id` — ProdutoDetalhePage (app)

- Header com back (`ArrowLeft` → `/produtos`) + título = nome do produto.
- Se `isArchived`: banner âmbar no topo (`bg-amber-100 border border-amber-300 text-amber-900 rounded-2xl p-4 text-sm flex gap-2 items-center`, ícone `Archive`) — "Versão arquivada (v0) — somente leitura. Reavalie para gerar uma nova versão." e o card Ações é ocultado.
- Grid `grid-cols-1 lg:grid-cols-3 gap-6`:
  - **Coluna esquerda (`lg:col-span-2 space-y-6`)**:
    1. Card "Composição": linhas `flex justify-between items-center p-3 rounded-xl` — componentes e embalagens com `bg-rose-50`, mão de obra com `bg-amber-50`; cada linha: nome `font-medium` + meta `text-xs text-gray-500` ("Componente · 1 un" / "Embalagem · 1 un" / "Operacional · 15 min") e valor `font-medium` à direita.
    2. Card "Histórico de versões": linhas `border border-rose-200 rounded-xl p-3 flex justify-between items-center` — "v1" + "Criado em 12/07/2026" + Badge (Ativo/Arquivado). Clicar numa versão arquivada abre o mesmo detalhe em modo leitura.
  - **Coluna direita (`space-y-6`)**:
    1. Card "Precificação": PercentInput "Margem de lucro (%)"; Select "Marketplace" (opções com taxa no label: "Shopee (20% + R$ 4,00)"); breakdown `border-t border-rose-100 pt-4 space-y-2 text-sm` — Custo direto / Margem (R$) / Preço sem taxas / Taxa do marketplace; linha final `text-lg font-bold border-t border-rose-100 pt-2`: "Preço de venda" `text-rose-500`; linha `text-sm text-gray-500`: "Valor líquido". Editar margem/marketplace aqui recalcula ao vivo (mas só persiste via "Editar produto" ou auto-save com debounce — **decisão: auto-save com debounce de 800 ms + toast "Precificação atualizada"**, pois é o ajuste mais frequente do app).
    2. Card "Ações" (`space-y-2`): Button primary full "Editar produto" (→ `/produtos/:id/editar`); Button secondary full "Reavaliar custos"; Button secondary full "Arquivar versão".
- **Reavaliar custos** → ConfirmDialog variante informativa (ação primary, não danger): título "Reavaliar custos?", corpo "A versão atual (v1) será arquivada e uma nova versão (v2) será criada com os custos de hoje." → confirma → cria nova versão com snapshots atuais, arquiva anterior, toast "Nova versão criada (v2)".
- **Arquivar versão** → ConfirmDialog danger "Arquivar este produto?" → `isArchived: true`, redirect para `/produtos`.

### 5.13 `/produtos/novo` e `/produtos/:id/editar` — ProdutoFormPage (app)

Mesma estrutura de duas colunas do detalhe, em modo de edição:

- **Coluna esquerda**: Card "Nome do produto" (Input); Card "Componentes" (linhas Select componente + quantidade + custo parcial + remover; ghost "+ Adicionar componente"); Card "Embalagem" (linhas Select insumo avulso + quantidade; ghost "+ Adicionar embalagem"); Card "Acabamento final" (segmented Operacional/Criativa + tempo em minutos).
- **Coluna direita**: Card "Precificação" — PercentInput "Margem de lucro (%)"; Select "Marketplace"; CurrencyInput "Valor líquido desejado" (cálculo reverso: preencher aqui recalcula o preço de venda); breakdown ao vivo (Custo direto / Margem / Preço sem taxas / Taxa marketplace / **Preço de venda** / Valor líquido). Card "Ações": Button primary full "Salvar produto" + secondary "Cancelar".
- Salvar: cria/atualiza com snapshots de custo (`unitCostSnapshot`) e `version` conforme regras. Toast "Produto salvo".
- Guard de navegação: se houver alterações não salvas, ConfirmDialog "Descartar alterações?".

---

## 6. Linguagem de interação

### 6.1 Feedbacks

- **Toasts** — biblioteca `sonner` (`<Toaster position="top-right" richColors={false} />`; mobile: `position="bottom-center"`). Estilo: default com borda — customizar para `bg-white border border-rose-200 text-gray-800 rounded-xl shadow-md`; sucesso com ícone `CheckCircle2` rose; erro `bg-red-50 border-red-200 text-red-700`. Mensagens-canônicas:
  - Sucesso de salvamento: `"{Entidade} salvo(a) com sucesso"` (ex.: "Insumo salvo com sucesso").
  - Exclusão: `"{Entidade} excluído(a)"`.
  - Erro genérico: `"Não foi possível salvar. Tente novamente."`
  - Erro de rede/auth: `"Sem conexão. Verifique sua internet."`
- **Confirmações destrutivas** — sempre ConfirmDialog (nunca `window.confirm`); padrão: título `"Excluir {entidade}?"`, corpo `"Esta ação não pode ser desfeita. {Nome} será removido permanentemente."`, botões "Cancelar" (secondary) / "Excluir" (danger).
- **Loading** — primeira carga de listas: skeleton (`animate-pulse bg-rose-100 rounded-xl`) — 5 linhas de tabela ou 3 cards; recargas via listener do Firestore são silenciosas (sem spinner). Botões em submit: `Loader2 animate-spin` + `disabled` + label preservado.
- **Sincronização** — Firestore listeners em tempo real; sem indicador permanente. Apenas quando `hasPendingWrites`, pill discreta no rodapé da sidebar/topbar: `bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-full` "Sincronizando…".

### 6.2 Formulários (React Hook Form + Zod)

- `useForm({ resolver: zodResolver(schema), mode: 'onBlur' })` em todos os forms; schemas em `src/lib/schemas.ts` (um por entidade: `lightToolSchema`, `heavyAssetSchema`, `supplySchema`, `supplyEntrySchema`, `componentSchema`, `productSchema`, `marketplaceSchema`, `workspaceSchema`).
- Erros: mensagem `text-xs text-red-600 mt-1` sob o campo + classe de erro no Input. Mensagens em pt-BR curtas ("Obrigatório", "Informe um valor maior que zero", "Máximo R$ 500,00").
- Regra de ouro: **nunca** validar com `alert`; nunca bloquear submit sem indicar o campo.

### 6.3 Moeda, números, datas

- Formatação centralizada em `src/lib/format.ts`:
  - `formatBRL(value)` → `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })` → "R$ 4.500,00".
  - `formatNumber(value, { unit })` → `toLocaleString('pt-BR')` + unidade ("250 folhas").
  - `formatDate(date)` → `Intl.DateTimeFormat('pt-BR')` → "12/07/2026".
  - `formatMinutes(min)` → "20 min" / "1h30".
- **CurrencyInput**: máscara pt-BR ao digitar (aceita "4500", "4.500", "4.500,00"), armazena `number` em reais. Exibição sempre 2 casas; internamente custos unitários podem ter até 4 casas (arredondar só na exibição).
- **PercentInput**: sufixo "%", armazena `number` (40, não 0,4).
- Horas de trabalho: inputs em **minutos** na UI (mais natural para artesanato), convertidos para horas no cálculo.
- Datas: `type="date"` nativo estilizado como Input; exibição sempre `dd/mm/aaaa`.

### 6.4 Microinterações

- Transições: `transition` (150 ms default do Tailwind) em hover de cards, botões, nav. Nada além de cor/sombra — **sem** animações de layout, sem parallax, sem keyframes custom (exceto `animate-pulse` de skeleton e `animate-spin` de loader).
- Foco: sempre `focus:ring-2 focus:ring-rose-400` (ou variantes de erro) — nunca remover outline sem substituto.
- `prefers-reduced-motion`: desabilitar `animate-pulse` (media query utilitária no `index.css`).
- Teclado: modais fecham com `Esc`; foco inicial no primeiro campo; `Enter` submete.

---

## 7. Agrupamento sugerido de workers

Contrato anti-conflito: cada fatia **só cria/edita os arquivos listados**. Arquivos compartilhados (UI kit, types, format, calculations, stores, AppShell) pertencem **exclusivamente à Fatia 0**; demais fatias apenas importam.

### Fatia 0 — Fundação & Design System (bloqueante, fazer primeiro)
`package.json`/Vite scaffold, `tailwind.config.ts` (paleta default + fonte), `src/index.css`, `src/main.tsx`, `src/App.tsx`, `src/router/*` (rotas + guards), `src/services/firebase.ts`, `src/types/index.ts` (modelos Firestore do doc de requisitos), `src/lib/format.ts`, `src/lib/calculations.ts` (assinaturas tipadas + implementação das fórmulas), `src/lib/schemas.ts`, `src/stores/authStore.ts`, `src/stores/workspaceStore.ts`, `src/components/layout/*` (AppShell, Sidebar, BottomNav, Topbar, NavItem), `src/components/ui/*` (Button, Input, Select, CurrencyInput, PercentInput, SearchInput, Card, Badge, Table, Modal, ConfirmDialog, EmptyState, PageHeader, SegmentedControl, Logo, Skeleton), setup `sonner`.
**Entrega:** app navegável com login Google funcionando, shell completo, páginas placeholder.

### Fatia 1 — Onboarding & Configurações
`src/pages/onboarding/WorkspaceCreatePage.tsx`, `InviteMembersPage.tsx`, `src/pages/ConfiguracoesPage.tsx`, `src/components/marketplaces/MarketplaceFormModal.tsx`, `src/hooks/useSettings.ts`, `src/hooks/useMarketplaces.ts`, `src/services/workspaces.ts`, `src/services/settings.ts`.

### Fatia 2 — Materiais Leves & Ativos Pesados
`src/pages/MateriaisLevesPage.tsx`, `src/pages/AtivosPesadosPage.tsx`, `src/components/materiais/MaterialLeveFormModal.tsx`, `src/components/ativos/AtivoPesadoFormModal.tsx`, `src/hooks/useLightTools.ts`, `src/hooks/useHeavyAssets.ts`, `src/services/lightTools.ts`, `src/services/heavyAssets.ts`.

### Fatia 3 — Insumos
`src/pages/InsumosPage.tsx`, `src/components/insumos/InsumoFormModal.tsx`, `EntradaEstoqueModal.tsx`, `CategoriasModal.tsx`, `src/hooks/useSupplies.ts`, `src/hooks/useSupplyCategories.ts`, `src/services/supplies.ts`, `src/services/supplyEntries.ts` (CMP usa `calculations.ts` da Fatia 0).

### Fatia 4 — Componentes
`src/pages/ComponentesPage.tsx`, `src/pages/ComponenteFormPage.tsx`, `src/components/componentes/CompositionLines.tsx`, `src/hooks/useComponents.ts`, `src/services/components.ts`. Depende dos **tipos e serviços** das Fatias 2 e 3 (consumo read-only: lista de insumos e ativos) — coordenar via `src/types/index.ts` já congelado na Fatia 0; se desenvolvida em paralelo, mockar `useSupplies`/`useHeavyAssets`.

### Fatia 5 — Produtos
`src/pages/ProdutosPage.tsx`, `src/pages/ProdutosArquivadosPage.tsx`, `src/pages/ProdutoDetalhePage.tsx`, `src/pages/ProdutoFormPage.tsx`, `src/components/produtos/PricingPanel.tsx`, `VersionHistory.tsx`, `src/hooks/useProducts.ts`, `src/services/products.ts` (snapshot + versionamento). Depende dos tipos das Fatias 3 e 4 — mesma estratégia de contrato/mocks.

**Ordem recomendada:** Fatia 0 → (1, 2, 3 em paralelo) → (4) → (5). Paralelismo total é possível se as assinaturas de `src/services/*` e `src/types/index.ts` forem respeitadas como contrato.

---

## 8. Manifesto de assets

**Nenhum asset gerado por IA.** O app é 100% tipográfico + ícones de biblioteca.

| Asset | Tipo | Onde | Especificação | Fallback |
|---|---|---|---|---|
| Logo | Componente (`src/components/ui/Logo.tsx`) | login, sidebar, topbar | `div` com `bg-gradient-to-br from-rose-400 to-amber-300 rounded-xl` + letra "P" `text-white font-bold`; tamanhos 32/36/80 px | — (é código) |
| Ícone Google "G" | SVG inline | botão de login | markup SVG copiado do `docs/prototipo.html` (cores oficiais Google) | botão sem ícone mantém texto |
| Ícones de UI | biblioteca | todo o app | `lucide-react` — usar somente os listados: `Settings, Scissors, Zap, Package, Wrench, Tag, Archive, ArrowLeft, Search, Plus, Trash2, Pencil, X, CheckCircle2, Loader2, Store, LogOut` | — |
| Favicon | SVG autoral | `public/favicon.svg` | quadrado 64×64 com o mesmo gradiente rose→amber e "P" branca centralizada (escrito à mão, ~10 linhas de SVG) | favicon default do Vite |
| Fonte Inter Variable | npm (`@fontsource-variable/inter`) | global | opcional; importar no `main.tsx` | stack `font-sans` default |

Proibido: imagens de hero, ilustrações, fotos de stock, texturas, emojis como ícones de menu (o protótipo usa emojis apenas como placeholder — substituir por lucide).

---

## 9. Dependências de implementação (além da stack fixa)

- `react-router-dom` — rotas e guards.
- `lucide-react` — ícones.
- `sonner` — toasts.
- `@fontsource-variable/inter` — fonte (opcional, recomendado).
- Nada mais. Datas e moeda via `Intl` nativo; máscaras de input implementadas em `src/lib/format.ts` (evitar libs de máscara pesadas).

---

**Status:** design fechado para desenvolvimento. Dúvidas de negócio → `docs/documento-requisitos.md`; dúvidas visuais → `docs/prototipo.html` + este arquivo. Em caso de conflito, o protótipo vence na aparência e o documento de requisitos vence na regra.
