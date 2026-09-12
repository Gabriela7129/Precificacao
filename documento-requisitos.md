# Precificador de Artesanato — Documento de Requisitos e Especificações

## 1. Visão Geral do Projeto

Aplicativo web para precificação de produtos artesanais, com foco em costurar, encadernação, papelaria artesanal e similares. O sistema deve calcular com precisão o custo real de produção, considerando mão de obra, materiais, máquinas, energia e custos ocultos, e gerar preços de venda por marketplace.

**Stack definida:**
- Front-end: React + Vite + TypeScript + Tailwind CSS
- Back-end/Banco: Firebase (Firestore + Auth + Hosting)
- Autenticação: Google Sign-In
- Formulários: React Hook Form + Zod
- Hospedagem: Vercel (preferencial) ou Firebase Hosting
- Sincronização: Firestore em tempo real, sempre online

---

## 2. Público e Contexto

- Artesãos e pequenos ateliês que precisam precificar produtos artesanais com precisão.
- O usuário não é contador: a interface deve ser limpa, minimalista e mostrar apenas resultados claros.
- Cálculos complexos devem ocorrer no back-end, sem expor fórmulas confusas na tela.

---

## 3. Arquitetura de Conta e Workspace

### Workspace
- O workspace é criado a partir de um e-mail da empresa (ex: atelie@gmail.com).
- Membros são convidados por e-mail para colaborar no mesmo workspace.
- Cada membro faz login com sua própria conta Google pessoal.
- Todos os dados do workspace são compartilhados entre os membros.

### Permissões (futuro, não escopo inicial)
- **Owner**: acesso total, pode excluir workspace.
- **Administrador**: convida/remove membros, altera configurações e edita tudo.
- **Editor**: cadastra e edita produtos, insumos, etc.
- **Visualizador**: apenas visualização.
- **Decisão para MVP**: neste primeiro momento, todos os membros convidados serão administradores.

### Banco de dados
- Todos os dados estruturados ficam no **Firebase Firestore**.
- Google Drive **não será usado como banco de dados**. Pode ser considerado futuramente para exportação de relatórios (PDFs, planilhas, fotos).

---

## 4. Módulos e Funcionalidades

### Módulo 1: Configurações Globais e Perfil

#### Calculadora de Valor Hora
- **Inputs**: salário líquido desejado/mês, horas produtivas/semana.
- **Output**: dois perfis de hora calculados automaticamente:
  - **Hora Operacional**: tarefas repetitivas.
  - **Hora Criativa**: design, planejamento e criação.
- **Regra**: os valores são calculados automaticamente, mas podem ser ajustados manualmente depois.

#### Cálculo
```
horas/mês = horas produtivas/semana × 4,33
valor hora base = salário líquido desejado / horas/mês
Hora Operacional = valor hora base × fator (padrão 1,0)
Hora Criativa = valor hora base × fator (padrão 1,3 a 1,5)
```

#### Materiais Leves (Ferramentas de Baixo Valor)
- Cadastrar individualmente: estiletes, réguas, tesouras, agulhas, etc.
- **Regra de valor**: itens com valor até **R$ 500,00** vão para materiais leves; acima de R$ 500,00 vão para ativos pesados.
- **Cálculo híbrido**: o sistema aplica uma taxa percentual (padrão 7%) sobre o valor de cada item cadastrado. Essa taxa é editável.
- O valor total mensal de manutenção leve é rateado pelas horas produtivas trabalhadas no mês.
- Exemplo:
```
Manutenção mensal do item = valor do item × (taxa / 100)
Rateio por hora = Σ manutenções mensais / horas produtivas/mês
```

#### Tarifa de Energia
- Campo para informar o valor do kWh (R$/kWh).
- Pode ficar em branco.
- Usada no cálculo de custo de energia dos ativos pesados.

---

### Módulo 2: Ativos Pesados (Ferramentas Pesadas)

#### Cadastro
- Nome
- Data de compra
- Valor pago
- Vida útil estimada em meses
- Potência em Watts
- Tarifa de energia no momento do cadastro (herda das configurações, editável)

#### Cálculo Automático
```
depreciação/hora = valor pago / (vida útil em meses × horas produtivas/mês)
energia/hora = (potência Watts × tarifa kWh) / 1000
custo/hora do ativo = depreciação/hora + energia/hora
```

#### Regra de valor
- Apenas itens com valor acima de R$ 500,00 entram aqui.
- Itens até R$ 500,00 devem ser cadastrados como materiais leves no Módulo 1.

---

### Módulo 3: Estoque de Insumos (Consumíveis)

#### Cadastro de Insumos
- Nome
- Unidade de medida (livre, com sugestões: centímetros, grama, unidade)
- Categoria
- Estoque atual
- Custo médio ponderado
- Valor total em estoque

#### Categorias Pré-definidas
- Papéis
- Fios e linhas
- Cola
- Tecidos
- Ferragens (ilhós, cantoneiras)
- Embalagens
- Tinta e vernizes
- Laminações
- O usuário pode criar novas categorias e editar os nomes das existentes.

#### Entradas de Estoque
- Cada compra futura é registrada manualmente.
- Campos: insumo, quantidade, valor total, data da compra, observação opcional.
- **Cálculo: Custo Médio Ponderado**:
```
novo custo médio = (estoque atual × custo médio atual + quantidade comprada × valor unitário) / (estoque atual + quantidade comprada)
```

#### Interface
- Lista em tabela com busca por nome e filtro por categoria.
- Colunas: nome, categoria, estoque, custo médio, última compra, ações.

---

### Módulo 4: Componentes Semi-Acabados

#### Conceito
- Itens intermediários usados como "matéria-prima" de produtos finais.
- Exemplos: "Miolo A5 Costurado", "Capa Dura Revestida".

#### Composição
- Lista de insumos do Módulo 3 com quantidade exata.
- Tempo de máquina (seleciona ativo do Módulo 2).
- Tempo humano (seleciona perfil Operacional ou Criativo).

#### Cálculo
```
custo unitário = Σ(insumos × quantidade × custo médio)
               + (tempo máquina × custo/hora do ativo)
               + (tempo humano × valor hora)
```

#### Output
- Custo unitário do componente, usado no Módulo 5.

---

### Módulo 5: Produtos Finais

#### Montagem
- Seleção de componentes semi-acabados com quantidade.
- Embalagem: insumos avulsos do estoque.
- Acabamento: tempo humano final (montagem/limpeza) com perfil Operacional ou Criativo.

#### Precificação
- Exibição do custo total direto.
- Aplicação de margem de lucro (%).
- Seleção de marketplace configurado.
- Cálculo reverso de taxa de marketplace: usuário informa o valor líquido que quer receber, o sistema calcula o preço de venda.

#### Cálculo
```
custo direto = Σ(componentes × quantidade × custo unitário)
           + Σ(embalagens × quantidade × custo)
           + (tempo humano final × valor hora)

preço sem taxas = custo direto × (1 + margem de lucro / 100)

preço de venda = valor líquido desejado / (1 - taxa marketplace / 100)
```

#### Marketplaces (Configuração)
- Shopee: 20% + R$ 4,00
- Mercado Livre: 20%
- Nuvemshop: 1%
- O usuário pode adicionar, editar e excluir marketplaces.
- A opção "Sem plataforma" não é necessária, pois o sistema já exibe o "preço sem taxas".

---

## 5. Regras de Negócio Críticas

### Integridade Histórica (Snapshot)
- Ao criar um produto ou componente, o sistema salva uma "foto" dos custos daquela data.
- Alterações futuras no preço de insumos, horas de trabalho ou ativos não alteram automaticamente o custo de produtos já finalizados.

### Reavaliação
- O usuário pode solicitar uma reavaliação manual.
- Quando isso ocorre, a versão anterior é arquivada e uma nova versão é criada.

### Arquivamento de Versão Legado
- Versões anteriores de produtos e componentes são arquivadas.
- Deve haver uma tela separada para visualizar produtos arquivados.
- Versões arquivadas não são editáveis, apenas visualizáveis.

### Sincronização
- Sempre online.
- Suporte a leitura/escrita simultânea de até 3 dispositivos sem travamentos.
- Firestore com listeners em tempo real.

### UX/UI
- Interface limpa, minimalista, com paleta em tons pastel de rosa e amarelo.
- Sidebar fixa à esquerda com os módulos.
- Resultados claros e botões de ação simples.

---

## 6. Modelagem de Dados (Firestore)

### Coleções

#### `users`
- `uid`
- `email`
- `displayName`
- `photoURL`
- `createdAt`

#### `workspaces`
- `id`
- `name`
- `ownerId`
- `createdAt`
- `members` (subcoleção): `userId`, `role`, `joinedAt`

#### `settings` (por workspace)
- `workspaceId`
- `desiredSalary`
- `productiveHoursPerWeek`
- `hourlyOperational`
- `hourlyCreative`
- `electricityRate`
- `lightMaintenanceRate` (padrão 7%)
- `updatedAt`

#### `lightTools` (por workspace)
- `workspaceId`
- `name`
- `purchaseValue`
- `purchaseDate`
- `monthlyMaintenanceCost`
- `isActive`

#### `heavyAssets` (por workspace)
- `workspaceId`
- `name`
- `purchaseValue`
- `purchaseDate`
- `usefulLifeMonths`
- `powerWatts`
- `electricityRate`
- `depreciationPerHour`
- `energyCostPerHour`
- `totalCostPerHour`

#### `supplyCategories` (por workspace)
- `workspaceId`
- `name`
- `isDefault`
- `order`

#### `supplies` (por workspace)
- `workspaceId`
- `name`
- `unit`
- `categoryId`
- `currentStock`
- `averageCost`
- `totalStockValue`
- `isActive`

#### `supplyEntries` (por workspace)
- `workspaceId`
- `supplyId`
- `quantity`
- `totalValue`
- `unitCost`
- `date`
- `note`

#### `marketplaces` (por workspace)
- `workspaceId`
- `name`
- `feePercentage`
- `fixedFee` (opcional)
- `isDefault`

#### `semiFinishedComponents` (por workspace)
- `workspaceId`
- `name`
- `supplies`: array de `{supplyId, quantity, unitCostSnapshot}`
- `machineTimeHours`
- `machineAssetId`
- `humanTimeHours`
- `humanProfile`: `"operational"` | `"creative"`
- `unitCost`
- `version`
- `isArchived`

#### `products` (por workspace)
- `workspaceId`
- `name`
- `components`: array de `{componentId, quantity, unitCostSnapshot}`
- `packaging`: array de `{supplyId, quantity, unitCostSnapshot}`
- `finalHumanTimeHours`
- `finalHumanProfile`: `"operational"` | `"creative"`
- `directCost`
- `profitMargin`
- `marketplaceId`
- `desiredNetValue`
- `salePrice`
- `version`
- `isArchived`

---

## 7. Fluxo de Telas

```
Login com Google
  └── Criar workspace
        └── Convidar membros
              └── Dashboard
                    ├── Configurações
                    │   ├── Perfil financeiro
                    │   ├── Custos ocultos
                    │   └── Marketplaces
                    ├── Materiais Leves
                    │   ├── Lista com busca
                    │   └── Cadastro/Edição
                    ├── Ativos Pesados
                    │   ├── Lista com busca
                    │   └── Cadastro/Edição
                    ├── Insumos
                    │   ├── Lista com busca/filtro
                    │   ├── Cadastro/Edição
                    │   └── Entradas de estoque
                    ├── Componentes
                    │   ├── Lista
                    │   └── Composição
                    └── Produtos
                          ├── Lista (ativos)
                          ├── Produtos arquivados
                          └── Detalhe do produto
```

---

## 8. Decisões de UX/UI

- **Paleta**: tons pastel de rosa e amarelo.
- **Sidebar**: fixa, à esquerda, sem opção de recolher.
- **Listagens**: preferencialmente em tabela, com busca e filtros.
- **Cards**: usados para componentes e produtos finais na listagem.
- **Detalhe do produto**: layout em duas colunas (composição à esquerda, precificação à direita).
- **Preço sem taxas**: nomenclatura mantida para indicar o preço mínimo de venda fora das plataformas.
- **Marketplaces**: cards editáveis na tela de configurações.
- **Produtos arquivados**: tela separada, acessada por botão ao lado de "Novo produto".

---

## 9. Escopo Inicial (MVP) vs Futuro

### Escopo Inicial (MVP)
- Autenticação Google.
- Criação de workspace e convite de membros (todos administradores).
- Configurações globais (calculadora de hora, taxa de manutenção leve, tarifa de energia).
- Cadastro de marketplaces.
- Materiais leves.
- Ativos pesados.
- Insumos com entradas de estoque e custo médio ponderado.
- Componentes semi-acabados.
- Produtos finais com precificação.
- Arquivamento de versões.

### Futuro
- Múltiplos perfis de permissão (owner, administrador, editor, visualizador).
- Relatórios de estoque baixo, custos mensais, produtos mais vendidos.
- Exportação de relatórios para PDF/Excel/Google Drive.
- Dashboard com indicadores financeiros.
- Fotos de produtos e anexos.
- Múltiplas unidades de medida com conversão automática.

---

## 10. Decisões Ajustadas ao Longo das Conversas

| Tema | Decisão Final |
|---|---|
| Valor fixo vs % para manutenção leve | Abordagem híbrida: cadastrar materiais leves individualmente e aplicar % editável sobre o valor. |
| Limite de valor para materiais leves | Até R$ 500,00. Acima disso, ativos pesados. |
| Sincronização | Sempre online, sem offline-first. |
| Autenticação | Google Sign-In. |
| Banco de dados | Firebase Firestore. Google Drive não será usado como banco. |
| Cálculo de energia | Campo editável, pode ficar em branco. |
| Plataformas | Configuráveis, com cálculo reverso de taxa. Sem opção "Sem plataforma". |
| Permissões | Todos administradores no MVP. |
| Produtos arquivados | Tela separada, botão ao lado de "Novo produto". |

---

## 11. Informações Técnicas para Desenvolvimento

### Comandos sugeridos para iniciar
```bash
npm create vite@latest precificador -- --template react-ts
cd precificador
npm install
npm install tailwindcss postcss autoprefixer -D
npx tailwindcss init -p
npm install firebase zustand react-hook-form zod @hookform/resolvers
npm install -D @types/node
```

### Estrutura de pastas sugerida
```
src/
├── components/
├── pages/
├── hooks/
├── services/
│   └── firebase.ts
├── stores/
├── types/
├── utils/
│   └── calculations.ts
└── App.tsx
```

### Bibliotecas principais
- `firebase`: autenticação e banco de dados.
- `zustand`: gerenciamento de estado global.
- `react-hook-form`: formulários.
- `zod`: validação de schemas.

---

## 12. Perguntas Abertas para Próximas Etapas

1. Nome final do app (atualmente chamado de "Precificador" no protótipo).
2. O usuário deseja algum logotipo ou identidade visual específica?
3. Haverá necessidade de importar dados iniciais (planilha) ou começa do zero?
4. O app será PWA (instalável no celular) ou apenas web?

---

**Documento gerado em:** 17/07/2026
**Status:** Requisitos fechados, aguardando início do desenvolvimento.
