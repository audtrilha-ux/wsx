# AUDIT_02_SEGURANCA.md

## 1. Vulnerabilidades de Dependências (Remediação)
- **Crítica (P0):** `piscina` (RCE).
    - *Plano:* Atualizar `@angular/build` para a versão mais recente que utilize a versão corrigida de `piscina`.
- **Alta (P1):** `braces`, `@angular/router`, `http-cache-semantics`, `source-map-js`.
    - *Plano:* Executar `npm audit fix --force` após atualização do `@angular/build` e revalidar a suíte de testes.

## 2. Auditoria de Segurança de Servidor
- **Status:** Validado.
- **Achados:**
    - `server.ts`: CSRF protection implemented (custom double-submit cookie).
    - `auth.ts`: Robustez confirmada.
    - `sales.ts`: Robustez confirmada.
