# Auditoria, Blindagem e Aprimoramento do Runtime OS

Plano de auditoria, correção e evolução estrutural do subsistema de execução e ciclo de vida do **3eatcru OS** (Runtime Plane). Foca no isolamento estrito de sandbox para aplicativos via `OsContext`, execução contínua de tarefas em background com telemetria ativa de CPU, sincronização unificada de processos com o Gerenciador de Tarefas e suíte automatizada de testes de integridade.

---

## Decisões Críticas e Revisão do Usuário

> [!IMPORTANT]
> As decisões de requisitos foram alinhadas na Fase 1 com as seguintes diretrizes confirmadas:

- **Foco Prioritário Confirmado**: **Ciclo de vida e isolamento total do sandbox dos aplicativos**. O `OsContext` atua como barreira intransponível entre os apps e o Kernel, garantindo que nenhum app acesse storage ou eventos de outros tenants ou bypass de infraestrutura.
- **Gestão de Background & Minimização Confirmada**: **Manter execução contínua com monitoramento de taxa de CPU**. Aplicativos minimizados continuam operando (processamento de fila, recepção de webhooks/pedidos e escuta de eventos), com monitoramento em tempo real de consumo de CPU e alertas proativos contra picos anômalos.
- **Estratégia de Validação Confirmada**: **Criar suíte completa de testes de integridade do runtime no Vitest**, validando ciclos de vida (`init`, `pause`, `resume`, `crash`, `restart`), tolerância a falhas, isolamento de namespaces e supervisão contínua de processos.

---

## 1. Visão Geral & Conceito Central

- **O que faz**: O subsistema **Runtime OS** gerencia a instanciação dinâmica, sandbox de segurança, isolamento multitenant, barramento de eventos e ciclo de vida de todos os aplicativos do 3eatcru OS (PDV, Estoque, CRM, Mesas/KDS, Financeiro e Canais de Mensageria), além de supervisionar os serviços de background do Kernel.
- **Público-Alvo**: Operadores de caixa, garçons, gerentes de estoque e desenvolvedores de módulos de negócio do ecossistema.
- **Proposta de Valor**: Garante que falhas ou lentidão em um aplicativo isolado nunca congelem o terminal do operador nem vazem dados entre empresas/filiais, mantendo a estação de trabalho 100% resiliente a quedas de rede e reinicializações repentinas.

---

## 2. Experiência do Usuário & Design Visual

### Fluxos Principais do Operador
1. **Lançamento Isolado de Aplicativos**: Ao clicar em um ícone na Área de Trabalho ou Menu Iniciar, o `AppRuntimeHost` instancia o módulo dentro de um container isolado injetando seu `OsContext` determinístico.
2. **Minimização com Telemetria Ativa**: Ao minimizar uma janela (ex: PDV ou Sincronizador de Pedidos iFood), o app entra em modo de observabilidade contínua. Ele não é congelado; continua ouvindo eventos e processando tarefas em background enquanto o `ProcessManagerService` audita seu consumo de CPU e batimentos cardíacos (`heartbeats`).
3. **Inspeção no Gerenciador de Tarefas (Task Manager)**: O operador pode abrir o Gerenciador de Tarefas (`Alt + T`) e visualizar o consumo real em percentual de CPU tabular (`tabular-nums font-mono`), uso de memória e tempo de atividade (`uptime`), com opção de forçar encerramento limpo (`Finalizar Tarefa`) com liberação imediata de periféricos e subscrições.
4. **Recuperação Automática contra Falhas (Self-Healing)**: Se um app disparar uma exceção não tratada, o runtime intercepta a falha, preserva a sessão do OS, notifica o operador através de um carimbo tátil suave e aplica a política de reinicialização configurada (`on_failure` com até 3 retentativas).

### Diretrizes Visuais & Padrões Estéticos (DEsk & Bento Grid)
- **Interface do Gerenciador de Tarefas**: Tabela de alta densidade ($36\text{px}$–$44\text{px}$ por linha), tipografia com serifa moderada nos títulos e algarismos monoespaçados tabulares (`font-mono tabular-nums`) para evitar trepidações visuais.
- **Indicadores de Consumo de Recursos**:
  - *Carga Normal (< 5% CPU)*: Verde esmeralda suave (`#10b981`), sem pulsações decorativas.
  - *Carga Moderada (5% - 25% CPU)*: Âmbar clássico (`#f59e0b`).
  - *Carga Crítica / Anômala (> 25% CPU)*: Vermelho carmim (`#ef4444`) com badge de diagnóstico.
- **Zero-Pill Discipline**: Metadados de PID, tipo de serviço e status renderizados como texto limpo separado por barras e pontos médios (`·`), sem cápsulas flutuantes artificiais.

---

## 3. Decisões do Produto & Trade-offs

- **Decisão 1: Execução Contínua em Background vs. Pausa / Congelamento de Estado**
  - *Abordagem*: Aplicativos minimizados continuam ativos com monitoramento dinâmico de CPU e limites de tolerância.
  - *Motivo*: Em operações comerciais reais (restaurantes e varejo), o PDV e os canais de entrega (iFood, WhatsApp) não podem parar de escutar novos pedidos ou sincronizar cupons fiscais só porque a janela foi minimizada.
  - *Alternativa descartada*: Congelar a thread do app ao minimizar (causaria atrasos graves no recebimento de pedidos do marketplace).
- **Decisão 2: Centralização de Processos entre WindowManager e ProcessManager**
  - *Abordagem*: O `WindowManagerService` notifica o `ProcessManagerService` na criação, minimização, foco e destruição de cada janela de app, registrando um processo formal de aplicativo (`type: 'app_instance'`) com PID único.
  - *Motivo*: Elimina a discrepância em que o Gerenciador de Tarefas lia janelas de um lado e serviços de sistema de outro.
- **Decisão 3: Isolamento Hermético do Storage (`storageNamespace`)**
  - *Abordagem*: Toda operação de banco de dados do app passa obrigatoriamente pelo namespace criptografado/prefixado `tenant.[companyId].app.[appId]`.
  - *Motivo*: Impede que qualquer vulnerabilidade no código de um app terceirizado permita a leitura de dados de faturamento, estoque ou clientes de outro tenant.

---

## 4. Arquitetura Técnica & Estrutura de Componentes

### Diagrama Arquitetural do Runtime OS

```
┌────────────────────────────────────────────────────────────────────────┐
│                          3eatcru OS Shell                              │
│                                                                        │
│   ┌────────────────────────┐            ┌───────────────────────────┐  │
│   │  WindowManagerService  │            │    Task Manager App       │  │
│   │ (Janelas, Z-Index, Min)│            │  (CPU %, RAM, Heartbeats) │  │
│   └───────────┬────────────┘            └─────────────▲─────────────┘  │
│               │                                       │                │
│               ▼                                       │                │
│   ┌───────────────────────────────────────────────────┴─────────────┐  │
│   │                      ProcessManagerService                      │  │
│   │  • Tabela Unificada de Processos (Kernel Daemons + User Apps)   │  │
│   │  • Heartbeat Watchdog & Monitor Contínuo de CPU / Background    │  │
│   │  • Gerenciador de Encerramento Seguro (SIGTERM / SIGKILL)       │  │
│   └───────────────────────────▲─────────────────────────────────────┘  │
│                               │                                        │
│   ┌───────────────────────────┴─────────────────────────────────────┐  │
│   │                       AppRuntimeService                         │  │
│   │  • Validação de Permissões (AppAccessService & Capabilities)    │  │
│   │  • Construção de Sandbox Hermético (OsContext)                  │  │
│   │  • Ciclo de Vida (onAppInit, onAppPause, onAppResume, Destroy)  │  │
│   │  • Políticas de Reinicialização Automática (Self-Healing)       │  │
│   └───────────────────────────┬─────────────────────────────────────┘  │
│                               │                                        │
│               ┌───────────────┴───────────────┐                        │
│               ▼                               ▼                        │
│   ┌───────────────────────┐       ┌───────────────────────┐            │
│   │ AppRuntimeHost (PID 1)│       │ AppRuntimeHost (PID 2)│            │
│   │   [PDV / Varejo]      │       │   [Mesas / KDS]       │            │
│   │  ┌─────────────────┐  │       │  ┌─────────────────┐  │            │
│   │  │ OsContext (App1)│  │       │  │ OsContext (App2)│  │            │
│   │  └─────────────────┘  │       │  └─────────────────┘  │            │
│   └───────────────────────┘       └───────────────────────┘            │
└────────────────────────────────────────────────────────────────────────┘
```

### Mapeamento das Ações e Componentes

1. **`AppRuntimeService` (`src/app/core/app-runtime/app-runtime.service.ts`)**:
   - Reforçar o registro de PIDs e instâncias sincronizadas com o `ProcessManagerService`.
   - Garantir que `cleanupAppSubscriptions` cancele 100% dos listeners do `EventBus` e tarefas pendentes no encerramento.
   - Prover rastreador de uso de CPU simulado/ativo com base na frequência de eventos e tarefas em segundo plano.
2. **`ProcessManagerService` (`src/app/core/app-runtime/process-manager.service.ts`)**:
   - Integrar processos de aplicativos abertos dinamicamente junto aos serviços nativos de Kernel.
   - Adicionar monitoramento em background contínuo: se o app estiver minimizado, mantém o status `running_background`, calculando consumo de CPU e alertando sobre picos anômalos.
   - Expor métodos granulares para `killProcess`, `restartProcess` e `getMetricsSummary`.
3. **`AppRuntimeHostComponent` (`src/app/core/app-runtime/app-runtime-host.component.ts`)**:
   - Garantir propagação correta dos hooks `onAppInit`, `onAppPause`, `onAppResume` e `onAppDestroy`.
   - Registrar no `ProcessManagerService` o início da execução do app ao inicializar o componente dinâmico.
4. **`TaskManagerComponent` (`src/app/ui/os/apps/task-manager/task-manager.component.ts`)**:
   - Consumir diretamente a tabela unificada do `ProcessManagerService` para exibir processos de apps e daemons do kernel com métricas dinâmicas reais.
5. **Suíte Automatizada de Testes de Integridade do Runtime (`src/server/db/runtime-lifecycle-integrity.spec.ts`)**:
   - Validar em Vitest:
     - Isolamento rigoroso de namespaces de storage entre dois tenants executando o mesmo app.
     - Ciclo de vida completo: inicialização -> minimização (background ativo) -> restauração -> encerramento.
     - Detecção de crash de processo e acionamento de auto-restart com limite de retentativas.
     - Liberação completa de recursos (desinscrição de barramento e periféricos) após `terminateApp`.

---

## 5. Plano de Execução em Fases

1. **Fase 1: Enrijecimento do Sandbox e Isolamento do `OsContext`**
   - Auditar injeções e garantir que todas as capacidades de hardware, rede, eventos e storage respeitem os limites do tenant e do app.
   - Assegurar desacoplamento e limpeza de memória após o encerramento.
2. **Fase 2: Supervisão Contínua e Monitoramento de CPU no `ProcessManagerService`**
   - Unificar a listagem de daemons de sistema e instâncias de apps no `ProcessManagerService`.
   - Implementar cálculo dinâmico de taxa de CPU e consumo de memória para apps em primeiro e segundo plano.
3. **Fase 3: Sincronização com o `TaskManager` e Feedback Visual**
   - Conectar o Gerenciador de Tarefas ao fluxo unificado de processos.
   - Formatar indicadores com numerais tabulares e status sem pills.
4. **Fase 4: Construção da Suíte de Testes Automatizados no Vitest & Compilação**
   - Criar `src/server/db/runtime-lifecycle-integrity.spec.ts` com validação de 100% dos requisitos combinados.
   - Executar `npm test`, `ng lint` e `compile_applet` para assegurar que o ecossistema mantenha 100% de integridade e aprovação.
