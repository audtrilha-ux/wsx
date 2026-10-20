# AUDIT_04_PERSISTENCIA.md

## 1. Análise de Persistência (Refinada)
- **Status:** Validado.
- **Mecanismos:**
    - SQLite (`central-db.ts`) como fonte primária de autoridade (ACID + WAL).
    - Backup secundário em JSON (`central_store.json`) com sanção de segredos (MFA secrets).
    - `loadCentralState`: Implementa política *Fail-Closed* — se o SQLite contiver dados mas a hidratação falhar, o sistema interrompe a inicialização para evitar perda de dados.
    - Snapshot: Suporte para snapshots com carimbo de tempo para auditoria/recuperação.
- **Conclusão:** O sistema de persistência é resiliente e prioriza a integridade acima da disponibilidade em caso de falha grave.
