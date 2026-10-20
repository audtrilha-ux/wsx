# AUDIT_10_PRODUCAO — Desempenho, Operação e Prontidão de Produção

**Data da Auditoria:** 19 de Outubro de 2026  
**Auditor:** Principal Software Engineer & Senior System Auditor  
**Escopo:** Prontidão para Produção, Índices SQLite, Observabilidade, Health Checks e Configuração de Ambiente.  
**Status:** Concluído com evidências estáticas e de execução.

---

## 1. Avaliação de Prontidão de Produção (Production Readiness)

### 1.1 Health Checks e Observabilidade
O backend implementa três níveis de monitoramento de integridade em `src/server.ts:51-82`:
- `GET /health` / `GET /health/liveness`: Verifica se o processo Node está ativo e responde tempo de uptime.
- `GET /health/readiness`: Executa uma consulta real no SQLite (`centralDatabase.checkHealth()`). Se o banco estiver travado ou inacessível, retorna `HTTP 503 Service Unavailable`.
- `GET /api/v1/health`: Diagnóstico detalhado de contagem de empresas, produtos, vendas e apps carregados.

### 1.2 Índices do Banco de Dados
A migração 2 (`src/server/db/central-db.ts:600-675`) e a migração 7 aplicam índices essenciais para evitar Full Table Scans:
- `idx_sales_company ON sales(company_id)`
- `idx_products_company ON products(company_id)`
- `idx_finance_company ON finance_transactions(company_id)`
- `idx_tables_company ON tables_registry(company_id)`
- `idx_customers_company ON customers(company_id)`
- `idx_customer_accounts_email ON customer_accounts(email)` (Unique)
- `idx_rate_limits_key ON rate_limits(key)`

---

## 2. Achados de Produção e Operação

### [OPS-001] Script de Teste no `package.json` Oculta a Execução dos Testes do Frontend Angular
- **Severidade:** Média
- **Prioridade:** P2
- **Confiança:** Confirmada estaticamente
- **Arquivo:** `/package.json` (linha 10)
- **Evidência:**
  ```json
  "test": "vitest run src/server --no-file-parallelism"
  ```
- **Condição de Ocorrência:** Execução de `npm test` no terminal ou em pipelines de CI/CD.
- **Resultado Atual:** Apenas os 14 arquivos de teste do backend Node/Express são executados. Todos os testes unitários do frontend (`src/app/**/*.spec.ts`) são completamente ignorados.
- **Resultado Esperado:** Criar scripts separados: `"test:server": "vitest run src/server"` e `"test:client": "ng test --watch=false"`, ou combinar ambos em `"test"`.
- **Impacto:** Regressões no código do cliente Angular passam despercebidas durante `npm test`.
- **Status:** Aberto.

---

### [OPS-002] Ausência de Verificação Estrita de `PAYMENT_GATEWAY_SECRET` no Startup de Produção
- **Severidade:** Baixa
- **Prioridade:** P3
- **Confiança:** Confirmada estaticamente
- **Arquivo:** `/src/server.ts` (linhas 156-166)
- **Condição de Ocorrência:** Subida do servidor em `NODE_ENV=production` sem a variável `PAYMENT_GATEWAY_SECRET` configurada.
- **Resultado Atual:** O servidor sobe normalmente. Quando o gateway de pagamentos envia um webhook, a requisição falha com `HTTP 500: Configuração de segurança do gateway ausente no servidor` (`middleware.ts:246`).
- **Resultado Esperado:** Falhar durante a inicialização (Fail-Fast) se o serviço tiver integração de pagamento ativada.
- **Status:** Aberto.
