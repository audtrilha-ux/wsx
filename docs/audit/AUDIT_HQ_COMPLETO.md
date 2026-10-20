# Relatório Técnico de Auditoria Completa do Centro de Comando HQ

**Documento:** AUDIT_HQ_COMPLETO.md  
**Componente Auditado:** HQ Control Plane (Camada B) e interfaces com Camadas A, C, D e H  
**Data da Auditoria:** 19 de Outubro de 2026  
**Status Geral:** APROVADO COM RESSALVAS E MEDIDAS DE HARDENING IMPLEMENTADAS  

---

## 1. Sumário Executivo

A central de governança **HQ (Camada B)** do 3eatcru OS atua como a autoridade máxima do ecossistema, governando o ciclo de vida dos inquilinos (tenants), a autorização administrativa, o faturamento recorrente via SaaS, o catálogo de aplicativos e as releases do sistema operacional.

A hipótese investigada nesta auditoria era se inconsistências operacionais e comportamentos inesperados relatados em terminais de loja ou vitrines públicas teriam origem em falhas estruturais, vazamento de privilégios ou assincronia no centro de comando HQ.

### Veredito da Auditoria
A camada HQ possui uma base arquitetural sólida com controle estrito de RBAC, separação de planos de autenticação (`HQ`, `COMPANY`, `CUSTOMER`), isolamento de cookies HttpOnly (`3eatcru_hq_token`) e persistência transacional atômica no SQLite com Drizzle ORM. No entanto, foram identificados e corrigidos pontos críticos de fragilidade relacionados a:
1. **Tratamento de parâmetros opcionais em SQLite**: Parâmetros com valor `undefined` (como senhas em operadores que utilizam apenas PIN) geravam exceções no driver nativo `node:sqlite`. Corrigido com fallback seguro de hash aleatório.
2. **Duplicidade em ciclos de cobrança concorrentes**: Protegida via tabela persistente `idempotency_log` e transação serializada no SQLite.
3. **Barreira contra sessões de suporte**: Bloqueio ativo de sessões com flag `isImpersonating` de chamarem rotas globais da HQ.

---

## 2. Inventário de Superfície de Ataque e Rotas do HQ

| Rota / Endpoint | Método | Middleware de Proteção | Invariante Auditada | Status de Conformidade |
| :--- | :--- | :--- | :--- | :--- |
| `/api/v1/auth/login` | POST | `validateBody(LoginSchema)` | Autenticação Superadmin com verificação de senha bcrypt e MFA | **CONFORME** |
| `/api/v1/companies` | GET | `requireHqAdmin` | Listagem global com paginação obrigatória (`page`, `pageSize`) | **CONFORME** |
| `/api/v1/companies` | POST | `requireHqAdmin` | Provisionamento atômico de empresa, filial e adminUser | **CONFORME** |
| `/api/v1/companies/:id` | GET | `requireTenant` | Acesso restrito ao próprio inquilino ou superadmin | **CONFORME** |
| `/api/v1/companies/:id` | PUT | `requireTenantRole(['admin'])` | Inquilinos comuns impedidos de alterar planos, cotas ou saldo | **CONFORME** |
| `/api/v1/companies/:id/status` | PATCH | `requireHqAdmin` | Suspensão imediata propaga bloqueio para PDV e catálogo | **CONFORME** |
| `/api/v1/companies/:id/credit` | POST | `requireHqAdmin` | Injeção manual de crédito registra log em `company_ledger` | **CONFORME** |
| `/api/v1/companies/run-billing` | POST | `requireHqAdmin` | Ciclo recorrente calcula saldo e é idempotente por mês | **CONFORME** |
| `/api/v1/hq/catalog` | GET/POST | `requireHqAdmin` | Gestão de aplicativos disponíveis na Store | **CONFORME** |
| `/api/v1/hq/catalog/:id/releases`| POST | `requireHqAdmin` | Publicação com validação de versão SemVer crescente | **CONFORME** |
| `/api/v1/telemetry` | GET | `requireHqAdmin` | Métricas de saúde consolidadas dos inquilinos | **CONFORME** |
| `/api/v1/companies/snapshot` | POST | `requireHqAdmin` | Criação de ponto de restauração físico do banco SQLite | **CONFORME** |

---

## 3. Análise Detalhada dos Pilares do HQ

### 3.1. Autenticação, Sessões e Cookies HttpOnly
- **Mecanismo**: A rota `/api/v1/auth/login` emite um JWT assinado com segredo criptográfico `JWT_SECRET`. Se o usuário possui a role `hq_admin`, o cookie `3eatcru_hq_token` é injetado com atributos `HttpOnly`, `SameSite: Strict` e `Secure`.
- **Prevenção de Confusão de Sessões**: O middleware `requireAuth` analisa a rota solicitada. Se o caminho contiver `/hq`, ele lê prioritariamente o cookie `3eatcru_hq_token`. Rotas de loja usam `3eatcru_client_token`. Isso impede que um operador com sessão de caixa aberta no mesmo navegador adquira permissão na central HQ.

### 3.2. Sessões de Suporte e Impersonação
- **Vulnerabilidade Prevenida**: Um auditor ou atendente de suporte conectado para auxiliar uma loja específica não pode herdar privilégios de superadmin global.
- **Enforcement**: O middleware `requireHqAdmin` valida ativamente:
  ```ts
  if (req.user?.isImpersonating || req.user?.authPlane === 'SUPPORT') {
    res.status(403).json({ error: 'Permissão negada. Sessões de suporte não possuem acesso a rotas globais do HQ Control Plane.' });
    return;
  }
  ```

### 3.3. Ciclo de Vida do Inquilino e Suspensão em Cascata
- **Comportamento Validado**: Quando uma empresa tem o status alterado para `suspended` via `/api/v1/companies/:id/status`, a persistência no SQLite e no cache em memória é imediata.
- **Propagação de Efeito**:
  1. Operadores da loja recebem `403 Forbidden` (`Acesso negado. Sua licença corporativa está suspensa`) em rotas como `/products`, `/sales` e `/sync/batch`.
  2. Clientes acessando a vitrine pública recebem `403 Forbidden` (`Espaço público indisponível ou suspenso comercialmente`).

### 3.4. Motor de Faturamento SaaS Recorrente
- **Procedimento**: A chamada `POST /api/v1/companies/run-billing` processa o ciclo mensal (`YYYY-MM`).
- **Garantia de Idempotência**: O motor gera uma chave de concorrência baseada em `billing:${companyId}:${period}`. Uma segunda execução no mesmo mês ignora cobranças duplicadas, evitando débitos múltiplos no saldo do cliente.

---

## 4. Matriz de Conformidade e Testes de Validação

| ID do Teste | Descrição da Validação | Resultado Esperado | Execução |
| :--- | :--- | :--- | :--- |
| **TEST-HQ-01** | Tentativa de login Superadmin com credenciais incorretas | `401 Unauthorized` | **APROVADO** |
| **TEST-HQ-02** | Login Superadmin legítimo emite token com plano `HQ` | `200 OK` + JWT válido | **APROVADO** |
| **TEST-HQ-03** | Operador de loja chamando `/api/v1/companies` | `403 Forbidden` | **APROVADO** |
| **TEST-HQ-04** | Sessão de suporte (`isImpersonating: true`) chamando rota HQ | `403 Forbidden` | **APROVADO** |
| **TEST-HQ-05** | Provisionamento atômico de novo inquilino na HQ | `201 Created` + integridade FK | **APROVADO** |
| **TEST-HQ-06** | Suspensão de empresa na HQ bloqueia rotas operacionais | `403 Forbidden` em cascata | **APROVADO** |
| **TEST-HQ-07** | Injeção manual de crédito atualiza saldo e ledger | `200 OK` + balanço consistente | **APROVADO** |
| **TEST-HQ-08** | Execução dupla de faturamento mensal é idempotente | Débito aplicado apenas 1 vez | **APROVADO** |
| **TEST-HQ-09** | Publicação de nova release de aplicativo com validação SemVer | Rejeita versões retroativas | **APROVADO** |
| **TEST-HQ-10** | Snapshot e diagnóstico físico do SQLite | Criação de arquivo snapshot íntegro | **APROVADO** |

---

## 5. Recomendações e Conclusão

1. **A central HQ não é a causa dos erros de terminal de loja**: A auditoria comprovou que os mecanismos de governança e transações da HQ operam com integridade e rigor.
2. **Hardening Consolidado**: O tratamento de fallbacks de credenciais em SQLite e a validação estrita de planos de autenticação blindam o centro de comando contra efeitos colaterais no ecossistema.
3. **Monitoramento Contínuo**: A nova suite `src/server/db/hq-complete-audit.spec.ts` integra os testes contínuos do projeto, garantindo prevenção proativa contra regressões.
