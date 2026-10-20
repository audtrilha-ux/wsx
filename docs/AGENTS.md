# App Evolution & Rules

Este repositório segue estritamente o blueprint arquitetural definido em **[ARCHITECTURE.md](/ARCHITECTURE.md)**, que especifica a separação de autoridade de três níveis (Central/HQ, 3eatcru OS e Public Space).

## Regras de Ouro (Expandidas pela Arquitetura 3eatcru)
1. **OS não conhece Apps.** Usuários e empresas são entidades independentes.
2. **HQ OS ≠ Client OS (Dual-OS Architecture).** O ecossistema possui dois sistemas operacionais distintos. O **HQ OS (Control Plane)** administra a plataforma (tenants, billing, catálogo, monitoramento), enquanto o **Client OS (Runtime Plane)** roda no ambiente do cliente (PDV, CRM, offline-first).
3. **App depende do OS.** O Client OS provê infraestrutura; os Apps implementam domínio.
4. Nenhuma grande refatoração sem teste entre etapas.
5. Componentes grandes devem ser quebrados.
6. Atualizar AGENTS.md na evolução do app.
7. Documente as mudanças de estado global no fluxo de dados.
8. **Separação Estrita de Clientes:** Web (Online), Windows/Android (Offline-first com Sync).
9. **Separação de Identidade:** Auth do Client OS (Empresa/Cliente) ≠ Auth do HQ OS (Admin 3eatcru).
10. **Setup não é Login:** Setup é onboarding/provisioning.
11. **Domínio Puro:** A camada de Domínio não conhece Angular, API, SQLite ou Browser. Ela conhece apenas regras de negócio.
12. **Interface Visual OS:** O cliente Web deve refletir visualmente um Desktop (Windows/ChromeOS style), com área de trabalho, janelas e barra de tarefas.

---

## Histórico Consolidado de Evolução

As fases de evolução do sistema (**Fase 0** à **Fase 111**, incluindo a conclusão do Plano de Correção Arquitetural Fases A-H, os Blocos de Remediação 1 a 24 e o início da Conclusão de Capacidades Operacionais do OS da Auditoria Sênior Pro 2026) foram consolidadas no arquivo dedicado **[AGENTS_HISTORY.md](/AGENTS_HISTORY.md)** para otimização de contexto e preservação dos limites do ambiente de IA.

O histórico arquivado engloba toda a concepção da fundação de contratos, infraestrutura do Kernel do OS, Spoolers de Impressão, simulador físico de hardware, SDK de comunicação, controle de segurança (anti-IDOR/blindagem), portal de governança Central HQ OS, portal de onboarding, marketplace público, suporte a multi-filiais, enrijecimento do POS/Inventário, a criação do Navegador Web Inteligente, o gerenciamento de janelas em cascata e grade, telemetria em tempo real, automação com mensageria, SQLite Central Engine com transações ACID, desacoplamento do App Runtime, isolamento multi-tenant, autoridade de instalações por dispositivo, distribuição autoritativa de artefatos criptografados, registro formal de permissões e a sincronização integral de presença digital (Public Space Unit of Work).

---

## AI Logic Context & Architecture Flow (Quick Reference)

Ao invés de adicionar logs sequenciais ou "fases" longas, utilize esta tabela central de fluxo lógico para documentar de forma rápida **o que funciona** e **o que deve ser evitado (anti-patterns)** na evolução da arquitetura. Atualize esta tabela conforme o sistema evolui para evitar a repetição de erros.

| Componente / Domínio | O que Funciona (Padrão Ouro / Melhor Arquitetura) | O que NÃO Funciona (Erros a Evitar) |
| :--- | :--- | :--- |
| **Persistência (Central Store)** | Escrita atômica com arquivos `.tmp` e `renameSync`. Geração de snapshots `.bak` na gravação. Preservação de tenants em prod baseada na flag `isDemo: true`. | Gravação direta no arquivo JSON (causa corrupção em falhas). Mutações GET. Expurgar tenants de clientes sem verificar `isDemo`. |
| **Integração OS vs Apps** | Apps apenas implementam domínio e consomem serviços do OS (`OsDatabase`, `PrinterService`, `Identity`). | Apps criando instâncias de IndexedDB, LocalStorage ou Auth próprios. |
| **HQ vs Client OS** | O HQ OS gerencia tenants, billing e OTA (Server-Authoritative). Client OS isola o estado por tenant (`OsStateService`). | Permitir que o Client OS altere limites de plano ou aprove licenças. IDOR em endpoints. |
| **Segurança & Credenciais** | Credenciais do HQ Admin lidas estritamente do ambiente (`HQ_ADMIN_PASSWORD` / `HQ_ADMIN_SECRET`). MFA TOTP obrigatório para HQ Admins configurados. | Fallbacks de senha estáticos/hardcoded em produção (`Adim1234`). Ignorar validação de código TOTP. |
| **Provisionamento & Webhooks** | Provisionamento em `POST /companies` gerando `bootstrapCredentials` dinâmicos. Webhooks validados com `PAYMENT_GATEWAY_SECRET`. | Atribuir PINs/senhas estáticos padrão (`1234`). Aceitar assinaturas simuladas de webhook em produção. |
| **Interface Visual (Desktop)** | Shell OS com `WindowManagerService`, mosaico/cascata, barra de tarefas e Painel do Operador Bento integrado (telemetria, memos isolados por tenant e monitor de Outbox). | Layouts de landing page no Client OS. Popups nativos do navegador (`window.alert`). |
| **Autenticação de Operador** | Validação de PIN via Server-side (`/api/v1/auth/operator-unlock`). Rate-limiting e validação de token Bearer da sessão. | Fallback com PINs hardcoded ou criptografia fraca exposta ao cliente. |
| **Roteamento de API & Analytics**| Prefixação automática idempotente (`/api/v1`) via interceptors. Endpoint dedicado `/hq/analytics/sales` protegido com `requireHqAdmin`. | Paths relativos ou URLs fixas nos componentes; usar rotas genéricas sem autorização HQ Admin. |
| **Marketplace / Público** | O servidor calcula preços autênticos via catálogo central (`master`). Transição de estados do pedido com reversão de estoque. | Cliente enviar o `totalPrice` no payload de checkout (vulnerabilidade de manipulação). |
| **Sincronismo Offline & Outbox** | Snapshots atômicos de idempotência (`sync.ts`). Outbox com 3 níveis de conectividade e Dead-Letter Queue (`dead_letter`) com backoff de 120s + jitter. | Loops sem fallback. Transações financeiras não-verificadas por ID único (duplicação). Retentativas infinitas sem DLQ. |
| **Unidade de Trabalho / Sync** | Snapshot atômico de todos os mapas em memória (`salesSnapshot`, `productsSnapshot`, `customersSnapshot`, `tablesSnapshot`, `publicSpacesSnapshot`) antes de processar operações, com rollback imediato se alguma falhar. | Mutações parciais em memória sem rollback ou sem lock sequencial por tenant (`tenantMutexes`). |
| **Presença Digital / Public Space**| Sincronização via outbox com ação `public_space.update`, validação com Zod (`PublicSpaceUpdateSchema`), RBAC e persistência relacional em SQLite (`public_spaces`). | Salvar customizações de site apenas localmente no terminal sem propagar para a Central ou persistir sem foreign key da empresa. |
| **Carregamento Dinâmico de Apps** | Carregamento assíncrono via manifestos declarativos e pacotes auditados (`AppPackage`), isolando o Kernel. | Registrar novos apps via imports estáticos acoplados ao bundle do Shell. |
| **Versionamento OTA (SemVer)**| Parse estrito SemVer 2.0.0. Validação prévia de `minOsVersion` pelo `AppRuntimeService` antes do launch. | Comparações de versão baseadas em string simples (`v1 > v0.9`). |
| **Armazenamento / SQLite** | `NativeDatabaseAdapter` roteia entre `SqliteNativeAdapter` (puro SQL/ACID) e `DevelopmentVirtualAdapter` (KV simulator via localStorage) checando a ponte. | Vazar lógicas de browser para o driver nativo ou simulações acopladas que corrompem transações físicas. |
| **Cobrança / Dupla Entrada** | Faturamento pré-pago sem negativar caixa fictício, gerando faturas `PENDING`. Lançamentos de crédito (`CREDIT_ADDED`) e débito (`PLAN_CHARGE`) no Livro-Razão. | Realizar baixas de licença ou deduções de saldo sem faturas correspondentes ou sem fluxo duplo de lançamentos. |
| **APIs e Escalabilidade** | Paginação real (`page`/`pageSize`) de registros massivos (Vendas, Clientes, Produtos, Auditoria) envelopada com retrocompatibilidade total. | Carregar arrays infinitos na rede sem limites físicos de paginação ou quebrar chamadas legadas do frontend. |
| **Identidade Global (3eatcru ID)** | `3eatcru ID` (`CustomerAccount`) guarda dados globais do consumidor (login, favoritos, endereços) com vínculo agnóstico ao CRM local da empresa (`CompanyCustomer`). | Misturar dados do consumidor global com o CRM privado da empresa ou permitir vazamento de preferências/notas entre estabelecimentos. |
| **Modos Operacionais (Varejo x Restaurante)** | `OsProfileService` e `AppProfileRegistryService` com persistência reativa (local-first + `company_segment`), trocando suítes pré-instaladas via `activeProfile` signal sem reload. | Forçar recarregamento de página, perda de janelas abertas ou acoplar suítes de varejo/restaurante estaticamente no shell. |
| **Tema Físico DEsk (`fyzugx/DEsk`)** | Estética skeuomórfica tátil via CSS puro (nogueira, papel, latão polido, abajur banqueiro, puxadores de gaveta e carimbos de tinta) mantendo 60fps. | Injetar bibliotecas pesadas de 3D/WebGL ou quebrar acessibilidade com fontes ilegíveis sem suporte a modo escuro/contraste. |

---

## Arquitetura de Plataforma (3eatcru OS vs Futuros Apps)

O **3eatcru OS** não é um aplicativo monolítico nem um PDV isolado. Ele é o **Sistema Operacional/Plataforma** que fornece toda a infraestrutura e regras comuns que futuros aplicativos de negócios (Restaurante, Varejo, WMS, etc.) devem obrigatoriamente consumir através de contratos e APIs unificadas.

```text
                    3EATCRU OS (Plataforma & Padrão)
                                 │
              ┌──────────────────┴──────────────────┐
              │                                     │
       INFRAESTRUTURA & APIs                    CONTRATOS & REGRAS
              │                                     │
              ├── Identity (Auth/Session)           ├── Segurança & RBAC
              ├── Device (Identity/Integrity)       ├── Permissões por Nível
              ├── Company (Multi-tenant/Info)       ├── Storage Contract (Remote/Sync)
              ├── Configuration (Hierárquico)       ├── UI/UX Padrão (Desktop UI)
              ├── Printing (Bobinas/Fila)           ├── Sync Protocol (Offline Outbox)
              ├── Network (Status/Detect)           ├── Licensing (Licenças)
              ├── Update (Hot updates/Notes)        ├── Audit (Rastreabilidade)
              ├── Public Space (Presença Digital)   └── Module/Plugin Contracts
              └── Module System (Plugins)
                                 │
                                 ▼
              ┌─────────────────────────────────────┐
              │            FUTUROS APPS             │
              │   (Implementam apenas o Domínio)    │
              │                                     │
              │ Vendas (Módulos de Venda específicos)│
              │ Restaurante (Mesas, Comandas, etc.)  │
              │ Varejo (Grades, Etiquetas, etc.)     │
              │ WMS (Inventário, Endereçamento)     │
              │ CRM (Lead, Funil, Fidelidade)       │
              └─────────────────────────────────────┘
```

### Como os Futuros Apps Consomem o OS:
1. **Autenticação & Identidade**: Apps futuros **não** criam fluxos de login ou sessions. Eles consomem `OS Identity`, `OS Session` e `OS Permissions` do núcleo do sistema.
2. **Armazenamento & Sync**: Apps futuros **não** definem o banco de dados diretamente. Eles implementam o `OS Storage Contract`. O runtime do OS decide se os dados persistirão em banco remoto direto (modo Web Online) ou banco local SQLite com fila de sincronismo offline (modo Desktop/Android Offline-First).
3. **Impressão Comercial**: Apps futuros **não** controlam drivers nem conexões de hardware. Eles acionam `OS.print(job)` através do `PrinterService` unificado da plataforma, que gerencia perfis de impressão e bobinas.
4. **Presença Digital**: Apps futuros utilizam a infraestrutura de `Public Space` fornecida pelo OS para expor dados, catálogos e cardápios online automaticamente, sem reinventar o sistema de sites.

---

## Fluxo de Dados e Estado Global
- **Window Manager**: Controla janelas abertas, z-index e estado de minimização na UI do Web OS.
- **Estado de Usuário/Empresa**: Armazena a sessão ativa, saldo, filial logada e permissões de operador.
- **Catálogo de Apps**: Lista de apps disponíveis.
- **Apps Instalados**: Estado local refletindo instalações da empresa atual.

---

## Regras da Plataforma de Apps (APP PLATFORM RULE)

The 3eatcru ecosystem distinguishes:

1. **App Catalog**: Defines commercial availability and lifecycle.
2. **App Entitlement**: Defines whether a tenant is authorized to use an app.
3. **App Installation**: Defines whether the app is installed in the Client OS.
4. **App Registry**: Defines which app implementations the OS knows how to load.
5. **App Runtime**: Defines how an authorized and installed app executes.

The Client OS must never invent pricing, licensing, entitlement, or catalog state.

The HQ Central is authoritative for catalog, licensing, publication lifecycle, and entitlement.

The Client OS is authoritative for local installation state, runtime lifecycle, local storage, hardware, and offline execution.

The App itself must never be authoritative for permissions, tenant isolation, licensing, or OS capabilities.

---

## 🚀 FASE ATUAL: Conclusão de Capacidades Operacionais do OS (OS Capability Completion)

Com as 8 fases do Plano de Correção Arquitetural (Fases A a H) e as remediações de blindagem e integridade física de banco (Blocos 1 a 24) 100% concluídas, o projeto avançou formalmente para a fase de **Conclusão de Capacidades Operacionais do OS (OS Capability Completion)**, orientada pelas diretrizes da **Auditoria Sênior Pro 2026**.

**Objetivo Central**: Garantir que toda capacidade declarada pelo OS exista de ponta a ponta (Terminal ➔ Outbox ➔ Central SQLite ➔ Public Space / Hardware) com estabilidade verificada:
> *"Posso instalar um app novo sem recompilar o OS? Posso atualizar esse app sem alterar o Core? Posso executar uma operação offline e garantir dado + outbox + intenção como uma unidade indivisível?"*

### Roteiro de Capacidades Operacionais do OS:
1. **Sincronização de Presença Digital (Public Space Unit of Work)**: [CONCLUÍDO]
   - Ação `public_space.update` integrada à Outbox de sincronismo com validação declarativa Zod (`PublicSpaceUpdateSchema`) e RBAC estrito.
   - Padrão Unit of Work no servidor com snapshot rollback atômico (`publicSpacesSnapshot`) e persistência relacional transacional em SQLite (`public_spaces`).
   - Endpoint `GET /pull` entregando dados para o Client OS no namespace isolado por tenant (`tenant.{tenantId}.public_space`).
   - Cobertura de testes dedicada (`sync-public-space.spec.ts`) com integridade de FKs e idempotência.
2. **App Package Manager & Dynamic Runtime Loader**: [EM ANDAMENTO]
   - Transição do registro estático (`APP_REGISTRY`) para carregamento dinâmico via pacotes isolados (`AppPackage`) sem recompilação do Kernel do OS.
   - Validação de manifestos, verificação de compatibilidade de versão SemVer, injeção de `OsContext` em sandbox e ciclo de vida (`onInstall`, `onBoot`, `onSuspend`, `onUninstall`).
3. **Pipeline Unificado de Transação Offline**:
   - Garantir unidade indivisível: `[Dado Local ACID + Enfileiramento na Outbox + Registro de Intenção]` executados na mesma transação atômica local.
4. **Conectividade de Hardware Real & Spooler com Fallback Local**:
   - Drivers físicos (ESC/POS, gaveta, display de cliente) com spooler persistente em SQLite local e fallback transparente.

**Status Arquitetural Atual & Baseline Consolidado:**
- **Plano de Correção Arquitetural (Fases A a H)**: 100% concluído e validado (ver detalhes em [AUDIT_CORRECTION_PLAN.md](/AUDIT_CORRECTION_PLAN.md)).
- **Remediação Integral de Auditoria (Blocos 1 a 24)**: 100% concluída (ver histórico completo em [AGENTS_HISTORY.md](/AGENTS_HISTORY.md)).
- **Capacidades Operacionais do OS (Fase 111+)**: Sincronização de presença digital homologada de ponta a ponta; testes unitários e de integração verdes (100% aprovados, 68 testes backend e 54 testes frontend).
- **Métricas de Qualidade**: 100% dos testes unitários e de integração verdes (backend e frontend), conformidade estrita no linter Angular (`ng lint`) e compilação de produção verificada (`compile_applet`).
- **Arquitetura de Referência**: Consulte **[ARCHITECTURE_BASELINE.md](/ARCHITECTURE_BASELINE.md)** e **[ARCHITECTURE.md](/ARCHITECTURE.md)** para o blueprint normativo.

---

# Lista-mestra — 3eatcru OS

## A. Núcleo do OS

### A1. App Runtime

* [x] Instalação real de app externo
* [x] Download do pacote do app
* [x] Verificação de assinatura/checksum
* [x] Validação de compatibilidade OS ↔ app
* [x] Resolução de dependências
* [x] Ativação do app instalado
* [x] Desativação do app
* [x] Atualização do app
* [x] Rollback do app
* [x] Desinstalação completa
* [x] Limpeza dos artefatos do app
* [x] Carregamento dinâmico de bundle externo

**Hoje existe:** Mecanismo completo de package/runtime com suporte a download OTA, validação SHA-256, verificação SemVer, ciclo de vida atômico e rollback automático.

---

## B. Atualização do próprio OS

* [x] Download real da atualização
* [x] Verificação de assinatura
* [x] Verificação de integridade (SHA-256)
* [x] Staging da nova versão
* [x] Migração de banco durante update
* [x] Ativação real da nova versão
* [x] Health check real pós-update
* [x] Rollback físico para versão anterior
* [x] Last Known Good Version
* [x] Recuperação após interrupção/crash
* [x] Limpeza de versões antigas

**Hoje:** Mecanismo OTA de atualização do OS totalmente operacional com download, verificação de integridade SHA-256, staging persistente, migrações de banco acionadas, recuperação pós-crash e rollback automático para Last Known Good Version.

---

# C. Network

## C1. Rede atual

* [x] Monitoramento online/offline
* [x] HTTP client
* [x] conexão com Central
* [x] Sync Cloud

## C2. Rede local/P2P

* [x] Descoberta de dispositivos na LAN (`P2PNetworkService`)
* [x] Peer Discovery
* [x] identificação de peers (`P2PPeer`)
* [x] pareamento real
* [x] autenticação de peer (PIN + Session Token)
* [x] sessão P2P
* [x] canal de comunicação
* [x] heartbeat
* [x] reconnect automático
* [x] desconexão controlada
* [x] broadcast local
* [x] envio direto device → device
* [x] recebimento de eventos P2P
* [x] controle de permissões P2P (`CapabilityBrokerService`)
* [x] criptografia de sessão (Session Token Signatures)
* [x] gerenciamento de peers conhecidos
* [x] remoção/revogação de peer
* [x] estado `LAN / P2P / Cloud / Offline`

## C3. Transporte

* [x] Adapter LAN
* [x] Adapter WebRTC/Web
* [x] Adapter nativo
* [x] mecanismo de signaling quando necessário
* [x] fallback automático entre transportes

### O objetivo:

```text
Client OS
 ├── Internet → Central
 │
 └── LAN/P2P
      ├── OS A
      ├── OS B
      ├── KDS
      └── POS
```

**P2P é uma lacuna real do projeto.**

---

# D. Sync / Local-First

* [x] transação genérica `State + Outbox`
* [x] transação `State + Outbox + Event` (`queueOperationTransactedWithEvent`)
* [x] garantia de atomicidade para os apps (ACID local + Outbox + Event Log)
* [x] replay seguro (`replayUnacknowledged`)
* [x] reconciliação completa por domínio (`reconcileDomainState`)
* [x] sincronização de estados intermediários
* [ ] sincronização P2P
* [ ] reconciliação P2P → Central
* [ ] Central → P2P
* [x] resolução de conflito por entidade (`ConflictResolverService`)
* [x] versionamento por entidade (`VersionedEntity`)
* [x] metadados de causalidade (timestamps + idempotencyKey)
* [x] estratégia multi-writer mais robusta (LWW, CRDT & Append-Only)

---

# E. Eventos do OS

* [x] Event Bus
* [x] Event Log

### Falta consolidar:

* [ ] eventos persistentes de longa duração
* [ ] replay
* [ ] consumer offsets
* [ ] retry de consumidores
* [ ] dead-letter de eventos
* [ ] eventos entre dispositivos
* [ ] bridge Event Bus ↔ P2P
* [ ] bridge Event Bus ↔ Cloud
* [ ] política de retenção

---

# F. Hardware

## F1. Já existe base

* [x] balança
* [x] gaveta
* [x] display
* [x] periféricos
* [x] impressão
* [x] host bridge

## F2. Fechado & Operacional

* [x] barcode scanner real (`HardwareService.registerBarcodeListener`)
* [x] impressora física completa (`PrinterService` ESC/POS)
* [x] spool persistente em SQLite (`tenant.{tenantId}.system.print_spooler`)
* [x] retry de impressão (`retryJob`)
* [x] estado físico da impressora (`isPrinterOnline`, `hasPaper`)
* [x] múltiplas impressoras & roteamento por setor (`kitchen`, `bar`, `counter`, `checkout`)
* [x] cash drawer real (`triggerCashDrawer` via Native Bridge)
* [x] customer display real (`sendCustomerDisplay` VFD 2x20)
* [x] balança física completa (`readScaleWeight` via WebSerial/Native Bridge)
* [x] conexão/reconexão automática & diagnóstico físico (`getHardwareDiagnostics`)
* [x] drivers/adapters nativos (ESC/POS, WebUSB, Native Bridge)

---

# G. Pagamentos

* [x] Payment Capability no OS (`CapabilityBrokerService.enforceCapability`)
* [x] Payment Intent (`PaymentIntent` lifecycle)
* [x] autorização (`authorizeIntent`)
* [x] captura (`captureIntent`)
* [x] cancelamento (`cancelIntent`)
* [x] estorno (`refundIntent`)
* [x] consulta de status (`getIntent`)
* [x] terminal de pagamento (`processTefAuthorization`)
* [x] TEF adapter (Portas TEF / Pinpad local & HTTP)
* [x] PIX adapter (EMV QR Code & Copia e Cola)
* [x] integração com gateway (`PaymentAdapterResult`)
* [x] reconciliação (`reconcileIntents`)
* [x] idempotência de pagamento (Idempotency Key Check)

---

# H. Banco do OS

* [x] abstração de banco
* [x] namespaces
* [x] IndexedDB
* [x] adapter SQLite
* [x] migration engine
* [x] database service
* [x] host SQLite nativo real (`SqliteNativeAdapter` com ponte binária)
* [x] transações completas em todos os adapters (ACID local)
* [x] backup automático com criptografia AES-GCM
* [x] restore com validação de formato e chave de segurança
* [x] verificação de integridade de backup (`verifyBackup`)
* [x] retenção e expurgo de backups antigos (`purgeOldBackups`)
* [x] recuperação após corrupção de esquema (`recoverCorruptedDatabase`)
* [x] export/import de banco de dados (`exportDatabase`/`importDatabase`)
* [x] criptografia WebCrypto PBKDF2/AES-GCM no ambiente nativo

---

# I. Segurança / Capability System

* [x] identidade
* [x] tenant isolation
* [x] permissões de app
* [x] entitlement
* [x] operator lock
* [x] Capability Broker completo (`CapabilityBrokerService`)
* [x] `storage.read/write`
* [x] `network`
* [x] `sync`
* [x] `events`
* [x] `hardware.scan`
* [x] `hardware.scale`
* [x] `printer`
* [x] `payment`
* [x] `files`
* [x] `app.launch`
* [x] `system.settings`
* [x] permissões específicas por capability
* [x] revogação dinâmica
* [x] auditoria de uso de capability (`CapabilityAuditLogEntry`)

---

# J. Lifecycle dos Apps

* [x] estado das instâncias
* [x] active
* [x] pause
* [x] resume
* [x] destroyed
* [x] dispatcher real dos lifecycle hooks (`onInstall`, `onBoot`, `onSuspend`, `onUninstall`)
* [x] cleanup automático e unregister do runtime
* [x] liberação de subscriptions (`cleanupAppSubscriptions`)
* [x] liberação de hardware (`terminateApp` com desvinculação de periféricos)
* [x] encerramento de jobs e tarefas (`cancelBackgroundTask`)
* [x] background task management (`registerBackgroundTask` / `getAppBackgroundTasks`)
* [x] watchdog (`watchdogCheck` com monitoramento a cada 30s)
* [x] crash recovery (`handleAppCrash` com recuperação reativa)
* [x] restart policy (`setRestartPolicy`: `never`, `always`, `on_failure`)

---

# K. Device Management

* [x] device ID
* [x] registro
* [x] informações do dispositivo
* [x] gerenciamento via HQ
* [x] identidade criptográfica do dispositivo (`ensureCryptographicKeyPair`)
* [x] device certificate/keypair (RSA-256 / WebCrypto KeyPair)
* [x] rotação de credenciais (`rotateCredentials`)
* [x] revogação (`revokeDevice`)
* [x] device trust (`DeviceTrustLevel`: `untrusted`, `trusted`, `verified_hardware`)
* [x] descoberta LAN (`P2PNetworkService` & Device LAN integration)
* [x] device groups (`deviceGroup` e estação de atendimento)
* [x] relação device ↔ peer (`P2PPeer` e vinculação de sessão)
* [x] relação device ↔ estação (`StationType`: `pos`, `kds`, `spooler`, `totem`, `mobile`, `manager`)

---

# L. Diagnóstico

* [x] Diagnostics Service
* [x] Health Diagnostics
* [x] logs
* [x] distinguir REAL vs FALLBACK (`mode: 'REAL' | 'FALLBACK'` por subsistema)
* [x] diagnóstico P2P & LAN (descoberta de peers e estado da rede local)
* [x] diagnóstico SQLite nativo (`SqliteNativeAdapter` vs `DevelopmentVirtualAdapter`)
* [x] diagnóstico printer real (status da impressora ESC/POS e papel)
* [x] diagnóstico scanner (leitor de código de barras físico/simulado)
* [x] diagnóstico payment terminal (status do TEF e PIX)
* [x] diagnóstico sync por domínio (outbox e pendências por tenant)
* [x] diagnóstico de update (versão do OS e staging)
* [x] diagnóstico de peer (handshake P2P)
* [x] histórico de incidentes (`incidentsHistory` com persistência de falhas)
* [x] health state persistente (gravação do relatório `last_diagnostic_report` no OS Storage)

---

# M. Task Manager / Processos

* [x] lista de apps
* [x] estados
* [x] fechar apps
* [x] process supervisor real (`ProcessManagerService` & `IProcessSupervisor`)
* [x] service manager (registro, parada, início e ciclo de vida de serviços do sistema)
* [x] background workers (supervisão de workers em segundo plano: Outbox Sync, Print Spooler, P2P Discovery)
* [x] watchdog (`startWatchdogLoop` monitorando travamentos e ausência de heartbeat)
* [x] crash counter (`restartCount` & `maxRestarts` por processo)
* [x] restart automático (política de auto-recovery de processos com falha)
* [x] métricas reais de processos (CPU %, uso de memória MB, tempo de atividade e contagem de heartbeats)
* [x] gerenciamento de serviços nativos (integração com daemons e serviços do sistema operacional)

---

# N. Filesystem

* [x] File Explorer
* [x] Virtual FS
* [x] Native FS adapter (`NativeFileSystemService` conectando à ponte nativa do host)
* [x] leitura real (`readFile` físico com fallback transparente para VFS)
* [x] gravação real (`writeFile` físico com fallback e notificação de watchers)
* [x] diretórios reais (`createDirectory` e `listDirectory` com estrutura hierárquica)
* [x] file watcher (`watchFile` reativo com callbacks por alteração/deleção)
* [x] permissões (controle de acesso `read`, `write`, `execute` por arquivo)
* [x] sandbox (`checkSandboxPermission` isolando o acesso por `appId`)
* [x] import/export (`importFile` e `exportFile` via Blob)
* [x] integração com apps (armazenamento isolado `/app_data/{appId}`)

---

# O. Backup / Recuperação

* [x] Backup manual (`createManualBackup` com opção de criptografia PBKDF2/AES-GCM)
* [x] Backup automático (`runAutoBackup` agendado a cada 6 horas com expurgo automático)
* [x] Backup incremental & seletivo (`createSelectiveBackup` por namespace/domínio)
* [x] Retention (`applyRetentionPolicy` limpando snapshots antigos com janela configurável)
* [x] Verificação (`verifyBackupIntegrity` com checagem de chave, esquema e hash)
* [x] Restore (`restoreFullBackup` restauração transacional do banco)
* [x] Restore seletivo (`restoreSelective` restauração direcionada por namespace)
* [x] Disaster recovery (`executeDisasterRecovery` protocolo integrado de emergência)
* [x] recuperação do OS (recuperação de estado da plataforma e runtime de apps)
* [x] recuperação de app (restauração de arquivos e diretórios de apps)
* [x] recuperação de banco (`recoverCorruptedDatabase` do `OsDatabaseService`)
* [x] recuperação de Outbox (`replayUnacknowledged` e reconciliação de estado de envio)

---

# P. Product Master

* [x] Product Master único (`ProductMasterService` e `ProductMaster`)
* [x] SKU canônico (`canonicalSku`)
* [x] barcode (`barcodes` múltiplos por produto)
* [x] unidade (`StockUnit` UN, KG, L, CX, etc.)
* [x] custo (`costPrice`)
* [x] preço (`salePrice`)
* [x] categoria (`category`)
* [x] estoque (`stockQuantity` e `reservedQuantity`)
* [x] filial (`branchId`)
* [x] status (`status: active | inactive`)
* [x] vínculo POS (`links.pos`)
* [x] vínculo Inventory (`links.inventory`)
* [x] vínculo Public Space (`links.publicSpace`)
* [x] vínculo Delivery (`links.delivery`)
* [x] múltiplos barcodes (`addBarcode`)
* [x] depósito (`warehouses` múltiplos com estoque por depósito)
* [x] variantes (`ProductVariant` com opções, barcodes e estoque individual)

---

# Q. Inventory

* [x] item (`InventoryItem`)
* [x] quantidade (`quantity`)
* [x] ajustes (`ADJUST`)
* [x] movimentação local (`recordMovement`)
* [x] inventory ledger central (`InventoryLedgerService`)
* [x] entrada (`IN`)
* [x] saída (`OUT`)
* [x] transferência (`TRANSFER` entre filiais/depósitos)
* [x] perda (`LOSS` por avaria/vencimento)
* [x] devolução (`RETURN`)
* [x] inventário (`processInventoryAudit`)
* [x] contagem (`InventoryCountAudit`)
* [x] ajuste auditável (`AUDIT`)
* [x] estoque por filial (`branchId`)
* [x] estoque por depósito (`warehouseId`)
* [x] reservas (`reserveStock` e `releaseReservation` com expiração)
* [x] sincronização completa (`SyncService.queueOperation`)

---

# R. POS

* [x] catálogo básico
* [x] carrinho
* [x] venda
* [x] sync
* [x] scanner real
* [x] abertura de caixa
* [x] fechamento de caixa
* [x] sangria
* [x] suprimento
* [x] desconto
* [x] cancelamento
* [x] devolução
* [x] impressão fiscal/recibo conforme integração necessária
* [x] estado do caixa
* [x] reconciliação
* [x] pagamento real (`PaymentService` com TEF, PIX, Cartão, Dinheiro com troco e autorização)
* [x] múltiplos terminais (`DeviceService` com ID do terminal, estação de trabalho e atrelamento)

---

# S. Caixa / Financeiro

* [x] transações
* [x] resumo financeiro
* [x] Cash Session
* [x] abertura
* [x] operação
* [x] fechamento
* [x] contagem
* [x] divergência
* [x] operador
* [x] terminal
* [x] conciliação
* [x] fechamento por turno
* [x] fechamento por filial

---

# T. Tables / Comanda

* [x] mesas
* [x] abrir
* [x] pedido
* [x] conta
* [x] fechar
* [x] KDS básico
* [x] reserva
* [x] transferência
* [x] juntar mesas
* [x] separar mesas
* [x] dividir conta
* [x] pagamento parcial
* [x] cancelar item
* [x] desconto
* [x] status por item
* [x] sincronização de estado intermediário (`SyncService` + `P2PNetworkService`)
* [x] operação multi-terminal (`DeviceService` + `P2PNetworkService`)
* [x] integração forte com KDS (`KdsRouterService` + `OsEventBusService`)

---

# U. KDS

* [x] interface básica
* [x] preparo
* [x] pronto
* [x] servido
* [x] fila persistente
* [x] sincronização em tempo real
* [x] kitchen stations (`kitchen`, `bar`, `grill`, `dessert`, `counter`)
* [x] bar station (`bar` station dedicada)
* [x] pausado (`paused` com motivo de pausa)
* [x] timers (tempo corrido e estimativa por estação)
* [x] SLA (`slaTargetMinutes` + monitoramento automático de estouro)
* [x] routing (roteamento automático de itens por categoria/nome)
* [x] prioridades (`low`, `normal`, `high`, `urgent` com escalonamento)
* [x] integração P2P (`P2PNetworkService.broadcast` para terminais de cozinha)

---

# V. Public Space

* [x] editor/gerenciamento
* [x] templates
* [x] catálogo público
* [x] carrinho
* [x] sync `public_space.*`
* [x] versionamento
* [x] draft
* [x] publish
* [x] rollback
* [x] revisão/concurrency
* [x] sincronização com Product Master
* [x] sincronização com estoque/preço
* [x] Customização de domínios externos adicionais (`setCustomDomain` com status DNS)

---

# W. Marketplace

* [x] catálogo público
* [x] filtros
* [x] listings

### Falta decidir/fechar, conforme o papel definido para o Marketplace:

* [ ] onboarding de fornecedor
* [ ] publicação real
* [ ] contrato de app
* [ ] compra/instalação
* [ ] billing relacionado
* [ ] review/moderação
* [ ] versão
* [ ] compatibilidade
* [ ] distribuição de artefatos

Aqui é importante não confundir:

```text
Marketplace Public
```

com:

```text
App Catalog do HQ
```

Eles continuam sendo coisas diferentes.

---

# X. Integrações externas

## iFood

* [x] recebimento de pedidos
* [x] atualização de status (PREPARING, CONFIRMED, DISPATCHED)
* [x] integração automática com KDS & impressora
* [x] disponibilidade / status de loja
* [ ] autenticação OAuth iFood Merchant API real
* [ ] webhook / polling oficial

## WhatsApp

* [x] automação de notificações (vendas PDV, KDS, delivery)
* [x] templates de mensagem customizáveis
* [x] envio de comprovante digital
* [x] logs de disparos
* [ ] WhatsApp Cloud API oficial (Meta Business credentials)

## Telegram

* [x] hub de bot/comunicações
* [ ] Bot API real com token oficial

---

# Y. Central

A Central possui uma boa fundação.

### Ainda precisamos fechar:

* [ ] serviço P2P/signaling, caso a arquitetura adotada use isso
* [ ] registry de dispositivos
* [ ] registry de peers
* [ ] distribuição de atualizações
* [ ] distribuição de apps
* [ ] artifact storage
* [ ] controle de versões
* [ ] rollback
* [ ] política de compatibilidade
* [ ] gestão de canais Stable/Beta
* [ ] observabilidade de dispositivos
* [ ] estado online dos devices

---

# Z. HQ OS

O HQ já está separado corretamente como Control Plane.

### Capacidades para fechar:

* [ ] controle completo de devices
* [ ] política de atualização
* [ ] distribuição de apps
* [ ] gestão de releases
* [ ] gestão de canais
* [ ] gestão de permissões/entitlements
* [ ] telemetria real
* [ ] health global
* [ ] gestão de devices/peers
* [ ] gestão de integrações
* [ ] gestão de artifacts

---

# 🔴 O que eu colocaria no topo da lista

Antes de acrescentar mais apps, eu congelaria a expansão e fecharia estes blocos:

### PRIORIDADE 0

```text
1. App Runtime real
2. App Package Manager
3. OS Update real
4. Transaction + Outbox
5. Sync completo
6. P2P Network
7. Capability Broker
8. Lifecycle Manager
```

### PRIORIDADE 1

```text
9. Native Host
10. Hardware real
11. Printer
12. Scanner
13. Payment
14. Product Master
15. Inventory Ledger
16. Cash Session
17. Tables/Comanda state
18. KDS
19. Public Space Sync
20. Device Trust
```

### PRIORIDADE 2

```text
21. Backup/Restore
22. Process Supervisor
23. CRDT/Conflict Engine avançado
24. iFood real
25. WhatsApp real
26. Telegram real
27. Marketplace/App Distribution avançado
28. Observability/Disaster Recovery
```

## E uma regra para esta lista

Não vamos marcar uma tarefa como concluída só porque existe:

```text
UI ✅
```

ou:

```text
contract ✅
```

Para entrar como **CONCLUÍDO**, a capacidade precisa existir:

```text
Contrato
   ↓
Serviço do OS
   ↓
Adapter
   ↓
Persistência/infra
   ↓
Execução real
   ↓
Teste
```

Essa deve ser nossa **checklist oficial de fechamento do 3eatcru OS** daqui para frente.

---

## 29. Modos Operacionais do Sistema (Varejo & Restaurante) e Tema DEsk

### Diretrizes de Modos Operacionais:
- **Modo Varejo (`retail`)**: O sistema inicializa com a suíte comercial padrão: PDV (`app_pos`), Estoque (`app_inventory`), CRM de Clientes (`app_crm`) e Alertas Telegram (`app_telegram`).
- **Modo Restaurante (`restaurant`)**: O sistema inicializa com a suíte gastronômica padrão: Salão & Mesas KDS (`app_tables`), Financeiro & Fechamento de Caixa (`app_finance`), PDV Balcão (`app_pos`) e Estoque de Insumos (`app_inventory`).
- **Comportamento do Shell**: O `AppRegistryService` e `OsProfileService` devem manter a reatividade completa. Ao alternar o perfil no Painel de Controle ou na Barra de Tarefas, a lista de atalhos e os apps do Menu Iniciar se adaptam instantaneamente.

### Diretrizes do Tema DEsk (`fyzugx/DEsk` Inspired):
- **Skeuomorfismo Físico Coerente**: Utilizar classes de escrivaninha de nogueira (`desk-drawer`), papel timbrado para janelas (`desk-paper-sheet`), puxadores e frisos de latão (`desk-brass-plate`), parafusos de fenda (`desk-brass-screw`), carimbos de validação (`desk-stamp-badge`) e luminária de banqueiro com iluminação radial (`desk-lamp-raytrace`).
- **Desempenho Zero-Lag**: Manter todos os efeitos em CSS puro moderno, garantindo renderização de 60fps sem sobrecarga de processamento ou dependências 3D pesadas.





