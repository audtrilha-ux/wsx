# 3EATCRU MASTER ARCHITECTURE - BLUEPRINT

**Platform First · Apps Second**
Versão: 2.0 | Status: Referência arquitetural | Data: 13 de setembro de 2026

Documento canônico completo disponível em: **[/ARCHITECTURE.md](/ARCHITECTURE.md)**

---

## 1. Princípio Fundamental
> **PLATFORM FIRST · APPS SECOND**

O OS/Platform funciona sem os aplicativos. Os aplicativos dependem do OS por meio de contratos e SDKs. O Core não conhece regras específicas de negócio. Esta é a Regra de Ouro da arquitetura.

## 2. Visão do Ecossistema e Dual-OS
```text
                        3EATCRU ECOSYSTEM
                               │
              ┌────────────────┴────────────────┐
              │                                 │
          HQ OS                            CLIENT OS
       Control Plane                     Runtime Plane
              │                                 │
          Central                          App Runtime
              │                                 │
              │                    ┌────────────┼────────────┐
              │                    │            │            │
              │                  APP A        APP B        APP C
              │
              └──────────── Ecosystem Services ────────────┐
                                                           │
                                                     WEB / NATIVE
                                                           │
                                          ┌────────────────┴────────────────┐
                                          │                                 │
                                        WEB                              NATIVE
                                          │                                 │
                                     API / HTTP                    IndexedDB / SQLite
                                          │                                 │
                                          └───────────── SYNC ──────────────┘
```

- **HQ OS (Control Plane)**: Administra a plataforma, tenants, IAM, faturamento, catálogo de apps, telemetria e Marketplace.
- **Client OS (Runtime Plane)**: Ambiente operacional do lojista (PDV, CRM, etc.), operando local-first com suporte a contingência e offline.
- **Central**: Barramento de serviços que conecta o Control Plane aos ambientes operacionais.

## 3. Port & Adapters (Camada de Contratos)
- `Core → Contracts → Adapters → Infraestrutura`
- O Core **nunca** importa adapters web ou nativo diretamente. A resolução ocorre por provider registry.
- Aplicativos consomem apenas `Contracts`/SDK do OS, nunca drivers ou infraestrutura diretamente.

## 4. Local-First, Outbox Transacional e Sync
- Outbox persistente em banco transacional (`pending`, `processing`, `failed`, `acknowledged`).
- Idempotency keys estáveis em toda operação.
- Remoção do item da outbox somente após ACK explícito do servidor.
- Estratégia de conflito híbrida por entidade (`append-only`, `last-write-wins`, `crdt`), declarada no manifest do app via `syncPolicy`.

## 5. Edições Operacionais & Tema Físico DEsk
- **Dois Modos Operacionais do Client OS**:
  - `retail` (Varejo & Comércio): Suíte pré-instalada de alta vazão — PDV (`app_pos`), Estoque (`app_inventory`), CRM Fidelidade (`app_crm`) e Notificações Telegram (`app_telegram`).
  - `restaurant` (Restaurantes & Gastronomia): Suíte pré-instalada de salão — Mesas & KDS Cozinha (`app_tables`), Financeiro & Fechamento de Caixa (`app_finance`), PDV Balcão (`app_pos`) e Estoque de Insumos (`app_inventory`), com conectores delivery (iFood/WhatsApp).
  - Gestão e alternância reativa via `OsProfileService` e `AppProfileRegistryService` sem chamadas bloqueantes.
- **Tema Físico Skeuomórfico DEsk (`fyzugx/DEsk` Inspired)**:
  - Balcão analógico em madeira nobre e couro, gaveteiro com puxadores e parafusos de latão, luminária verde de banqueiro radial quente e janelas em papel.

## 6. Regra de Ouro da Modificação
A IA nunca altera arquitetura fundamental sem validar contra os 25 pontos do Master Architecture e sem atualizar os documentos em `.ai/` e `AGENTS.md`.
