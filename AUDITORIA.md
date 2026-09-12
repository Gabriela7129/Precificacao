# Auditoria — Precificador de Artesanato

**Data:** 11/09/2026 · **Auditor:** Hermes Agent (a pedido do Luis)
**Escopo:** ~9k linhas em `src/`, `docs/documento-requisitos.md`, `HANDOFF.md`, `firestore.rules`.
**Método:** leitura integral do código de negócio, comparação com o documento de requisitos,
verificação numérica das fórmulas (casos de teste executados), build validado (`npm run build` ✓).
**Contexto git:** 13 commits de "Coding Agent" + 23 da Gabriela — desenvolvimento assistido por IA em sessões curtas.

---

## Diretriz desta rodada

> **Objetivo: corrigir a visão original (documento de requisitos). NÃO acrescentar features nem
> "melhorar" além do que a visão original pede.** Aprimoramentos ficam para uma passagem futura.

### Intenção registrada para passagem futura (fora de escopo agora)

Aplicar **conceitos reais de administração/contabilidade de custos** ao modelo — ideias do Luis a
detalhar depois. Direções prováveis (apenas registro, não é decisão): custeio por absorção vs.
custeio variável, rateio de custos indiretos por direcionadores (ABC), separação custo fixo vs.
variável, margem de contribuição vs. markup, ponto de equilíbrio. **Nada disso deve entrar nesta
rodada.**

---

## ✅ Verificado como correto (não mexer)

- `src/lib/calculations.ts` — fórmulas puras batem com o documento de requisitos (§4/§5):
  horas/mês = horas/semana × 4,33 · valor hora base = salário ÷ horas/mês ·
  depreciação/hora = valor ÷ (vida útil × horas/mês) · energia/hora = (W × tarifa) ÷ 1000 ·
  custo médio ponderado · margem · cálculo reverso de marketplace (com taxa fixa).
  Validado numericamente: 10un@R$2 + compra 5un/R$15 → R$2,3333 ✓; salário R$3.000/30h → R$23,09/h ✓.
- Regra "materiais leves compartilhados contam 1×" — a dedução em si está matematicamente correta
  dentro do modelo adotado (o problema é o modelo — ver F3).
- `registerSupplyEntry` — batch atômico Firestore (insumo + entrada) ✓.
- Contrato de serviços (`firestore.ts`) consistente; tipos alinhados à modelagem §6.

---

## 🔴 Achados críticos

### F1 — Editar re-snapshot tudo silenciosamente (viola "Integridade Histórica" §5)
O requisito: alterações futuras de custos **não** alteram produtos já finalizados; só "Reavaliar" faz isso.
O código: em `ProdutoFormPage.tsx` (onSubmit, l.216–234) e `ComponenteFormPage.tsx` (l.187–204),
o save persiste o cálculo **live** (`live.*` / `custo.*`), que usa sempre o custo ATUAL de cada
insumo/componente/ativo. Abrir um produto antigo, corrigir o nome e salvar = reavaliação completa
sem pedir. Pior: a UI diz "Valor atual: X — **atualize se quiser** usar o novo custo"
(l.334, 414, 494, 579, 662) — mas o save aplica o novo custo **sempre**.
**Correção na visão original:** editar preserva snapshots salvos; reavaliar é o único caminho que atualiza custos.

### F2 — Breakdown não fecha com "líquido desejado"
`pricing.ts` l.45: com `desiredNetValue` + marketplace, o preço de venda é calculado a partir do
líquido desejado, mas o breakdown (`PricingBreakdown.tsx`) exibe `precoSemTaxas` (derivado da
margem) + `taxaMarketplace` = `salePrice` — identidade que **não vale** nesse caso.
Caso real verificado: custo R$50, margem 40%, Shopee 20%+R$4, líquido R$80 →
exibe 70 + 25 = 105 (70+25≠105). O comentário no código afirma a identidade como se fosse geral.
**Correção na visão original:** o breakdown deve refletir a base real do cálculo (§5: "usuário informa
o líquido que quer receber, o sistema calcula o preço de venda").

### F3 — Material leve: manutenção MENSAL cobrada como custo fixo POR UNIDADE
**RESOLVIDO (set/2026) — decisão da Gabriela: o modelo VIGENTE é este mesmo.**
Materiais leves não usam mais rateio por hora produtiva; cada material entra como custo fixo
(manutenção mensal = valor × taxa %) por uso, com dedução de repetição no produto (conta 1×).
O documento de requisitos foi atualizado para refletir o modelo vigente; a função
`lightMaintenancePerHour` e o card "Rateio por hora produtiva" foram removidos.
---
**Texto original da auditoria (histórico):**
Doc §4 (Módulo 1): a manutenção (taxa% × valor) é **rateada pelas horas produtivas do mês**
("Rateio por hora = Σ manutenções mensais / horas produtivas/mês").
Código: `componentUnitCost` (calculations.ts l.158–170) soma a manutenção mensal **inteira** por
componente; `lightMaintenancePerHour` existe mas só alimenta um card informativo
(`MateriaisLevesPage.tsx` l.59) — não entra em custo nenhum.
Consequência: tesoura R$50 (manut. R$3,50/mês) em 200 un/mês = R$700/mês de "manutenção".
A dedução "conta 1×" mitiga dupla contagem entre componentes, mas não corrige a escala.
**Correção na visão original:** decidir onde o rateio entra (custo/hora do produto, como o doc descreve)
— alinhando com a Gabriela antes, pois mexe em preço de venda.

### F4 — Settings não propagam (staleness silencioso)
`monthlyMaintenanceCost` (MaterialLeveFormModal l.74–77) e `depreciationPerHour`/`totalCostPerHour`
(AtivoPesadoFormModal l.99–111) são calculados **no cadastro** e persistidos. Mudar taxa de
manutenção, horas produtivas ou tarifa de energia **não recalcula** os itens existentes e não há aviso.
Parece dinâmico; é estático com data de validade invisível.
**Correção na visão original:** recalcular derivados ao salvar settings (ou no mínimo avisar na tela).

### F5 — Zero testes, zero lint
`package.json` sem script `test`; sem eslint/prettier. Para um app cuja razão de existir é fazer
conta, é o débito mais perigoso. *(Endereçado nesta rodada — ver "Testes" abaixo.)*

---

## 🟡 Hardcoded disfarçado de dinâmico

| # | Item | Realidade |
|---|---|---|
| H1 | Workspace | `FIXED_WORKSPACE_ID = 'th1su6PkVx9Gjwkdocqr'` hardcoded em `workspaceStore.ts` l.7 **e** `firestore.rules` l.25/35. O doc §3 descreve multi-workspace + convite de membros; nada disso existe |
| H2 | Allowlist | 4 e-mails duplicados em `allowedEmails.ts` l.6–11 **e** `firestore.rules` l.13–18 — adicionar membro = 2 arquivos + redeploy |
| H3 | `src/services/workspaces.ts` | README referencia ("criação de workspace, membros e seeds") — **arquivo não existe** |
| H4 | Fator Hora Criativa | Fixo `CREATIVE_HOUR_FACTOR = 1.4` (calculations.ts l.21); doc diz faixa 1,3–1,5; não há campo para o fator (só override manual do valor final) |
| H5 | Limite R$500 leves/pesados | Não validado em lugar nenhum (doc §4 define o limite; a UI do ativo até diz "sem limite de valor") |
| H6 | Marketplaces padrão | Sem seed (Shopee/ML/Nuvemshop do doc §5) — usuário cria na mão |

---

## 🟠 Média gravidade

- **M1 — Estoque nunca desce:** só há entrada (`registerSupplyEntry`). Produzir/vender não dá baixa;
  "Valor total em estoque" cresce para sempre. O doc não especifica baixa — registrar, decisão da Gabriela.
- **M2 — Mão de obra exibida como "resto":** `ProdutoDetalhePage.tsx` l.262–268 calcula
  `humanCost = directCost − demais + dedução`, com `Math.max(...,0)` — esconde inconsistências e
  mistura dedução **live** com directCost **snapshot**.
- **M3 — `parseBRLInput("1.5") → 15`:** ponto é sempre milhar (`format.ts` l.57–63, verificado
  executando). Quem digita decimal com ponto leva erro de 10× sem aviso.
- **M4 — Fee 100% → preço de venda R$0 silencioso** (`salePriceFromDesiredNet`, calculations.ts l.267–268; sem validação de erro).
- **M5 — Versionamento por nome:** sem `groupId`; renomear quebra o histórico; dois itens homônimos
  fundem históricos (`produtos/data.ts` l.55–63; `excluirProduto`/`excluirComponente` casam por nome).
- **M6 — `desiredNetValue` sem marketplace é ignorado silenciosamente** (`pricing.ts` l.45:
  `desiredNetValue != null && marketplace ? ...`), mas o formulário exibe o campo independente.
- **M7 — Doc desatualizado vs código:** fórmula do preço de venda no doc (§5 l.185) ignora taxa fixa;
  o código está mais certo que o doc. Atualizar o doc quando tocar no assunto.
- **M8 — Bundle 1,4 MB sem code-splitting** (warning do próprio build).

---

## Ordem de ataque (nesta rodada: só o item 1)

1. **Testes nas funções puras** (`calculations.ts`, `pricing.ts`, `format.ts`) — trava o
   comportamento atual e dá rede de segurança para as correções. ✅ feito nesta rodada.
2. F1 — modelo de snapshot: editar preserva custos; só "Reavaliar" atualiza (remover aviso enganoso).
3. F2 — breakdown coerente com líquido desejado.
4. ~~F3 — materiais leves: alinhar rateio com o doc~~ **DECIDIDO (set/2026):** modelo vigente =
   custo fixo por uso (manutenção mensal = valor × taxa %), sem rateio por hora. Doc e código
   alinhados; `lightMaintenancePerHour` removida.
5. F4 — recalcular derivados quando settings mudarem (ou avisar).
6. (Depois) H1–H6, M1–M8 conforme priorizar com a Gabriela.

---

## Testes (item 1 — esta rodada)

- Framework: **Vitest** (mesma stack Vite; sem config extra).
- `src/lib/calculations.test.ts` — todas as funções puras contra as fórmulas do doc §4/§5.
- `src/features/produtos/pricing.test.ts` — `computePricing`, incluindo **testes de caracterização**
  dos comportamentos desviantes (F2, M4, M6): o teste documenta o que o código faz HOJE, marcado com
  `// AUDITORIA Fx:` — quando o bug for corrigido, o teste deve ser atualizado de propósito.
- `src/lib/format.test.ts` — formatação/parse pt-BR, incluindo a caracterização de M3.
- Fora desta rodada: `analisarLevesCompartilhados` vive em `produtos/data.ts`, que importa
  Firestore/React — testá-lo exige mover para módulo puro (é refator, fica para a passagem do F1/F3).

**Acesso:** repo com permissão read-only para o Luis — mudanças vão via fork + PR para a Gabriela.
