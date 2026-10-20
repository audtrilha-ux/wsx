# Simulador de Ecossistema Ponta a Ponta & Resolução de Erros — 3eatcru Business OS

Plano arquitetural e operacional para criação de um motor de simulação automatizado de ponta a ponta com interface de controle interativa no OS, provisionamento de empresas nos perfis de Varejo e Restaurante, povoamento e ajustes de estoque, liquidação de vendas no PDV e Mesas/KDS, conciliação financeira e garantia de zero erros no ecossistema.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> As preferências para a simulação foram confirmadas pelo usuário na Fase de Alinhamento:
> - **Tipo de Simulador**: Simulador de sandbox automatizado ponta a ponta com controles visuais na interface do sistema.
> - **Perfis das Empresas**: Perfis duplos representativos — **Varejo** (foco em códigos de barra, matriz/filial e estoque) e **Restaurante** (foco em mesas, comandas, cozinha KDS e delivery).
> - **Gestão da Base de Dados**: Limpeza segura e re-inicialização transacional da base SQLite com preservação da estrutura de tabelas e aplicação de sementes limpas para a execução da simulação.

---

## 1. Overview & Core Concept

### O que o Simulador Faz
O **Motor de Simulação do Ecossistema 3eatcru OS** fornece uma bancada de testes viva e auditável para testar e validar em tempo real todos os fluxos críticos do ecossistema corporativo:
1. **Reset & Clean Boot**: Reinicialização segura da base central SQLite, garantindo integridade de foreign keys, WAL journal e migrações.
2. **Criação & Provisionamento de Empresas**:
   - *Empresa Varejo*: "Londrina Confecções & Varejo" (Plano Pro, 3 filiais, matriz com PDV rápido, conferência de código de barras).
   - *Empresa Restaurante*: "Trattoria & Bistrô Londrina" (Plano Pro, gestão de salão com 12 mesas, integração KDS, comanda digital).
3. **Povoamento e Modificação de Estoque**:
   - Criação de catálogo mestre com preços de custo, venda, código de barras e estoque inicial.
   - Ajustes de inventário (entradas de reposição, saídas por avaria/perda e conferência física).
   - Registro imutável de movimentações no Livro-Razão de Estoque (`stock_movements` / `inventory-ledger`).
4. **Ciclo Completo de Vendas & Liquidação**:
   - Vendas de balcão via PDV com múltiplos métodos de pagamento (PIX, Dinheiro, Cartão).
   - Dedução atômica de estoque com verificação rigorosa da regra de bloqueio de estoque negativo.
   - Emissão de comprovante térmico e crédito automático de pontos de fidelidade no CRM.
   - Abertura de mesa, pedidos na comanda, roteamento automático para o KDS e fechamento de conta.
   - Geração automática de transações financeiras no fluxo de caixa (`finance_transactions`).
   - Disparo simulado de notificações omnichannel (WhatsApp e Telegram).
5. **Auditoria e Detecção de Falhas**: Exibição transparente de cada etapa, tempo de execução, diffs de estado e status de integridade (pass/fail).

---

## 2. User Experience & Visual Design

### Fluxo do Usuário na Interface
1. **Acesso aos Controles de Simulação**: O usuário abre o aplicativo de **Diagnóstico & Central de Simulação** (ou Hub de Desenvolvimento) na área de trabalho física do OS.
2. **Painel de Controle de Cenários**:
   - Botão primário com visual de latão prensado: **"Executar Simulação Completa (1-Clique)"**.
   - Controles segmentados modulares:
     - `01. Reset da Base SQLite`
     - `02. Provisionar Empresas (Varejo + Restaurante)`
     - `03. Povoar & Ajustar Estoque`
     - `04. Executar Vendas (PDV & Mesas/KDS)`
     - `05. Conciliação Financeira & CRM`
3. **Console de Telemetria Visual (DEsk Physical Aesthetic)**:
   - Papel timbrado texturizado com tipografia tabular (`tabular-nums font-mono`).
   - Sem badges em pílulas estáticas (disciplina Zero-Pill): separadores tipográficos limpos (`·`, `/`).
   - Indicadores de progresso com latência $\le 200\text{ms}$ e microinterações táteis.
   - Estatísticas em tempo real: saldo em caixa gerado, itens decrementados no estoque, pedidos entregues na cozinha e pontos computados no CRM.

---

## 3. Key Product Decisions & Trade-Offs

### Decisão 1: Rota de Simulação Transacional no Servidor vs. Execução Apenas no Cliente
- **Abordagem Escolhida**: Implementar endpoint dedicado `/api/v1/simulation/run` e submódulos acionáveis via Express/SQLite, integrando diretamente com as regras canônicas de `onboarding.ts`, `sync.ts` e `central-db.ts`.
- **Por quê**: Vendas, estoque e controle de idempotência operam sob autoridade estrita do servidor e do SQLite transacional. Executar no servidor assegura que as mesmas restrições de concorrência e integridade que regem o sistema real sejam testadas.
- **Alternativa Descartada**: Simulação puramente em memória no frontend, pois mascararia falhas de banco de dados e transações reais.

### Decisão 2: Preservação de Isolamento Multi-Tenant na Simulação
- **Abordagem Escolhida**: As duas empresas simuladas operam em tenants completamente independentes (`comp_sim_retail` e `comp_sim_restaurant`), validando a proteção contra vazamento de dados (cross-tenant leakage).
- **Por quê**: Garante que uma venda na Trattoria nunca altere o estoque ou o caixa da Confecção.

---

## 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          3EATCRU BUSINESS OS UI                             │
│  ┌────────────────────────┐  ┌────────────────────┐  ┌───────────────────┐  │
│  │  Simulador de Sandbox  │  │   PDV & Estoque    │  │  Salão, Mesas     │  │
│  │ (Controles Interativos)│  │ (Varejo Londrina)  │  │ & KDS (Trattoria) │  │
│  └───────────┬────────────┘  └─────────┬──────────┘  └─────────┬─────────┘  │
└──────────────┼─────────────────────────┼───────────────────────┼────────────┘
               │ HTTP / WebSocket        │ Sync Batch API        │ Sync Batch
               ▼                         ▼                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EXPRESS KERNEL & ROUTES                           │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ /api/v1/simulation (run, reset, step, verify)                         │  │
│  ├───────────────────────────────────┬───────────────────────────────────┤  │
│  │ /api/v1/sync/batch                │ /api/v1/onboarding/provision      │  │
│  └───────────────────────────────────┴───────────────────────────────────┘  │
│                                      │                                      │
│                                      ▼                                      │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                      CENTRAL DATABASE ENGINE (ACID)                   │  │
│  │ ┌───────────────────────────────────────────────────────────────────┐ │  │
│  │ │ SQLite (WAL Mode, Foreign Keys, Atomic Provisioning)              │ │  │
│  │ │ Tables: companies, products, sales, finance_tx, tables, crm       │ │  │
│  │ └───────────────────────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Sequência Operacional da Simulação
1. **Passo 1 — Reset Seguro**: Executa transação de limpeza das tabelas operacionais e recria os esquemas necessários mantendo os planos corporativos ativos.
2. **Passo 2 — Criação de Empresas**:
   - Criação da empresa `Londrina Moda & Varejo` com usuário administrador e matriz.
   - Criação da empresa `Bistrô & Trattoria Londrina` com usuário administrador e matriz.
3. **Passo 3 — Povoamento de Estoque**:
   - Inserção de 8 produtos de varejo com EAN, estoque inicial (ex: 50 un) e valor unitário.
   - Inserção de 8 pratos/bebidas de restaurante com estoque e vinculação de insumos.
   - Execução de 2 ajustes manuais de estoque (1 entrada de reposição de 20 un e 1 saída por avaria de 2 un).
4. **Passo 4 — Ciclo de Vendas no Varejo**:
   - Venda no PDV de 3 camisas polo e 2 calças jeans pagas em PIX.
   - Verificação automática da baixa de estoque e entrada financeira.
   - Acúmulo de pontos fidelidade para cliente Londrina VIP.
5. **Passo 5 — Ciclo de Pedidos e Mesas no Restaurante**:
   - Abertura da Mesa 04 com 2 clientes.
   - Lançamento de pedido (2x Risotto de Cogumelos, 2x Taça de Vinho).
   - Envio do pedido para o KDS (status: PREPARING -> READY -> SERVED).
   - Fechamento da mesa com pagamento dividido em Cartão de Crédito.
   - Registro de transação financeira e liberação da mesa.
6. **Passo 6 — Verificação e Testes Automatizados**:
   - Criação do teste de ponta a ponta `src/server/db/ecosystem-simulation-e2e.spec.ts` validando todas as asserções no Vitest.
   - Verificação de compilação geral do aplicativo sem erros.

---

## 5. Próximos Passos Imediatos após Aprovação
1. Criar o roteador de simulação no servidor `/src/server/routes/simulation.ts` e registrar no `server.ts`.
2. Criar a interface de simulação com controles visuais reativos integrada ao OS.
3. Implementar a suíte de testes `src/server/db/ecosystem-simulation-e2e.spec.ts`.
4. Executar os testes no Vitest e compilar a aplicação com `compile_applet` para validação final.
