# 3EATCRU OS — Baseline Arquitetural Definitivo

Este documento define a autoridade arquitetural inegociável do ecossistema **3eatcru OS**, eliminando ambiguidades entre documentos legados e estabelecendo as regras da plataforma.

---

## 1. Princípios Fundamentais do Ecossistema

1. **Dual-OS Architecture**:
   - **HQ OS (Control Plane / Central)**: Painel administrativo de controle, catálogo mestre de aplicativos, faturamento contábil, telemetria global, monitoramento de saúde e gestão de tenants.
   - **Client OS (Runtime Plane / Terminal)**: Sistema operacional local desktop-style rodando no terminal/dispositivo do cliente (PDV, Mesas, CRM, WMS, Hardware).
2. **Local-First & Offline-First**:
   - O Client OS é soberano para operações diárias de negócio mesmo sem conectividade com a nuvem.
   - O armazenamento local opera via `PlatformDatabaseAdapter` (SQLite nativo no Desktop/Electron/Android, IndexedDB transacional no Browser).
   - O tráfego de sincronização opera assincronamente através de **Outbox Idempotente** com controle de concorrência por tenant via **In-Process Tenant Mutex** (Unidade de Trabalho sequencial por tenant em single-node execution), teto de backoff exponencial e Dead-Letter Queue (`dead_letter`).
3. **Persistência Central Relacional (SQLite-First & Fail-Closed)**:
   - A autoridade primária de dados do servidor central reside exclusivamente no banco de dados SQLite (`central_platform.db`) com journaling **WAL** (Write-Ahead Logging) e chaves estrangeiras ativadas.
   - `central_store.json` é mantido estritamente como snapshot/backup de exportação secundário e nunca como fonte de verdade no boot.
   - **Boot Fail-Closed**: Se o banco SQLite possuir dados mas a hidratação falhar, o sistema entra em modo `DEGRADED` e bloqueia qualquer bootstrap ou substituição destrutiva de dados.
4. **Segurança de Fronteira e Credenciais**:
   - Credenciais de administração central e segredos de assinatura (`JWT_SECRET`, `HQ_ADMIN_PASSWORD`, `HQ_ADMIN_MFA_SECRET`, `PAYMENT_GATEWAY_SECRET`) são lidos obrigatoriamente do ambiente (`process.env`).
   - MFA (TOTP RFC 6238) é estritamente obrigatório em ambiente de produção para administradores do HQ.
   - Endpoints de autenticação e onboarding possuem rate-limiting por IP real de rede (`getClientIp`).
5. **Governança Estrita de Aplicativos & Artefatos**:
   - Ciclo de vida com máquina de estados finita: `DRAFT` ➔ `IN_REVIEW` ➔ `APPROVED` ➔ `PUBLISHED` ➔ `SUSPENDED` ➔ `RETIRED` (e `REJECTED` a partir de `IN_REVIEW`).
   - Releases de aplicativos são imutáveis e protegidas por validação de integridade criptográfica **SHA-256**.
   - Em ambiente de produção, pacotes binários reais de artefato (`artifactBase64`) são estritamente obrigatórios.
6. **Motor SemVer 2.0.0 Unificado**:
   - Validação e comparação de versões de plataforma e aplicativos utilizam o mesmo motor canônico e estrito de parsing (`parseSemVer`), comparação (`compareSemVer`) e satisfatibilidade de versão (`satisfiesSemVer`).
7. **Metáfora de Interface Web OS para Business**:
   - O Client OS é apresentado visualmente como um Desktop de alta fidelidade para o operador. Ele isola a experiência corporativa em janelas de aplicativos cascateadas e fornece telemetria em tempo real, notas rápidas (memos) atômicas por tenant e rastreamento transparente da Outbox de sincronismo através do **Painel do Operador Bento** integrado ao Shell.

---

## 2. Mapa de Autoridade de Dados

```text
                  HQ CENTRAL (Control Plane)
             ┌─────────────────────────────────┐
             │ SQLite (central_platform.db)    │ ◄── [Fonte de Verdade Central]
             │  - Tenants, Users, Plans        │
             │  - App Catalog & Releases       │
             │  - Master Sales, Customers      │
             │  - Idempotency & Audit Logs     │
             └────────────────┬────────────────┘
                              │
                    [HTTPS REST / Outbox Sync]
                    (Idempotency-Key + Bearer)
                              │
                              ▼
                  CLIENT OS (Runtime Plane)
             ┌─────────────────────────────────┐
             │ Local Database Adapter          │ ◄── [Soberania de Operação Local]
             │  - SQLite (Native) / IndexedDB  │
             │  - Offline Outbox Queue         │
             │  - App State & Local Cache      │
             └─────────────────────────────────┘
```

---

## 3. Matriz de Componentes e Responsabilidades

| Componente | Localização | Papel & Responsabilidade |
| :--- | :--- | :--- |
| **CentralDatabaseEngine** | `src/server/db/central-db.ts` | Autoridade relacional primária. Gerencia conexões SQLite ACID, migrações com versionamento, seed inicial e persistência transacional. |
| **Sync Engine** | `src/server/routes/sync.ts` & `src/app/core/sync/sync.service.ts` | Processamento transacional de lotes com lock de concorrência por tenant (In-Process Mutex), validação Zod e Dead-Letter Queue. |
| **App Runtime** | `src/app/core/app-runtime/app-runtime.service.ts` | Provedor do `OsContext` para os aplicativos, isolando o kernel do OS e provendo APIs de hardware, banco e rede. |
| **App Registry** | `src/app/core/app-runtime/app-registry.service.ts` | Registro e máquina de estados de carregamento assíncrono dos aplicativos (`AppLoadingState`). |
| **HQ Apps Router** | `src/server/routes/hq-apps.ts` | Governança de catálogo, transições válidas de ciclo de vida (`DRAFT`, `IN_REVIEW`, `APPROVED`, `PUBLISHED`, `SUSPENDED`, `REJECTED`, `RETIRED`) e releases imutáveis com checksum SHA-256. |
| **SemVer Engine** | `src/server/semver.ts` & `src/app/core/semver.ts` | Especificação canônica de versionamento SemVer 2.0.0 com pre-release e build metadata. |
| **Security & Auth** | `src/server/config.ts`, `auth.ts`, `middleware.ts` | JWT, TOTP RFC 6238, rate limiting por IP, sanitização Zod e impersonação auditada de suporte. |
| **App Access & Store Resolution** | `src/app/core/app-runtime/app-access.service.ts` & `src/server/routes/store.ts` | Resolução soberana de execução (`entitled? installed? compatible? dependencies?`), controle por dispositivo e dependências recursivas. |
| **OTA & Artifact Distribution** | `src/server/routes/store.ts` & `src/server/routes/hq-apps.ts` | Ciclo OTA com validação criptográfica SHA-256 de artefatos, canais stable/beta e staging de ativação. |
| **Customer Identity & 3eatcru ID** | `src/server/routes/customer.ts` & `src/app/core/identity/customer-identity.service.ts` | Autenticação e perfil global do consumidor (`CustomerAccount`), vinculação transacional de pedidos do Marketplace e pontos de fidelidade no CRM local. |
| **Desktop Shell UI** | `src/app/ui/os/os-shell.component.ts` & `window-manager.service.ts` | Gerencia a metáfora visual de desktop, atalhos do workspace, janelas flutuantes/cascateadas, barra de tarefas e o Painel do Operador Bento com memos isolados. |

---

## 4. Conformidade de Verificação e Health Checks

- `/health`: Status geral do sistema e contagem de entidades.
- `/health/liveness`: Verificação de vivacidade do processo Node.js/Express.
- `/health/readiness`: Verificação da integridade do banco de dados SQLite (`SELECT 1`).

---

## 5. Modos Operacionais do Client OS (Varejo & Restaurantes)

O **3eatcru OS** disponibiliza dois modos operacionais dedicados que adaptam instantaneamente a suíte de aplicativos pré-instalada, os atalhos da área de trabalho, as rotinas de negócio e os menus do sistema:

1. **Modo Varejo & Comércio (`retail`)**:
   - **Foco Operacional**: Lojas, minimercados, confecções, materiais de construção e comércio varejista geral.
   - **Suíte Pré-instalada**:
     - *PDV / Frente de Caixa (`app_pos`)*: Leitura de código de barras (EAN-13), balança comercial homologada (pesagem estável em Kg) e impressão de cupom fiscal em bobina térmica 80mm.
     - *Controle de Estoque (`app_inventory`)*: Cadastro de produtos, ficha de movimentação, conferência de inventário e avisos de ponto de reposição.
     - *Gestão de Clientes CRM (`app_crm`)*: Histórico de compras, fidelização, cadastro com 3eatcru ID e segmentação de consumidores.
     - *Bot de Notificações Telegram (`app_telegram`)*: Avisos automáticos de abertura/fechamento de caixa, sangrias e alertas de segurança.
   - **Utilitários do Sistema**: Calculadora de balcão, Explorador de Arquivos, Docs & Especificações, Diagnóstico & Telemetria e Painel de Controle.

2. **Modo Restaurantes & Gastronomia (`restaurant`)**:
   - **Foco Operacional**: Restaurantes a la carte, bares, cafeterias, pizzarias e hamburguerias.
   - **Suíte Pré-instalada**:
     - *Salão & Mesas / KDS Cozinha (`app_tables`)*: Mapa visual de mesas, controle de comandas digitais, transferência de itens e tela Kitchen Display System (KDS) em tempo real.
     - *Financeiro & Sessões de Caixa (`app_finance`)*: Abertura e fechamento de turnos de operadores, suprimentos, sangrias, contas a pagar/receber e conciliação bancária.
     - *PDV / Frente de Caixa Balcão (`app_pos`)*: Lançamento rápido de pedidos de balcão e take-away.
     - *Controle de Estoque & Insumos (`app_inventory`)*: Gestão de matéria-prima, fichas técnicas de pratos e quebra de estoque.
   - **Canais Conectados**: Integração com pedidos iFood Delivery e bot de atendimento WhatsApp.

3. **Arquitetura de Chaveamento Reativo de Modo**:
   - O modo é gerenciado pelo `OsProfileService`, armazenado com redundância no `localStorage` (para inicialização offline instantânea) e sincronizado no atributo `company_segment` da empresa.
   - O `AppRegistryService` monitora o `activeProfile` através de Angular `effect()`, reconfigurando dinamicamente as suítes de aplicativos em tempo de execução sem recarregar a página e sem perder janelas abertas.

---

## 6. Arquitetura Visual Skeuomórfica DEsk (`fyzugx/DEsk` Inspired)

O ecossistema adota uma linguagem visual física e tátil skeuomórfica de escrivaninha de madeira nobre e instrumentos administrativos:

1. **Mesa de Carvalho e Nogueira**: Textura escura e profunda de bancada de trabalho, eliminando a estética genérica de dashboards modernos e transmitindo calor e autoridade operacional.
2. **Janelas em Folha de Papel (`desk-paper-sheet`)**: As janelas de aplicação são tratadas visualmente como folhas de papel artesanal ou formulários físicos com sombras suaves de sobreposição (`box-shadow` multicamadas), rebites de fixação e etiquetas com cantos chanfrados.
3. **Barra de Título em Latão e Nogueira**: Cabeçalho de janela com acabamento metálico escovado (`desk-brass-plate`), puxadores e parafusos de fenda dourados (`desk-brass-screw`).
4. **Dock Gaveteiro de Madeira (`desk-drawer`)**: A barra de tarefas inferior simula uma gaveta de escrivaninha clássica com frisos de latão, puxador central metálico e botões táteis que afundam ao toque.
5. **Luminária de Banqueiro (`desk-lamp-raytrace`)**: Sistema de iluminação de mesa com foco quente radial que projeta luz suave sobre o balcão de atendimento, controlável diretamente pela barra rápida ou bandeja do sistema.
6. **Carimbos de Auditoria (`desk-stamp-badge`)**: Badges de status no estilo carimbo de borracha prensado sobre papel, indicando autenticidade fiscal e validação de operações.
