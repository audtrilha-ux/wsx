# AUDIT_11_QUALIDADE_TESTES — Auditoria da Suíte de Testes Automatizados

**Data da Auditoria:** 19 de Outubro de 2026  
**Auditor:** Principal Software Engineer & Senior System Auditor  
**Escopo:** Avaliação da Qualidade dos Testes, Assertividades Reais, Fragilidades de Mocks e Cobertura Negativa.  
**Status:** Concluído com evidências de execução.

---

## 1. Avaliação da Suíte Existente

A suíte de testes de backend contém 14 arquivos e 79 casos de teste.
Diferente de projetos típicos com asserções superficiais ou mocks triviais, a suíte do 3eatcru OS se destaca por:
1. **Instâncias Reais de Banco SQLite:** Quase todos os testes utilizam uma instância real de SQLite (`node:sqlite`) em memória ou arquivo descartável com migrações 1 a 8 executadas do zero.
2. **Servidores HTTP Reais:** Os testes sobem instâncias reais do Express (`app.listen(0)`) e emitem chamadas HTTP via `fetch()` real com headers `Authorization` e validações de cookie.
3. **Testes E2E Tri-Persona:** O arquivo `tri-persona-platform-e2e.spec.ts` (14 testes) cobre toda a jornada cruzada:
   - Persona Consumidor (Marketplace, Cadastro 3eatcru ID, Checkout).
   - Persona Terminal OS (PDV, Estoque, Sincronismo).
   - Persona HQ (Aprovação de Licenças, Billing, Auditoria).

---

## 2. Fragilidades Identificadas na Própria Suíte de Testes

### [TEST-001] Fragilidade de Mocks Parciais em Testes de Integração com Banco Real
- **Severidade:** Alta
- **Prioridade:** P1
- **Confiança:** Confirmada por Execução
- **Arquivo:** `/src/server/db/audit-remediation.spec.ts`
- **Linhas:** 493-504
- **Evidência:**
  ```typescript
  centralState.appEntitlements.set(`${companyId}:app_pos`, {
    companyId,
    appId: 'app_pos',
    status: 'ACTIVE',
    activatedAt: new Date().toISOString()
  });
  ```
- **Diagnóstico:**
  O teste tentou configurar em memória uma licença de app mockando apenas os campos que o use case imediato exigia (`companyId`, `appId`, `status`).
  No entanto, o sistema subjacente possui persistência relacional com schema rígido no SQLite (`app_entitlements` requer `id`, `pricing_model`, `amount`, `created_at`).
  Quando a rota `/sync/batch` invocou a persistência geral `saveCentralState()`, o mock parcial causou a quebra do teste com `HTTP 500`.
- **Lição Aprendida:** Em testes de integração que acionam rotinas de salvamento relacional, todos os fixtures em memória devem respeitar estritamente o contrato de esquema de banco de dados (`schema.ts`).

---

### [TEST-002] Omissão dos Testes de Componentes e Serviços Angular no Script Padrão
- **Severidade:** Alta
- **Prioridade:** P1
- **Confiança:** Confirmada estaticamente
- **Arquivo:** `/package.json`
- **Impacto:** Os testes existentes do frontend (`os-finance.repository.spec.ts`, `os-inventory.repository.spec.ts`, `os-pos.repository.spec.ts`, `app-registry.service.spec.ts`, `process-manager.service.spec.ts`, etc.) não estão sendo executados na esteira regular.
- **Recomendação:** Configurar runner unificado ou comando de CI que execute tanto a suíte do servidor (Vitest) quanto a suíte do Angular (`ng test --watch=false`).
