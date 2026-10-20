# Auditoria e Correção do Marketplace (Fichário Comercial 3eatcru OS)

Plano arquitetural detalhado para sanar os defeitos de interface e bugs visuais identificados no Marketplace, bem como consolidar a integração bidirecional e eventos entre o Marketplace/Vitrine Pública e os módulos centrais do sistema (KDS/Mesas, WhatsApp, Telegram, CRM e Estoque).

---

## User Review & Critical Decisions

> [!IMPORTANT]
> **Decisões Confirmadas na Fase 1:**
> - **Foco Selecionado:** O usuário optou expressamente por resolver **(1) Melhorias de UI/UX e bugs visuais** e **(5) Problemas de integração com outros módulos do OS**.
> - **Estética Física Preservada:** Manteremos e refinaremos o tema físico-skeuomórfico DEsk (nogueira, latão, papel marfim e fichário), aplicando rigorosamente a disciplina *Zero-Pill*, numerais tabulares e contraste acessível sem clichês genéricos.

- **Ponto de Decisão 1: Acesso ao 3eatcru ID no Cabeçalho**  
  *Abordagem Proposta:* Inserir um botão de identidade táctil de latão na barra superior do Marketplace que exibe o estado de autenticação (se logado: nome do cliente e saldo de pontos de fidelidade; se anônimo: botão de acesso à Ficha 3ID com modal de login/registro).
- **Ponto de Decisão 2: Mesa Cartográfica & Resiliência**  
  *Abordagem Proposta:* Prover um container de fallback estilizado em pergaminho náutico vetorial interativo caso o Google Maps não possua chave ativa ou ocorra falha de rede, garantindo que o mapa nunca quebre e os estabelecimentos possam ser selecionados diretamente pelos alfinetes geodésicos.

---

## 1. Overview & Core Concept

- **O que faz:** O Marketplace do 3eatcru OS funciona como um grande diretório público descentralizado (o "Fichário Comercial") no qual clientes encontram empresas credenciadas da plataforma, filtram por raio geodésico em quilômetros reais, visualizam em modo Fichário (cartões marfim), Livro-Razão (tabela contábil) ou Mesa Cartográfica (radar geográfico), e realizam pedidos que se conectam diretamente à operação física da loja.
- **Público-Alvo:** Clientes finais (consumidores locais que compram em restaurantes, lojas de varejo e serviços credenciados) e gestores de lojas que dependem do ecossistema integrado.
- **Valor Principal:** Eliminar o isolamento entre a vitrine pública e o sistema de gestão interno: quando um cliente pede pelo marketplace, a comanda surge imediatamente no KDS da cozinha, emite alertas no WhatsApp do cliente e Telegram do gerente, desconta o estoque central e pontua no programa de fidelidade do 3ID.

---

## 2. User Experience & Visual Design

### 2.1. Top Bar Contract e Navegação Unificada
- **Zona 1 (Marca):** Logotipo em placa de latão gravada (`desk-brass-plate`) com tipografia serifada clássica: *"Fichário Comercial 3eatcru"*.
- **Zona 2 (Navegação & Modos):** Alternador táctil entre os modos de exibição (*Fichário*, *Livro-Razão*, *Mesa Cartográfica*) e atalho para o gaveteiro de fichas salvas.
- **Zona 3 (Ações & Identidade):**
  - **Botão 3ID (Consumidor):** Mostra chip de latão com o nome e pontos se autenticado, ou atalho "Entrar / 3ID" com ícone de credencial.
  - **Interruptor da Luminária de Banqueiro:** Corrente retrô para ligar/desligar a iluminação direcional raytraced.
  - **Gaveta do Balcão:** Acesso rápido às fichas comerciais favoritadas pelo cliente.

### 2.2. Disciplina Zero-Pill & Numerais Tabulares
- Eliminação de pills genéricas em favor de carimbos autênticos do fichário (`desk-stamp-badge`), selos de cera (`desk-wax-seal`) e etiquetas tipográficas com separadores elegantes (`·`).
- Aplicação de `tabular-nums` e `font-mono` em todos os valores monetários (R$), distâncias calculadas (km), notas de avaliação e telefones de contato.
- Ajuste das alturas dos cartões no grid para manter baselines uniformes e alinhamento visual rigoroso.

### 2.3. Resiliência da Mesa Cartográfica (Mapeamento Geodésico)
- Implementação de tratamento resiliente para o componente de mapa: caso o script externo do Google Maps demore ou esteja ausente, o sistema renderiza uma malha cartográfica em pergaminho com círculos concêntricos de raio e marcadores interativos clicáveis correspondentes às coordenadas geodésicas reais de São Paulo e região.

---

## 3. Key Product Decisions & Trade-Offs

- **Decisão 1: Propagação Unificada de Eventos Cross-Module**
  - *Abordagem:* Ao despachar um pedido no Marketplace (`/api/v1/public-space/orders`), o backend registra a transação atômica em SQLite e propaga `marketplace.order_created` com o payload completo. O KDS (`tables.ts`) recebe o pedido com áudio/toast de notificação, o WhatsApp registra a intenção de envio de comprovante e o Telegram Manager emite alerta operacional.
  - *Por que:* Evita que o marketplace seja uma ilha desacoplada dos apps do OS.
- **Decisão 2: Enriquecimento do Status Update no KDS**
  - *Abordagem:* No handler `updateOnlineOrderStatus` de `tables.ts`, incluir os metadados completos do pedido (`order`, `customerName`, `customerPhone`, `items`, `total`) ao publicar `marketplace.order_status_updated`.
  - *Por que:* O módulo WhatsApp precisa do número do destinatário e do nome do cliente para disparar as mensagens automáticas sem cair em valores nulos.
- **Decisão 3: Integração com o Telegram Manager Bot**
  - *Abordagem:* Adicionar o gatilho `alertOnMarketplaceOrder` nas configurações do bot Telegram (`telegram.ts`), registrando no feed de auditoria quando um novo pedido online entra na fila de produção.

---

## 4. Technical Architecture & Data Strategy

### 4.1. Diagrama de Integração do Ecossistema

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       3EATCRU MARKETPLACE (CLIENTE)                         │
│  - Cabeçalho com 3eatcru ID (Login/Registro/Pontos)                         │
│  - Fichário (Grid) / Livro-Razão (Tabela) / Mesa Cartográfica (Radar)       │
│  - Gaveta do Balcão (Fichas Salvas) & Sacola Pública                        │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ POST /api/v1/public-space/orders
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CENTRAL PLATFORM BACKEND                           │
│  - SQLite Transaction (centralDatabase.saveMarketplaceOrderTransaction)    │
│  - Dedução do Estoque Server-Authoritative                                  │
│  - Pontuação de Fidelidade no CRM (Customer Data)                           │
│  - Registro do Pedido (PublicOrderData) com Token Público Unguessable       │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ EventBus / Polling Sync
                 ┌─────────────────────┼─────────────────────┐
                 ▼                     ▼                     ▼
┌─────────────────────────┐ ┌───────────────────┐ ┌──────────────────────────┐
│   KDS & MESAS (FOOD)    │ │   WHATSAPP HUB    │ │   TELEGRAM MANAGER BOT   │
│ - Recebe pedido na fila │ │ - Dispara recibo  │ │ - Alerta de novo pedido  │
│ - Altera p/ PREPARING,  │ │   digital ao      │ │   online p/ os gerentes  │
│   READY e DELIVERING    │ │   cliente         │ │   da unidade             │
│ - Impressão de comanda  │ │ - Atualiza status │ │                          │
└─────────────────────────┘ └───────────────────┘ └──────────────────────────┘
```

### 4.2. Módulos & Arquivos Impactados

1. **`src/app/ui/marketplace/marketplace.component.html` & `.ts`:**
   - Adicionar o botão do **3eatcru ID** no topo do cabeçalho com estado visual dinâmico (não autenticado vs autenticado com pontos e avatar).
   - Aplicar o Top Bar Contract com 3 zonas equilibradas e responsividade total em telas móveis e desktop.
   - Refinar a Mesa Cartográfica com fallback resiliente para navegação por mapa caso o Google Maps esteja sem chave.
   - Garantir `tabular-nums` em todos os preços, notas e distâncias.
2. **`src/app/ui/marketplace/components/marketplace-search-header.component.ts`:**
   - Otimizar o alternador de visualização e filtros de categorias sem quebra de linhas.
3. **`src/app/apps/tables/ui/tables.ts`:**
   - Enriquecer o payload de `marketplace.order_status_updated` com o objeto completo do pedido para que o WhatsApp receba os dados de contato do cliente.
4. **`src/app/apps/telegram/telegram.ts` & `components/telegram-bot-config.component.ts`:**
   - Adicionar o ouvinte para `marketplace.order_created` e a opção de configuração `alertOnMarketplaceOrder: true`.
5. **`src/app/ui/public-space/components/public-space-cart-drawer.component.ts`:**
   - Garantir que a emissão de pedidos passe o `customerAccountId` se o cliente estiver autenticado no 3ID, garantindo pontuação automática no CRM.
6. **Suíte de Testes Automatizados no Vitest:**
   - Adicionar testes de integração para o ciclo de vida completo do pedido no marketplace, verificação de despacho para KDS, emissão de alertas no WhatsApp e no Telegram.
