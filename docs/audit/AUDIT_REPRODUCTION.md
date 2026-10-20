# AUDIT_REPRODUCTION — Guia de Reprodução dos Achados Críticos

**Data:** 19 de Outubro de 2026  
**Auditor:** Principal Software Engineer & Senior System Auditor  
**Objetivo:** Permitir a qualquer engenheiro reproduzir os achados de forma determinística em ambiente local isolado.

---

## 1. Reprodução de DATA-001 (Falha Crítica em `saveCentralState()`)

### Pré-requisitos
- Node.js v20.17+
- Dependências instaladas (`npm install`)

### Passos de Execução
```bash
npx vitest run src/server/db/audit-remediation.spec.ts -t "should decrement stock once on initial sale"
```

### Comportamento Observado
O teste falha com status 500:
```text
Error: firstRes status 500: <!DOCTYPE html>...<pre>Error: Falha de persistência grave: O banco de dados central (SQLite) não pôde ser gravado em disco.
    at saveCentralState (/app/applet/src/server/state.ts:910:11)
    at /app/applet/src/server/routes/sync.ts:667:7
```

### Causa-Raiz Comprovada
1. `audit-remediation.spec.ts:493-504` insere entidades parciais em `centralState.appEntitlements` sem colunas obrigatórias do SQLite (`pricing_model`, `amount`, `created_at`).
2. `sync.ts:667` executa `saveCentralState()`, que chama `centralDatabase.persistState(centralState)`.
3. O SQLite rejeita a inserção com `NOT NULL constraint failed: app_entitlements.pricing_model`.
4. `saveCentralState` captura o erro e lança exceção com status de persistência grave, convertendo uma requisição bem-sucedida em HTTP 500.

---

## 2. Reprodução de ARCH-003 (Quebra de Lint)

### Passos de Execução
```bash
npm run lint
```

### Comportamento Observado
O comando encerra com código de saída `1` e lista 7 violações:
- `/src/server/db/audit-remediation.spec.ts`: linha 586 (`@typescript-eslint/no-explicit-any`), linha 589 (`@typescript-eslint/no-unused-vars`).
- `/src/server/db/tri-persona-platform-e2e.spec.ts`: linhas 11, 12, 15, 31, 178 (`no-unused-vars` e `no-explicit-any`).

---

## 3. Reprodução de TEN-001 (Bloqueio do Operador em `/products`)

### Passos de Execução
1. Efetuar login como operador (`role: 'operator'`) em qualquer empresa ativa.
2. Com o token obtido, emitir requisição REST:
```bash
curl -X GET http://localhost:4000/api/v1/products \
  -H "Authorization: Bearer <TOKEN_OPERADOR>"
```

### Comportamento Observado
Retorno `HTTP 403 Forbidden`:
```json
{
  "error": "Permissão negada. Requer um dos seguintes perfis: admin, manager"
}
```

### Comportamento Esperado
O operador deve conseguir ler o catálogo de produtos para operar o PDV em modo conectado diretamente.

---

## 4. Reprodução de SEC-002 e SEC-003 (Rate Limiting e Idempotência Voláteis)

### Passos de Execução
1. Realizar 15 requisições de criação de pedido para `POST /api/v1/public-space/orders` a partir de um IP de teste.
2. A 16ª requisição retorna `HTTP 429 Too Many Requests`.
3. Reiniciar o servidor Node (`kill -SIGHUP` ou restart do processo).
4. Emitir novamente a requisição imediatamente a partir do mesmo IP.

### Comportamento Observado
A requisição é aceita com sucesso (`HTTP 200/201`), demonstrando que o limitador e o cache de idempotência residem exclusivamente em memória RAM e foram zerados pelo reinício.
