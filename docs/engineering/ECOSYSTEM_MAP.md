# Mapa da Engenharia do Ecossistema 3eatcru OS

Documento mestre de arquitetura, mapeamento estrutural e inventário de contratos das 8 camadas de software que compõem o ecossistema empresarial **3eatcru OS**.

---

## 1. Visão Geral das 8 Camadas Arquiteturais

| Camada | Identificador | Escopo Principal | Estado Arquitetural |
| :--- | :--- | :--- | :--- |
| **A** | **Infraestrutura e Plataforma** | Node.js, Express 5, `node:sqlite`, Drizzle ORM, Criptografia AES-256-GCM, Migrações, Backup/Restore | **IMPLEMENTADO E VALIDADO** |
| **B** | **HQ / Central de Controle** | Gestão de empresas, provisionamento, auditoria, cotas, releases de SO, controle de versões | **IMPLEMENTADO E VALIDADO** |
| **C** | **Empresa e Organização** | Ciclo de vida da empresa, isolamento de inquilinos (multi-tenancy), filial, limites e bloqueio | **IMPLEMENTADO E VALIDADO** |
| **D** | **Identidade, Usuários e Autorização** | Três planos de autenticação (`HQ`, `COMPANY`, `CUSTOMER`), JWTs criptografados, MFA, RBAC estrito | **IMPLEMENTADO E VALIDADO** |
| **E** | **Aplicações Empresariais e Módulos OS** | PDV, Caixa, Mesas, KDS, Inventário Perpétuo, Contas a Pagar/Receber, Terminal de Impressão | **IMPLEMENTADO E VALIDADO** |
| **F** | **Clientes e Espaço Público** | Marketplace Londrina, Vitrine Pública, 3eatcru ID, Pedidos Online sem vazamento de dados internos | **IMPLEMENTADO E VALIDADO** |
| **G** | **Integrações e Serviços Externos** | Webhooks WhatsApp, integração iFood, conciliação Pix/Cartão, impressoras térmicas ESC/POS | **IMPLEMENTADO MAS NÃO VALIDADO** (simulado com contratos explícitos) |
| **H** | **Dispositivos e Operação Offline** | Persistência IndexedDB, fila de eventos idempotente, reconciliação sem duplicação de caixa | **IMPLEMENTADO E VALIDADO** |

---

## 2. Detalhamento por Camada

### Camada A — Infraestrutura e Plataforma
- **Responsabilidade**: Garantir fundação persistente, idempotente, segura e de alta performance para todas as camadas.
- **Componentes Principais**:
  - `src/server/db/central-db.ts`: Driver SQLite nativo (`node:sqlite`) com suporte a WAL mode, foreign keys forçadas e transações atômicas.
  - `src/server/db/schema.ts`: Esquemas canônicos Drizzle para empresas, usuários, produtos, pedidos, logs de auditoria, vendas e razão financeiro.
  - `src/server/config.ts`: Gerenciamento de segredos (`JWT_SECRET`, `MFA_ENCRYPTION_KEY`), validação de variáveis de ambiente com defaults seguros para dev.
  - `src/server/middleware.ts`: Sanitização de payload, CORS restrito, rate limiting por IP/tenant e log de auditoria operacional.
- **Garantias de Persistência**: Escrita síncrona com journaling WAL; integridade referencial com bloqueio em cascata.
- **Ponto Único de Falha (SPOF)**: Arquivo SQLite único no disco do servidor. *Mitigação*: backup snapshots automáticos e exportação periódica.

---

### Camada B — HQ / Central de Controle
- **Responsabilidade**: Governança global, provisionamento de novas empresas, auditoria fiscal/técnica, gestão de releases do SO e controle de inadimplência.
- **Componentes Principais**:
  - `src/server/routes/hq-apps.ts`: Endpoints protegidos `/api/v1/hq/*` restritos exclusivamente ao plano de autorização `HQ`.
  - `src/app/ui/hq-os/hq-os-shell.component.ts`: Shell visual para administradores da plataforma com módulos de Dashboard, Tenants, Billing, Dev Hub e Telemetria.
  - `src/app/ui/hq-os/apps/tenants/tenants.component.ts`: Painel de auditoria, suspensão, ativação e alteração de cotas de empresas.
- **Fronteira de Confiança**: Nenhuma credencial de operador de loja ou cliente pode acessar a camada B. Qualquer token fora do plano `HQ` recebe `403 Forbidden`.

---

### Camada C — Empresa e Organização
- **Responsabilidade**: Representar a pessoa jurídica/estabelecimento comercial com isolamento hermético de dados, configurações e ciclo de vida.
- **Componentes Principais**:
  - `src/server/routes/companies.ts`: CRUD de empresas, dados cadastrais, filiais e parâmetros tributários/operacionais.
  - `src/app/core/domain/company/company.entity.ts`: Entidade canônica da empresa.
- **Regras de Isolamento**:
  - Toda consulta a tabelas relacionais (`products`, `sales`, `tables`, `orders`, `customers`) é filtrada obrigatoriamente por `companyId`.
  - Tentativa de acesso cruzado (ex: Empresa A tentando consultar mesa ou produto da Empresa B) resulta em `403 Forbidden` ou `404 Not Found`.
  - Empresa com status `SUSPENDED` é bloqueada imediatamente no middleware central de autorização, impedindo novas vendas e sincronizações.

---

### Camada D — Identidade, Usuários e Autorização
- **Responsabilidade**: Garantir que cada ator opere estritamente dentro do seu papel e plano de autorização sem cruzamento de privilégios.
- **Três Planos Canônicos de Identidade**:
  1. `HQ`: Administradores e auditores globais da infraestrutura.
  2. `COMPANY`: Proprietários (`ADMIN`), gerentes (`MANAGER`), operadores de caixa (`CASHIER`) e garçons (`WAITER`).
  3. `CUSTOMER`: Consumidores finais autenticados via 3eatcru ID (`customerRouter`).
- **Componentes Principais**:
  - `src/server/routes/auth.ts`: Emissão e renovação de tokens JWT contendo `authPlane`, `companyId` e `role`.
  - `src/app/core/identity/identity.service.ts`: Gerenciamento do estado da sessão do operador no Angular.
  - `src/app/core/identity/customer-identity.service.ts`: Sessão isolada do cliente no marketplace e pedidos públicos.

---

### Camada E — Aplicações Empresariais e Módulos OS
- **Responsabilidade**: Execução do fluxo de trabalho diário do negócio, incluindo vendas, comandas, cozinha, estoque e conciliação de pagamentos.
- **Módulos Disponíveis**:
  - **PDV (Ponto de Venda)**: Carrinho de compras, cálculo de descontos, finalização com múltiplos meios de pagamento.
  - **Mesas & Comandas**: Ocupação de mesas, transferência de itens, divisão de contas (`table-split-modal`).
  - **KDS (Kitchen Display System)**: Roteamento de pedidos para a cozinha em tempo real com estados `PENDING`, `PREPARING`, `READY`, `DELIVERED`.
  - **Inventário Perpétuo**: Registro contínuo de entradas e saídas no livro-razão (`inventory-ledger.component.ts`), com baixa automática pós-venda.
  - **Financeiro & Caixa**: Abertura e fechamento de turnos de caixa, suprimentos, sangrias e relatório DRE simplificado.
- **Tema Visual DEsk**: Estética física skeuomórfica (nogueira escura, latão, papel manila) ou tema padrão BigLinux/KDE selecionável pelo operador.

---

### Camada F — Clientes e Espaço Público
- **Responsabilidade**: Exposição segura do catálogo público para pedidos online e descoberta no Marketplace regional de Londrina.
- **Componentes Principais**:
  - `src/server/routes/public-space.ts`: Rota aberta para consulta de cardápios e envio de pedidos.
  - `src/app/ui/public-space/public-space.component.ts`: Vitrine pública da empresa com suporte a template Restaurante e Varejo.
  - `src/app/ui/marketplace/marketplace.component.ts`: Portal de descoberta agregando lojas por geolocalização e categoria.
- **Barreira de Privacidade**:
  - Dados sensíveis internos (custo de mercadoria vendida, margem de lucro, fornecedor, quantidade exata em estoque, histórico de sangrias) são terminantemente excluídos dos retornos públicos.

---

### Camada G — Integrações e Serviços Externos
- **Responsabilidade**: Comunicação com plataformas de mensageria, delivery externo e hardware local.
- **Componentes e Estado**:
  - **WhatsApp**: Simulador de mensagens e alertas com webhooks configuráveis (`/src/app/apps/whatsapp`).
  - **iFood**: Sincronização de pedidos e status da loja simulado com barramento de eventos (`/src/app/apps/ifood`).
  - **Impressão ESC/POS**: Bridge de hardware para impressoras de recibos térmicas via WebUSB ou IP Socket (`printer.service.ts`).

---

### Camada H — Dispositivos e Operação Offline
- **Responsabilidade**: Garantir que as lojas continuem vendendo e emitindo cupons mesmo quando a conectividade com a internet for interrompida.
- **Componentes Principais**:
  - `src/app/core/storage/adapters/indexeddb-database.adapter.ts`: Armazenamento de catálogo, mesas e vendas em banco local do navegador.
  - `src/app/core/sync/sync.service.ts`: Fila de sincronização com reconciliação idempotente via UUID de transação.
  - `src/server/routes/sync.ts`: Endpoint `/api/v1/sync` que processa lotes e descarta duplicatas garantindo que a mesma venda nunca seja computada duas vezes no caixa ou estoque.

---

## 3. Diagramas de Arquitetura e Fluxo

### 3.1. Arquitetura de Comunicação e Fronteiras de Confiança

```
[ NAVEGADOR DO CLIENTE ]             [ TERMINAL DA LOJA (PDV / OS) ]         [ SUPERADMIN HQ ]
          │                                         │                                │
          │ (JWT Cliente / Público)                 │ (JWT Operador da Empresa)      │ (JWT Superadmin HQ)
          ▼                                         ▼                                ▼
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│                                SERVIDOR EXPRESS (Borda API)                                │
│                                                                                            │
│   Middleware: Rate Limiting · Sanitização · Validação de JWT e RBAC · Auditoria Operacional │
├───────────────────────────────┬───────────────────────────────┬────────────────────────────┤
│   ROTAS PÚBLICAS (/public/*)  │  ROTAS OPERACIONAIS (/api/*)  │   ROTAS HQ (/api/hq/*)     │
│   - Catálogo Sanitizado       │  - PDV e Vendas               │   - Provisionamento        │
│   - Envio de Pedido Online    │  - Mesas & KDS                │   - Ajuste de Limites      │
│   - 3eatcru ID                │  - Estoque Perpétuo           │   - Telemetria de Inquilino│
│                               │  - Sincronização Offline      │   - Auditoria Fiscal       │
└───────────────────────────────┴───────────────┬───────────────┴────────────────────────────┘
                                                │
                                                ▼
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│                        BANCO DE DADOS CENTRAL (SQLite + Drizzle ORM)                       │
│                                                                                            │
│  Tabelas Inquilinas: companies, company_users, products, sales, tables, inventory_ledger    │
│  Tabelas de Borda: public_spaces, customer_accounts, orders, idempotency_log               │
│  Tabelas HQ: hq_audit_logs, company_ledger (billing)                                       │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.2. Fluxo Sequencial de Venda Offline com Reconciliação Idempotente

```
Terminal PDV                  IndexedDB Local               Servidor Central (Sync)       Estoque & Caixa
     │                               │                                 │                         │
     │ 1. Cria Venda (Offline)       │                                 │                         │
     ├──────────────────────────────>│                                 │                         │
     │    Grava com UUID fixo        │                                 │                         │
     │                               │                                 │                         │
     │ 2. Internet restabelecida     │                                 │                         │
     ├──────────────────────────────>│                                 │                         │
     │    Lê lote pendente           │                                 │                         │
     │                               │                                 │                         │
     │ 3. Envia lote de sync         │                                 │                         │
     ├────────────────────────────────────────────────────────────────>│                         │
     │    POST /api/v1/sync          │                                 │                         │
     │                               │                                 │ 4. Verifica UUID no     │
     │                               │                                 │    idempotency_log      │
     │                               │                                 ├────────────────────────>│
     │                               │                                 │    (Novo registro)      │
     │                               │                                 │ 5. Grava venda e        │
     │                               │                                 │    debita estoque       │
     │                               │                                 ├────────────────────────>│
     │                               │                                 │                         │
     │ 6. Reenvio acidental (Retry)  │                                 │                         │
     ├────────────────────────────────────────────────────────────────>│                         │
     │    POST /api/v1/sync          │                                 │ 7. UUID já registrado!  │
     │                               │                                 ├────────────────────────>│
     │                               │                                 │    Ignora efeito colat. │
     │ 8. Status: 200 OK             │                                 │    Retorna sucesso      │
     │<────────────────────────────────────────────────────────────────┤                         │
```

---

## 4. Contratos Canônicos Entre Camadas

| Contrato | Camada Origem | Camada Destino | Invariantes e Regras de Validação | Tratamento de Erro |
| :--- | :--- | :--- | :--- | :--- |
| **AUTH-JWT** | D | A, B, C, E, F | O token JWT deve conter `authPlane`, `userId`, `role` e `companyId` (quando aplicável). Assinatura verificada em todas as requisições privadas. | `401 Unauthorized` |
| **TENANT-ISOLATION** | C | E, F | Nenhuma rota de consulta ou mutação pode operar sem o `companyId` validado no token. Queries ao SQLite obrigatoriamente incluem cláusula `WHERE company_id = ?`. | `403 Forbidden` |
| **HQ-GOVERNANCE** | B | C, D | Apenas tokens do plano `HQ` têm autorização para criar empresas, mudar status de inadimplência ou ajustar limites de crédito. | `403 Forbidden` |
| **PUBLIC-CATALOG** | E | F | O catálogo público nunca expõe campos sensíveis (`costPrice`, `supplier`, `stockQuantity`, `internalNotes`). | Sanitização automática no DTO |
| **OFFLINE-IDEMPOTENCY**| H | A, E | O `transactionId` único é armazenado na tabela `idempotency_log`. Múltiplos envios do mesmo payload não duplicam lançamentos financeiros. | `200 OK` (descarte idempotente) |

---

## 5. Pontos Únicos de Falha (SPOF) e Estratégia de Mitigação

1. **Arquivo do Banco SQLite Central**:
   - *Risco*: Corrupção de arquivo por encerramento abrupto do processo Node.js.
   - *Mitigação*: WAL mode ativado por padrão (`PRAGMA journal_mode=WAL`), transações atômicas com `BEGIN IMMEDIATE` e backups automáticos.
2. **Queda de Conexão na Loja**:
   - *Risco*: Interrupção de atendimento ao cliente durante a venda.
   - *Mitigação*: Arquitetura offline-first completa no cliente via IndexedDB, garantindo operação contínua de caixa e sincronização em segundo plano.
3. **Evasão de Limite de Crédito / Tenant Suspenso**:
   - *Risco*: Loja continuar emitindo ordens após suspensão pela HQ.
   - *Mitigação*: Middleware de checagem do status da empresa com bloqueio em tempo real (`company.status === 'ACTIVE'`).
