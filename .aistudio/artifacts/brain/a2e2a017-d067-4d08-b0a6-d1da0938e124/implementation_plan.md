# Plano de Refatoração de Apps (CRM, Financeiro, iFood, Integrações)

## Objetivo
Refatorar e limpar o código dos aplicativos CRM, Financeiro, iFood e integrações (Telegram, WhatsApp), garantindo conformidade com os padrões do Angular 21+ (Zoneless, Signals, OnPush).

## Etapas Prioritárias

1.  **Auditoria e Estruturação**: 
    - Mapear componentes e rotas dos apps selecionados.
    - Analisar estado atual e dependências.

2.  **Refatoração por Aplicativo**:
    - **CRM**: Limpeza de lógica, migração para Signals, otimização de consultas.
    - **Financeiro**: Verificação de cálculos, tipagem, migração para Signals.
    - **iFood**: Refatoração de sincronização e processamento de pedidos.
    - **Integrações (Telegram/WhatsApp)**: Limpeza de handlers de eventos, melhoria na tratativa de erros e status.

3.  **Padronização**:
    - Renomeação de arquivos seguindo `nome.ts` (sem `.component`).
    - Implementação de `ChangeDetectionStrategy.OnPush`.
    - Substituição de `ngModel` (se houver) por Reactive Forms.
    - Uso de Signals para estado reativo.

4.  **Testes e Validação**:
    - Execução de testes de regressão após cada refatoração.
    - Compilação do applet para garantir integridade.

## Cronograma (Sequencial)
- Etapa 1: CRM & Financeiro
- Etapa 2: iFood & Integrações (Telegram/WhatsApp)
