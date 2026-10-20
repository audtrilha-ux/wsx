# 3eatcru BUSINESS OS — PLANO MESTRE DE TESTES E VALIDAÇÃO INTEGRADA (TRI-PERSONA)

**Projeto:** 3eatcru Business OS  
**Tipo:** Sistema Operacional Empresarial & Plataforma de Comércio Unificada  
**Mercado Inicial:** Londrina — Paraná — Brasil  
**Documento:** 26-TESTES.md  
**Status:** Validado e Aprovado  
**Versão:** 1.0.0 — Outubro de 2026  

---

## 1. VISÃO GERAL DA ESTRATÉGIA DE TESTES

Em cumprimento estrito à **Regra de Realidade (Seção 60 da Especificação Arquitetural)**:
> *"Documentação não será considerada prova de implementação. Para declarar uma funcionalidade como pronta: Documentação + Código + Testes + Execução Real devem estar coerentes. Uma função descrita no documento mas inexistente no código não existe."*

O ecossistema **3eatcru Business OS** opera sob um modelo de três dimensões complementares que compartilham o mesmo núcleo transacional (**OS Core + Business Core**):

```text
                               3EATCRU BUSINESS OS
                                        │
             ┌──────────────────────────┼──────────────────────────┐
             │                          │                          │
             ▼                          ▼                          ▼
       [HQ CONTROL PLANE]       [BUSINESS OS OPERATOR]      [CLIENT / CONSUMER]
       Centro de Controle         PDV / Varejo / Gastro     Marketplace / Loja
       Multi-empresa / Billing    Estoque / Mesas / KDS     3eatcru ID / Checkout
```

Para garantir resiliência operacional em Londrina, todo o ciclo foi submetido a testes automatizados de ponta a ponta (**Vitest + SQLite Nativo ACID + Express Backend + Angular 21 Standalone**).

---

## 2. PIRÂMIDE DE TESTES E SUÍTES AUTOMATIZADAS

### 2.1 Cobertura de Testes Automatizados no Repositório

| Nível / Escopo | Arquivo de Teste | Descrição do Teste | Status |
| :--- | :--- | :--- | :--- |
| **E2E Tri-Persona** | `src/server/db/tri-persona-platform-e2e.spec.ts` | Validação completa cruzando HQ -> OS Operacional -> Cliente | **100% PASS** |
| **E2E Full Lifecycle** | `src/server/db/full-lifecycle-e2e.spec.ts` | Boot limpo, provisionamento, venda, billing, reinicialização e recuperação | **100% PASS** |
| **Boot & Restart** | `src/server/db/central-boot-integrity.spec.ts` | Migrações atômicas (1 a 8), idempotência de boot e integridade de SQLite | **100% PASS** |
| **Isolamento de Tenants** | `src/server/db/security-leakage.spec.ts` | Prevenção de vazamento entre empresas (IDOR, header injection, cross-access) | **100% PASS** |
| **Auditoria e ACID** | `src/server/db/audit-remediation.spec.ts` | SEC-001 (MFA), SEC-002 (CRM), SEC-003 (Auto-link) e DATA-001 (Double discount prevention) | **100% PASS** |
| **3eatcru ID & CRM** | `src/server/db/customer-identity.spec.ts` | Separação entre identidade global do cliente e CRM privado de cada empresa | **100% PASS** |
| **Sincronização Atômica** | `src/server/db/sync-public-space.spec.ts` | Unit of work atômica via batch sync sem corrupção de estado | **100% PASS** |
| **Segurança de Fronteira** | `src/server/server-security.spec.ts` | 29 testes cobrindo rate limit, assinaturas HMAC e permissões RBAC | **100% PASS** |
| **Pagamentos & TEF/PIX** | `src/app/core/payment/payment.service.spec.ts` | Intents de pagamento, idempotência, autorização TEF, QR Code PIX e estorno | **100% PASS** |
| **Offline-First Sync** | `src/app/core/sync/sync.service.spec.ts` | Enfileiramento em outbox local, leases de crash recovery e resolução de conflitos | **100% PASS** |
| **App Runtime & Sandboxing**| `src/app/core/app-runtime/app-access.service.spec.ts`| Validação granular de permissões, semver e dependências entre aplicativos | **100% PASS** |

---

## 3. ROTEIRO DE TESTES POR PERSONA

---

### PERSPECTIVA 1: CLIENTE (Consumidor Londrinense / Marketplace & Vitrine)

#### Objetivo
Garantir que um consumidor de Londrina consiga descobrir empresas, consultar cardápios e vitrines de produtos, criar pedidos online com delivery local, realizar pagamento transparente e acompanhar o pedido sem vazamento de dados.

```text
[CONSUMIDOR]
    │
    ├── 1.1 Acesso ao Marketplace Londrina (Busca de empresas no Paraná)
    ├── 1.2 Cadastro e Login no 3eatcru ID (Credenciais criptografadas)
    ├── 1.3 Navegação no Espaço Público / Vitrine Virtual (Restaurante ou Varejo)
    ├── 1.4 Adição ao Carrinho de Compras com cálculo de frete
    ├── 1.5 Checkout com PIX Dinâmico ou Cartão de Crédito
    ├── 1.6 Acompanhamento de Pedido (PENDING -> PREPARING -> DISPATCHED -> DELIVERED)
    └── 1.7 Histórico em "Meus Pedidos" com isolamento e privacidade estrita
```

#### Casos de Teste do Cliente
* **TC-CLI-01 [3eatcru ID]:** Cadastro com e-mail e senha forte. O sistema deve gerar hash seguro (PBKDF2/Argon2) e emitir token JWT assinado restrito ao plano `CUSTOMER`.
* **TC-CLI-02 [Isolamento de Privilégio]:** O token de consumidor deve ser terminantemente rejeitado ao tentar acessar endpoints operacionais (`/sync/batch`, `/companies/:id/config`).
* **TC-CLI-03 [Descoberta de Lojas]:** Requisição pública para `/api/v1/public-space/slug/:slug` deve retornar dados da vitrine, horário de funcionamento e produtos ativos sem exigir autenticação.
* **TC-CLI-04 [Submissão de Pedido]:** Criação de pedido delivery para endereço em Londrina (ex: Av. Higienópolis, Centro, Gleba Palhano) com itens do catálogo e chave PIX Copia-e-Cola gerada com o valor exato.
* **TC-CLI-05 [Privacidade do Cliente (SEC-002)]:** Ao consultar `/api/v1/customer/activity`, o cliente só deve visualizar os seus próprios pedidos. Nenhuma anotação privada de CRM de empresas ou dados de outros clientes podem ser expostos.

---

### PERSPECTIVA 2: USUÁRIO DO OS (Empresa / Operador / Caixa / Garçom / Gerente)

#### Objetivo
Garantir que a operação comercial da empresa em Londrina funcione perfeitamente tanto no modo **Varejo** quanto no modo **Restaurante**, com a interface de Desktop DEsk (nogueira e latão) e suporte total a contingência offline com sincronização segura.

```text
[OPERADOR / EMPRESA]
    │
    ├── 2.1 Autenticação Operacional (Token / PIN scoped ao Tenant e Filial)
    ├── 2.2 Seleção do Modo de Sistema (Varejo vs Restaurante & Suítes de Apps)
    ├── 2.3 Caixa Diário (Abertura de Turno com Suprimento e Fechamento com Conferência)
    ├── 2.4 PDV Varejo (Venda Rápida de Balcão, Impostos, Estoque Atômico)
    ├── 2.5 Módulo de Restaurante (Abertura de Mesas, KDS de Cozinha, Divisão de Conta)
    ├── 2.6 Estoque & Ledger (Saldo em Tempo Real, Movimentações e Auditoria)
    └── 2.7 Modo Offline-First (Fila Outbox transacionada, idempotência e re-envio seguro)
```

#### Casos de Teste do Usuário do OS
* **TC-OS-01 [Controle de Filiais (Branch Scoping)]:** Operador vinculado à `Filial Centro` não pode abrir caixa ou registrar vendas na `Filial Gleba Palhano`.
* **TC-OS-02 [Abertura e Fechamento de Caixa]:** Registro de sessão de caixa com operador, data/hora e fundo de troco. No fechamento, validação entre o total registrado no sistema e o valor físico apurado pelo operador.
* **TC-OS-03 [Venda PDV & Baixa de Estoque]:** Venda de 2 unidades do produto X deve decrementar o estoque imediatamente de 50 para 48 e criar lançamento no razão de vendas.
* **TC-OS-04 [Idempotência Absoluta (DATA-001)]:** Se a conexão oscilar e o PDV reenviar a mesma venda (mesmo `idempotencyKey` ou `saleId`), o servidor deve responder `DUPLICATE` e **JAMAIS** realizar duplo desconto de estoque.
* **TC-OS-05 [Mesas e KDS de Restaurante]:** Mesa 04 aberta, comanda com itens enviada para produção na cozinha, atualização de status e fechamento com emissão de extrato.
* **TC-OS-06 [Experiência Visual DEsk]:** Alternância estética entre modo Linux Plasma moderno e DEsk Físico Skeuomórfico (painéis de nogueira, latão tátil, janelas em papel sulfite e luminária de banqueiro regulável).

---

### PERSPECTIVA 3: HQ (Centro de Controle Administrativo da Plataforma)

#### Objetivo
Garantir o controle operacional central de todo o ecossistema de Londrina e expansão estadual pela diretoria do 3eatcru.

```text
[HQ ADMINISTRADOR]
    │
    ├── 3.1 Autenticação Segura (MFA Obrigatório, Proteção Anti-Brute Force)
    ├── 3.2 Dashboard Central (Métricas em Tempo Real de Londrina: GMV, Pedidos, Tenants)
    ├── 3.3 Gestão de Empresas / Tenants (Provisionamento, Suspensão, Multi-unidades)
    ├── 3.4 Gestão de Filiais e Dispositivos (Pareamento de Terminais e Certificados)
    ├── 3.5 Faturamento & Billing (Planos Comerciais, Ledger Imutável de Créditos)
    ├── 3.6 Telemetria & Observabilidade (Saúde dos Nós, Uso de CPU/Memória, Latência)
    ├── 3.7 Dev Hub & Releases do OS (Canais Stable/Beta e Rollout Gradual de Versões)
    └── 3.8 Auditoria Global Centralizada (Trilha Forense Imutável de Ações Administrativas)
```

#### Casos de Teste do HQ
* **TC-HQ-01 [Autenticação HQ & MFA (SEC-001)]:** Login administrativo exige senha e segundo fator TOTP. Em modo de produção, ausência de MFA deve abortar o acesso.
* **TC-HQ-02 [Provisionamento de Tenant]:** Criação de empresa com plano Enterprise, definição de filiais (Centro e Gleba Palhano) e inicialização automática dos apps licenciados.
* **TC-HQ-03 [Billing Ledger Imutável]:** Toda cobrança ou crédito lançado para uma empresa deve ser gravado de forma estritamente append-only na tabela `company_ledger`, preservando o histórico para auditoria fiscal.
* **TC-HQ-04 [Sessão de Suporte Auditada]:** Se um operador HQ precisar acessar a conta de uma empresa para prestar suporte técnico, deve utilizar token temporário com `authPlane: 'SUPPORT'` e `actingAs: companyId`. Ações globais de administração ficam bloqueadas durante a sessão de suporte.
* **TC-HQ-05 [Telemetria e Health]:** Monitoramento em tempo real do banco SQLite, contagem de tenants ativos e integridade do processo Express.

---

## 4. MATRIZ DE RASTREABILIDADE DE REQUISITOS (ESPECIFICAÇÃO -> TESTE)

| Requisito do Documento de Pré-Produção | Módulo do OS | Mecanismo de Validação | Teste Automatizado |
| :--- | :--- | :--- | :--- |
| **Seção 10: Autorização Granular** | OS Core | RBAC por Role + Permissões + Filial | `app-access.service.spec.ts`, `server-security.spec.ts` |
| **Seção 11: Multi-Tenancy Isolado** | OS Core | Validação estrita de contexto no backend | `security-leakage.spec.ts`, `tri-persona-platform-e2e.spec.ts` |
| **Seção 17: Estoque Centralizado** | Business Core | Saldo atômico e ledger de movimentação | `tri-persona-platform-e2e.spec.ts`, `os-inventory.repository.spec.ts` |
| **Seção 18 & 19: PDV & Caixa** | Módulos | Sessão de turno, suprimento e sangria | `tri-persona-platform-e2e.spec.ts`, `os-pos.repository.spec.ts` |
| **Seção 25 & 26: Marketplace & Loja** | Plataforma | Catálogo por slug e 3eatcru ID | `tri-persona-platform-e2e.spec.ts`, `customer-identity.spec.ts` |
| **Seção 29: Pagamentos Abstratos** | OS Core | PIX, TEF e Cartão com Idempotency | `payment.service.spec.ts` |
| **Seção 33 & 34: Offline-First** | OS Core | Outbox local, leases e ACID replay | `sync.service.spec.ts`, `tri-persona-platform-e2e.spec.ts` |
| **Seção 39 & 40: HQ Dashboard** | HQ | Métricas, billing ledger e telemetria | `full-lifecycle-e2e.spec.ts`, `tri-persona-platform-e2e.spec.ts` |

---

## 5. ROTEIRO DE HOMOLOGAÇÃO MANUAL EM PRODUÇÃO / STAGING (LONDRINA)

Para testes manuais no navegador via interface gráfica:

### 1. Fluxo do Cliente
1. Acesse o Marketplace ou Espaço Público: `/marketplace` ou `/public-space/bistro-londrina`
2. Crie sua conta no **3eatcru ID** ou faça login.
3. Adicione produtos locais ao carrinho e selecione o tipo de entrega.
4. Conclua o checkout via **PIX** ou **Cartão**.
5. Abra o painel **Meus Pedidos** para acompanhar a evolução do status em tempo real.

### 2. Fluxo da Empresa / Usuário do OS
1. Acesse a área operacional do OS: `/os`
2. Escolha o ambiente visual preferido (Moderno Linux ou Físico DEsk em nogueira).
3. Abra o app **PDV**: inicie o turno com valor de fundo de caixa.
4. Realize vendas com pagamento em dinheiro ou cartão e verifique a baixa instantânea no app **Estoque**.
5. Se for restaurante, utilize o app **Mesas** e acompanhe os pedidos no painel **KDS de Cozinha**.
6. Simule contingência offline desativando a rede; verifique o acúmulo na bandeja de sincronização e a sincronização automática ao restabelecer a conexão.
7. Finalize o turno com o fechamento de caixa e emissão do resumo diário.

### 3. Fluxo do Administrador HQ
1. Acesse a Central de Controle: `/hq`
2. Entre com as credenciais administrativas (com verificação de segundo fator).
3. Monitore o painel de **Tenants de Londrina**, faturamento acumulado e alertas de saúde.
4. Ajuste limites operacionais ou instale novos aplicativos na empresa conforme necessário.
5. Inspecione o registro de **Auditoria Central** para assegurar a rastreabilidade das operações.

---

## 6. CRITÉRIO DE CONCLUSÃO DO TESTE
A plataforma está formalmente validada de ponta a ponta com **zero testes quebrados**, **zero falhas de concorrência ou integridade relacional** e **total conformidade com as regras de negócio de pré-produção do 3eatcru Business OS**.
