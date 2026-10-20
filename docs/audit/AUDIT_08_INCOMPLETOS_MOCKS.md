# AUDIT_08_INCOMPLETOS_MOCKS — Funções Simuladas e Implementações Incompletas

**Data da Auditoria:** 19 de Outubro de 2026  
**Auditor:** Principal Software Engineer & Senior System Auditor  
**Escopo:** Mocks, Dados Simulados, TODOs/FIXMEs e Diferença entre Simulação e Realidade.  
**Status:** Concluído com análise estática detalhada.

---

## 1. Classificação de Mocks e Simulações

No desenvolvimento de um sistema operacional de terminais (PDV, Balança, Gaveta de Dinheiro), é comum haver emulação de hardware para navegadores web comuns. No entanto, essas emulações devem ser explicitamente sinalizadas como virtuais para evitar falsos relatórios de operação física bem-sucedida.

---

## 2. Achados Detalhados

### [MOCK-001] Status Inicial Falsamente 'Online' de Periféricos Físicos de Hardware
- **Severidade:** Média
- **Prioridade:** P2
- **Confiança:** Confirmada estaticamente
- **Categoria:** Hardware / Simulação Não Declarada na UI
- **Arquivo:** `/src/app/core/hardware/hardware.service.ts`
- **Linhas:** 34-40
- **Evidência:**
  ```typescript
  private registeredPeripherals = signal<Peripheral[]>([
    { id: 'prn_01', name: 'Impressora Térmica Bematech 4200 (ESC/POS)', type: 'printer', status: 'online', port: 'USB001' },
    { id: 'scn_01', name: 'Leitor de Código de Barras Honeywell Xenon', type: 'scanner', status: 'online', port: 'COM3' },
    { id: 'drw_01', name: 'Gaveta Automática de Dinheiro Menno', type: 'cash_drawer', status: 'online', port: 'RJ12' },
    { id: 'scl_01', name: 'Balança Digital Toledo Prix 3 Fit', type: 'scale', status: 'online', port: 'COM1' },
    { id: 'dsp_01', name: 'Display de Cliente LCD 2x20 VFD', type: 'customer_display', status: 'online', port: 'COM2' }
  ]);
  ```
- **Condição de Ocorrência:** O operador abre a tela de Diagnósticos ou o PDV em um navegador padrão sem nenhuma impressora ou balança física conectada.
- **Resultado Atual:** O painel indica que a impressora térmica, balança Toledo, leitor e gaveta automática estão todos com status verde `online` e portas atribuídas (`USB001`, `COM1`, `RJ12`).
- **Resultado Esperado:** O status inicial deve ser `offline` ou `simulated_sandbox`. Somente após a detecção bem-sucedida via WebSerial, WebUSB ou Host Bridge nativo (`window.__3EATCRU_NATIVE_BRIDGE__`) o status deve ser promovido para `online`.
- **Impacto:** Falsa sensação de prontidão de hardware físico no terminal.
- **Status:** Aberto.

---

### [MOCK-002] Auto-Seed Condicional Exclusivo para Tenant de Demonstração
- **Severidade:** Informativa
- **Prioridade:** P4
- **Confiança:** Confirmada estaticamente
- **Arquivos:**
  - `/src/app/apps/pos/infrastructure/os-pos.repository.ts` (linhas 23-26)
  - `/src/app/apps/inventory/infrastructure/os-inventory.repository.ts` (linhas 29-32)
- **Evidência:**
  ```typescript
  // Seed conditionally: only auto-seed for the developer sandbox/demo workspace ('comp_1')
  if (companyId !== 'comp_1') {
    return [];
  }
  ```
- **Avaliação:** **Comportamento Correto**. O auto-seed que anteriormente vazava produtos fictícios em novos tenants foi isolado estritamente para o identificador `'comp_1'`. Novos tenants provisionados em produção iniciam com catálogo vazio.
- **Status:** Validado.
