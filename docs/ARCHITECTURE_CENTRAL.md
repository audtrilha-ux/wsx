# 🏛️ Documento de Arquitetura: 3EATCRU HQ OS (Control Plane)
**Sistema Operacional Administrativo e Central de Governança de Ecossistema SaaS Multi-Tenant**

---

## 1. Declaração Fundamental de Propósito e Limites

O **3EATCRU HQ OS** é o sistema operacional administrativo da plataforma (Control Plane / SaaS Backoffice). Ele atua como um OS próprio e independente da operação do cliente, responsável exclusivamente pela **governança, telemetria, licenciamento e gestão do ecossistema multi-tenant**. O ecossistema opera numa arquitetura **Dual-OS**:

1. **3EATCRU HQ OS (Control Plane)**: Controla o ecossistema (empresas, contas, licenças, planos, apps, versões, desenvolvedores, billing, monitoramento, políticas).
2. **3EATCRU OS (Client/Runtime Plane)**: Executa o ecossistema local (apps, dados, dispositivos, operações, PDV, estoque, CRM, financeiro, impressão, offline). A Central faz a ponte entre eles.

> ### ⚠️ Regra Cardeal de Autoridade
> **O HQ OS gerencia Empresas (Tenants), Usuários da Plataforma, Módulos e o Ecossistema Global.**
> **O HQ OS ESTRITAMENTE NÃO é um sistema voltado para clientes finais (consumidores de balcão) e NÃO opera fluxos comerciais locais.**

---

## 2. Escopo Funcional Exclusivo do HQ OS

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                            3EATCRU HQ OS                                    │
│                  Control Plane & Ecossistema de Plataforma                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [1] IAM & Tenants         [2] Licenças & Billing     [3] Telemetria Global │
│  - Empresas (Workspaces)   - Saldos corporativos      - Logs de subsistemas │
│  - Usuários da plataforma  - Cobrança recorrente      - Saúde de terminais  │
│  - Bloqueio / Suspensão    - Débito por módulos       - Conformidade OS     │
│                                                                             │
│  [4] Catálogo de Módulos   [5] Marketplace Central    [6] Developer Hub     │
│  - Publicação de Apps      - Indexação geográfica     - Sandbox REST API    │
│  - Precificação de Apps    - Descoberta pública       - Webhook Simulator   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1. IAM & Governança de Tenants (Identity and Access Management)
- **Provisionamento de Tenants**: Criação de novas instâncias corporativas (empresas), definição de parâmetros contratuais e saldo inicial de ativação.
- **Usuários da Plataforma**: Gerenciamento de credenciais de administradores de sistema, desenvolvedores e operadores de plataforma (`HQ Identity`).
- **Controle de Soberania e Suspensão**: Autoridade para ativar, bloquear ou suspender empresas inadimplentes ou fora de conformidade.

### 2. Licenciamento & Motor de Cobrança (SaaS Billing Engine)
- **Créditos Corporativos & Livro-Razão Duplo (Double-Entry Ledger Loop)**: Toda movimentação financeira e de faturamento exige um registro simétrico de crédito e débito no Livro-Razão do Tenant (`CompanyLedgerEntry`). O aporte financeiro (depósito via Pix/Cartão) gera um lançamento do tipo `CREDIT_ADDED` e incrementa o saldo pré-pago. A quitação de uma fatura pendente gera um lançamento do tipo `PLAN_CHARGE` (Débito) e prorroga a licença por mais 30 dias.
- **Isolamento de Saldo Pré-Pago (Prepaid-Only State Isolation)**: O ciclo recorrente de faturamento não cria saldos fictícios negativos. Caso o tenant não possua saldo disponível para o custo total dos aplicativos instalados, a fatura é emitida com o status `PENDING` (Pendente). A suspensão operacional ocorre de forma determinística quando o prazo de expiração da licença do tenant é alcançado (`licenseExpiresAt` vencido), transicionando o status do tenant de `active` para `suspended`.
- **Faturamento Recorrente Autônomo**: Execução periódica de ciclos de faturamento proporcional ao custo total dos módulos instalados por cada tenant, liquidando de forma automatizada faturas pendentes assim que novos aportes são confirmados no gateway de faturamento.
- **Arquitetura de API de Alto Volume (Paginated Collections)**: Endpoints críticos que retornam dados volumosos (Vendas, Clientes, Produtos, Faturas de Plataforma, Faturas de Workspace, Livro-Razão e Auditoria HQ) possuem paginação física nativa via parâmetros `page` e `pageSize`. A paginação opera em envelope seguro (`{ items, total, page, pageSize, totalPages }`) enquanto mantém retrocompatibilidade transparente (retorna array plano se as chaves não forem providas).

### 3. Telemetria de Plataforma & Monitoramento de Saúde (Health & Telemetry)
- **Coleta de Sinais Remotos**: Recepção assíncrona de relatórios de integridade enviados pelo subsistema `DiagnosticsService` de cada terminal OS.
- **Dashboard Global de Saúde**: Monitoramento em tempo real de subsistemas vitais (Core OS, Comunicação de Rede, Storage Local, Periféricos de Impressão).
- **Rastreabilidade e Auditoria**: Registro centralizado de eventos operacionais críticos e diagnósticos de falha.

### 4. Governança da Loja de Módulos (App Store Management)
- **Catálogo Oficial**: Publicação, versionamento, precificação mensal e descontinuação de aplicativos e extensões da plataforma.
- **Políticas de Instalação**: Regras de compatibilidade entre versões de Core OS e manifests de aplicativos.

### 5. Marketplace de Descoberta Pública (Central Discovery Engine)
- **Indexador Central**: Leitura consolidada dos metadados públicos publicados pelos tenants através do `Public Space`.
- **Motor de Busca e Georreferenciamento**: Busca por proximidade (fórmula de Haversine), segmentos (Restaurantes, Varejo, Serviços) e recursos (Delivery, Retirada, Agendamento).
- **Isolamento Total**: O marketplace expõe unicamente informações públicas permitidas pela empresa, sem qualquer acesso a dados transacionais confidenciais.

### 6. Hub do Desenvolvedor & Barramento de APIs (Dev Hub)
- **Console Interativa REST**: Ambiente de documentação e teste ao vivo para integração com a API Central (`/api/v1/`).
- **Simulador de Webhooks**: Disparador de eventos de barramento para teste de integrações de terceiros e hardware especializado.

---

## 3. O que o HQ OS ESTRITAMENTE NÃO FAZ (Anti-Padrões Proibidos)

| O que Pertence ao HQ OS | O que NÃO Pertence ao HQ OS (Pertence ao Client OS / Apps) |
| :--- | :--- |
| Gerenciar **Empresas (Tenants)** | Cadastrar ou gerenciar **Clientes Finais / Consumidores** (Pertence ao CRM/Client OS) |
| Controlar **Saldos de Licença SaaS** | Controlar **Caixa Local, Troco e Sangria** (Pertence ao PDV/Client OS) |
| Distribuir **Módulos no Catálogo** | Executar **Lógicas de Negócio Especializadas** (Comandas, Mesas, Grades) |
| Monitorar **Telemetria de Terminais** | Controlar **Drivers Físicos de Hardware** (Pertence ao `HardwareService` do Client OS) |
| Indexar **Metadados Públicos** | Armazenar **Dados Transacionais Locais** (Pertence ao `StorageService` do Client OS) |

---

## 4. Matriz de Separação de Responsabilidades (RACI)

```text
┌────────────────────────┬─────────────┬─────────────┬─────────────┬──────────────┐
│ Responsabilidade       │ HQ OS       │ Client OS   │ Apps (PDV/  │ Public Space │
│                        │ (Plataforma)│ (Terminal)  │ CRM/Estoque)│ (Vitrine)    │
├────────────────────────┼─────────────┼─────────────┼─────────────┼──────────────┤
│ Governança de Tenants  │  RESPONSÁVEL│  Consome    │  Ignora     │  Ignora      │
│ Faturamento de Módulos │  RESPONSÁVEL│  Consome    │  Ignora     │  Ignora      │
│ Telemetria Global      │  RESPONSÁVEL│  Envia      │  Ignora     │  Ignora      │
│ Clientes de Balcão     │  PROIBIDO   │  Fornece VM │  RESPONSÁVEL│  Ignora      │
│ Fechamento de Vendas   │  PROIBIDO   │  Fornece VM │  RESPONSÁVEL│  Ignora      │
│ Impressão de Cupons    │  PROIBIDO   │  RESPONSÁVEL│  Aciona     │  Ignora      │
│ Exibição Pública Web   │  Indexa     │  Configura  │  Ignora     │  RESPONSÁVEL │
└────────────────────────┴─────────────┴─────────────┴─────────────┴──────────────┘
```

---

## 5. Separação Estrita de Identidade (Dual-OS Identity)

1. **HQ OS Identity (`Central Admin / Developer`)**:
   - Autentica exclusivamente no portal do HQ OS (`/hq`).
   - Gerencia tenants, módulos, licenças e telemetria.
   - Nunca tem sessão aberta dentro do desktop de um cliente no Client OS.

2. **Client OS Identity (`Tenant Admin / Gerente / Operador`)**:
   - Autentica no terminal operacional da empresa (Client OS).
   - Opera os aplicativos de negócio instalados (PDV, Estoque, CRM, Configurações).
   - Não possui privilégios para alterar preços globais de módulos ou criar outras empresas no HQ OS.

3. **Public Identity (`Consumidor Final / Visitante`)**:
   - Acessa o site público (`/public/:slug`) ou o Marketplace (`/marketplace`).
   - Não possui credenciais de acesso nem ao Client OS nem ao HQ OS.

---

## 6. Conclusão e Diretriz de Evolução

Qualquer evolução futura do **3EATCRU HQ OS** deve se ater estritamente a capacidades de **infraestrutura, governança de ecossistema, auditoria, segurança e distribuição**. Todo e qualquer processo relacionado à operação final com consumidores pertence de forma inegociável aos **Módulos Especialistas executados sobre a infraestrutura do 3eatcru OS (Client OS)**.
