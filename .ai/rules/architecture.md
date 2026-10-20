# Regras Arquiteturais Fundamentais (3eatcru OS)

Este documento define as diretrizes arquiteturais soberanas que regem o desenvolvimento no ecossistema **3eatcru OS**.

---

## 1. Regra de Ouro (Platform First · Apps Second)
- O **3eatcru OS** é a plataforma/sistema operacional. Ele funciona de forma soberana e independente de qualquer aplicativo de negócio.
- Os **Apps** (PDV, Mesas, CRM, WMS, WhatsApp, iFood, etc.) dependem do OS exclusivamente por contratos e pelo `OsSdkService` (`OsContext`).
- O **Core** nunca importa componentes, contratos privados ou lógicas internas de aplicativos de negócio.

---

## 2. Arquitetura Dual-OS (HQ OS vs Client OS)
1. **HQ OS (Control Plane)**:
   - Administra tenants, planos, catálogo mestre de apps, faturamento e telemetria global.
   - Autoridade primária residente no SQLite Central (`central_platform.db`).
   - Autenticação e tokens isolados sob contexto `AUTH_AUTHORITY = 'hq'`.
2. **Client OS (Runtime Plane)**:
   - Roda no ambiente do cliente/terminal.
   - Metáfora visual de Desktop (janelas, barra de tarefas, atalhos, painel do operador bento).
   - Local-First & Offline-First com `PlatformDatabaseAdapter` e fila Outbox idempotente.
   - Autenticação e tokens isolados sob contexto `AUTH_AUTHORITY = 'client'`.

---

## 3. Autoridade de Persistência e Sincronização
- **Servidor Central**: SQLite (`central_platform.db`) com modo WAL e transações atômicas ACID (`BEGIN IMMEDIATE` ... `COMMIT`).
  - O arquivo `central_store.json` atua estritamente como export/backup secundário, nunca como fonte primária no boot.
- **Client OS**: `PlatformDatabaseAdapter` resolvendo dinamicamente para SQLite nativo (Desktop), IndexedDB (Browser) ou Virtual Memory (SSR/Testes).
- **Sincronização Offline**: Fila Outbox com teto de backoff exponencial de 120s, jitter, verificação de conectividade em 3 níveis e Dead-Letter Queue (`dead_letter`) para transações com falha permanente.

---

## 4. Segurança de Fronteira e RBAC
- **Papéis Estritos**: `admin`, `manager`, `operator` para tenants; `hq_admin` exclusivo para o Control Plane. Injeções de papel são rejeitadas pelo Zod e no banco via `CHECK` constraints.
- **Login vs PIN**: Autenticação de sessão (`POST /api/v1/auth/login`) exige email e senha. Desbloqueio operacional de terminal (`POST /api/v1/auth/operator-unlock`) exige Bearer Token ativo e PIN do operador.
- **Revogação Persistente**: Tokens revogados são persistidos na tabela `revoked_tokens` do SQLite com cache L1 em memória.
- **Credenciais Seguras**: Zero fallbacks hardcoded (`1234` ou senhas padrão) em produção. Credenciais de bootstrap são geradas via `crypto.randomBytes`.
- **Validação de Fronteira**: Todos os endpoints validam payloads contra schemas declarativos **Zod** (`validateBody`).

---

## 5. Governança de Apps e Versionamento OTA
- **Taxonomia Comercial**: `FREE`, `ONE_TIME`, `SUBSCRIPTION_MONTHLY`, `SUBSCRIPTION_ANNUAL`, `USAGE_BASED`.
- **Ciclo de Vida de Apps**: `DRAFT` ➔ `IN_REVIEW` ➔ `APPROVED` ➔ `PUBLISHED` ➔ `SUSPENDED` ➔ `RETIRED`.
- **Integridade Criptográfica**: Releases de apps possuem validação de checksum SHA-256 e verificação de compatibilidade estrita SemVer 2.0.0 (`parseSemVer`, `satisfiesSemVer`).
- **Escopos**:
  - `AppEntitlement`: Autorização comercial da empresa (`companyId:appId`).
  - `AppInstallation`: Instalação física no terminal (`companyId:deviceId:appId`).
