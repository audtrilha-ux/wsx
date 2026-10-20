# AUDIT_09_INTEGRACOES — Integrações Externas e Hardware

**Data da Auditoria:** 19 de Outubro de 2026  
**Auditor:** Principal Software Engineer & Senior System Auditor  
**Escopo:** Integrações Externas (iFood, WhatsApp, Telegram), Gateways de Pagamento (Webhooks com HMAC) e Periféricos de Ponto de Venda.  
**Status:** Concluído com análise detalhada de contratos.

---

## 1. Mapeamento das Integrações

O 3eatcru OS possui suporte a integrações de mensageria, delivery e comunicação de periféricos:
1. **iFood (`/src/app/apps/ifood/`):** Feed de pedidos de delivery e chaveamento de status da loja (aberta/fechada).
2. **WhatsApp (`/src/app/apps/whatsapp/`):** Leitura de QR Code, templates de mensagens transacionais e logs de envio.
3. **Telegram (`/src/app/apps/telegram/`):** Configuração de bot token, chat ID de alertas do estabelecimento e feed de notificações operacionais.
4. **Gateways de Pagamento / Webhooks (`/src/server/middleware.ts:236-272`):** Validação criptográfica de webhooks de pagamento.

---

## 2. Achados de Integrações

### [INT-001] Validação de Assinatura HMAC de Webhook de Pagamento com `timingSafeEqual`
- **Status da Validação:** **Validado e Aprovado**.
- **Evidência:** `src/server/middleware.ts:236-272` (`requirePaymentGatewaySignature`).
- O middleware captura `req.rawBody` preservado como Buffer no middleware JSON inicial (`server.ts:37`), calcula o HMAC-SHA256 usando a chave secreta `PAYMENT_GATEWAY_SECRET`, e executa comparação em tempo constante com `crypto.timingSafeEqual` para mitigar ataques de temporização. Se a variável `PAYMENT_GATEWAY_SECRET` estiver ausente no servidor, a rota falha fechada com `HTTP 500`.

---

### [INT-002] Impressão Térmica ESC/POS em Navegadores Web Comuns
- **Severidade:** Baixa
- **Prioridade:** P3
- **Confiança:** Confirmada estaticamente
- **Arquivo:** `/src/app/core/printing/printer.service.ts`
- **Condição de Ocorrência:** Quando a impressão de comprovante é acionada sem o `window.__3EATCRU_NATIVE_BRIDGE__` presente.
- **Resultado Atual:** O serviço gera a sequência de bytes ESC/POS e, na ausência de WebUSB/WebSerial autorizados, invoca o diálogo nativo do navegador (`window.print()`) ou gera um iframe oculto.
- **Impacto:** O comprovante não corta a guilhotina automaticamente sem o bridge nativo do sistema operacional hospedeiro.
- **Status:** Validado como comportamento esperado de fallback web.
