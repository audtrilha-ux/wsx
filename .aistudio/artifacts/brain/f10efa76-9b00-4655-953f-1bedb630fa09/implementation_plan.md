# Modos Operacionais Varejo & Restaurante com Tema DEsk Skeuomórfico

Plano para estruturação definitiva dos dois modos operacionais do 3eatcru OS (Varejo e Restaurantes) com aplicativos pré-instalados dedicados, seleção via configurações do sistema e barra rápida, imersão estética completa baseada no tema físico DEsk (fyzugx/DEsk) e consolidação da documentação técnica e de agentes.

## Decisões Críticas e Revisão do Usuário

> [!IMPORTANT]
> As decisões de requisitos foram alinhadas na Fase 1 com as seguintes diretrizes confirmadas:

- **Seleção de Modo**: Configuração em nível de aplicativo acessível tanto no Painel de Controle (Configurações) quanto no menu rápido/bandeja do sistema (Quick Settings), permitindo alternância instantânea com recarregamento da suíte operacional sem perder dados de sessão.
- **Suíte Pré-Instalada - Modo Varejo (Retail)**:
  - *PDV / Ponto de Venda (POS)*: Frente de caixa ágil com leitura de código de barras e balança comercial.
  - *Gestão de Estoque (Inventory)*: Controle de produtos, inventário físico e ficha de movimentação.
  - *Gestão de Relacionamento (CRM)*: Fidelização, histórico de compras e cadastro unificado de clientes.
  - *Bot Telegram (Telegram Bot)*: Notificações instantâneas de fechamento de caixa e alertas operacionais.
  - *Utilitários do Sistema*: Calculadora física, Explorador de Arquivos, Docs & Especificações, Diagnóstico & Telemetria e Configurações.
- **Suíte Pré-Instalada - Modo Restaurantes (Restaurant)**:
  - *Salão & Mesas / KDS (Kitchen Display System)*: Mapa de mesas interativo, divisão de comandas e visualizador de pedidos de cozinha.
  - *Financeiro & Sessões de Caixa (Finance)*: Fluxo de caixa de turnos, contas a pagar/receber e conciliação bancária.
  - *PDV / Ponto de Venda (POS)*: Emissão rápida de pedidos de balcão e take-away.
  - *Gestão de Estoque (Inventory)*: Gestão de insumos, ficha técnica e quebra de ingredientes.
  - *Canais Integrados*: iFood Delivery e WhatsApp bot disponíveis para operação gastronômica.
  - *Utilitários do Sistema*: Calculadora física, Explorador de Arquivos, Docs & Especificações, Diagnóstico & Telemetria e Configurações.
- **Estética Física DEsk (fyzugx/DEsk)**: Evolução do skeuomorfismo tátil em todo o ecossistema: janelas em formato de folha de papel com textura e relevo (`desk-paper-sheet`), dock inferior estilizado como gaveteiro de madeira nobre com puxadores de latão (`desk-drawer` & `desk-brass-plate`), abajur de banqueiro clássico com iluminação cônica suave (`desk-lamp-raytrace`), feltro/couro de escrivaninha (`desk-leather-blotter`) e botões com relevo tátil e carimbos administrativos.

---

## 1. Visão Geral & Conceito Central

- **O que faz**: O 3eatcru OS adapta sua área de trabalho, menu iniciar, atalhos rápidos e aplicativos pré-carregados conforme o segmento do operador: **Varejo** (foco em giro de produtos, leitor, balança, clientes e alertas) ou **Restaurantes** (foco em salão, comandas, KDS de cozinha, turnos de caixa e entregas delivery).
- **Público-Alvo**: Pequenos e médios varejistas (mercados, confecções, ferragens, cosméticos) e empresários do ramo alimentício (restaurantes, bares, cafeterias, hamburguerias, lanchonetes).
- **Proposta de Valor**: Elimina o ruído operacional entregando exatamente as ferramentas necessárias para cada setor já abertas ou em destaque na mesa de trabalho, mantendo consistência de dados locais, sincronização outbox offline-first e um ambiente visual elegante e nostálgico que torna a operação prazerosa.

---

## 2. Experiência do Usuário & Design Visual (Tema DEsk)

### Fluxos Principais
1. **Alternância de Modo**: O operador acessa *Configurações > Perfil & Modo Operacional* ou clica no ícone de segmento na bandeja do sistema, alternando entre "Varejo" e "Restaurante".
2. **Reconfiguração Dinâmica da Área de Trabalho**: Ao alternar, o sistema:
   - Atualiza a lista de atalhos da área de trabalho imediatamente.
   - Reorganiza a grade de aplicativos do Menu Iniciar destacando a suíte do segmento selecionado.
   - Notifica o operador com um carimbo tátil e salva a preferência persistente.
   - Ajusta o dashboard do navegador local com atalhos de rotinas do segmento.
3. **Ambiente Físico Tátil (fyzugx/DEsk)**:
   - **Mesa de Carvalho/Nogueira**: Textura de madeira nobre profunda com veios sutis como plano de fundo padrão do OS.
   - **Janelas de Folha de Papel**: Bordas suaves, leve sombra de folha real, cabeçalhos estilizados como etiquetas de formulário de papel timbrado com rebites ou grampos decorativos sutis.
   - **Dock Gaveteiro de Madeira**: O painel inferior se transforma visualmente em uma gaveta de escrivaninha com frisos dourados de latão polido, ícones gravados e puxador central metálico.
   - **Lâmpada de Banqueiro (Banker's Lamp)**: Efeito de iluminação cônica dourada/esmeralda no topo da tela acionável via controle de iluminação ambiente.
   - **Elementos de Formulário Físicos**: Switches com sensação mecânica, botões em relevo como carimbos postais/fiscais e display fluorescente de vácuo (VFD) ou numerais tabulares nítidos.

---

## 3. Decisões do Produto & Trade-offs

- **Decisão 1: Persistência Híbrida do Modo Operacional (Local + Nuvem)**
  - *Abordagem*: O modo selecionado é gravado no `localStorage` do dispositivo para carregamento instantâneo offline e sincronizado no perfil da empresa (`company_segment`) via API/DB central.
  - *Motivo*: Garante inicialização em menos de 100ms sem depender de conexão de rede ou autenticação remota em PDVs autônomos.
- **Decisão 2: Coexistência de Apps vs. Exclusão Restritiva**
  - *Abordagem*: Todos os apps continuam registrados no catálogo mestre do sistema, mas apenas a suíte pré-instalada específica fica pinada no desktop, barra de tarefas e início rápido. Apps do outro segmento podem ser instalados opcionalmente caso a empresa tenha modelo misto (ex: cafeteria com loja de presentes).
  - *Motivo*: Flexibilidade operacional sem poluir a experiência padrão dos negócios puros.
- **Decisão 3: Skeuomorfismo com Performance e Acessibilidade**
  - *Abordagem*: Efeitos implementados através de CSS puro moderno (Tailwind v4, sombras multicamadas, gradientes lineares/radiais e backdrop-filter), sem bibliotecas pesadas de 3D, garantindo 60fps até em terminais compactos.

---

## 4. Arquitetura Técnica & Estrutura de Componentes

### Diagrama Arquitetural do Sistema

```
┌────────────────────────────────────────────────────────────────────────┐
│                          3eatcru OS Desktop                            │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                     Luminária de Banqueiro                       │  │
│  │                    (desk-lamp-raytrace)                          │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌─────────────────────────┐          ┌─────────────────────────────┐  │
│  │ Atalhos Área de Trabalho│          │     Janelas do Sistema      │  │
│  │   • Varejo: POS/Estoque/│          │      (Folha de Papel)       │  │
│  │     CRM/Telegram/Etc    │          │     [desk-paper-sheet]      │  │
│  │   • Restaurante: Mesas/ │          ├─────────────────────────────┤  │
│  │     KDS/Finanças/PDV    │          │  Barra de Título em Latão   │  │
│  └────────────▲────────────┘          │     [desk-brass-plate]      │  │
│               │                       └─────────────────────────────┘  │
│               │                                                        │
│  ┌────────────┴─────────────────────────────────────────────────────┐  │
│  │                    Dock Inferior / Gaveteiro                     │  │
│  │          [desk-drawer: Madeira Escura + Guarnições Latão]        │  │
│  │  [Menu Iniciar] [Apps Fixados do Modo] [Relógio] [Seletor Modo]  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                           Core OS Services                             │
│  ┌────────────────────────┐  ┌──────────────────────────────────────┐  │
│  │    OsProfileService    │  │       AppProfileRegistryService      │  │
│  │ (ActiveMode: Signal)   │◄─┤ (Retorna suíte Varejo ou Restaurante)│  │
│  └───────────┬────────────┘  └──────────────────────────────────────┘  │
│              ▼                                                         │
│  ┌────────────────────────┐  ┌──────────────────────────────────────┐  │
│  │  WindowManagerService  │  │          OsStateService              │  │
│  │ (Janelas ativas/z-index│  │ (Apps instalados, estado periféricos)│  │
│  └────────────────────────┘  └──────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### Mapeamento dos Arquivos a Serem Modificados/Criados

1. **Serviços de Perfil & Runtime**:
   - `src/app/core/os-profile/os-profile.service.ts`: Enriquecer com metadados dos perfis, eventos de troca de perfil e sincronismo com a configuração da empresa.
   - `src/app/core/app-runtime/app-profile-registry.service.ts`: Atualizar com as suítes exatas confirmadas (Varejo: POS, Inventory, CRM, Telegram; Restaurante: Tables/KDS, Finance, POS, Inventory).
   - `src/app/os-state.service.ts`: Garantir que os apps pré-instalados sejam vinculados ao perfil ativo no boot inicial.
2. **Componentes da Interface (UI Shell & Tema DEsk)**:
   - `src/styles.css`: Expandir as classes do tema DEsk (texturas de madeira realista, sombras de papel, guarnições metálicas de latão com bevel, puxadores de gaveta, fontes com serifa clássica e mono tabular).
   - `src/app/ui/os/os-shell.component.html` & `os-shell.component.ts`: Integrar seletor rápido de modo na bandeja do sistema, iluminação de escrivaninha e adaptação imediata de atalhos.
   - `src/app/ui/os/components/os-taskbar.component.ts`: Estilização skeuomórfica refinada da gaveta (dock) e botões de atalho com efeito tátil.
   - `src/app/ui/os/components/os-window-compositor.component.ts`: Aplicar o visual de folha de papel física e barra de latão em todas as janelas do sistema.
   - `src/app/ui/os/apps/settings/settings.component.ts` & `settings.component.html`: Adicionar controle visual para alternar o modo operacional (Varejo x Restaurante) com preview dos aplicativos pré-instalados de cada perfil.
3. **Documentação Técnica & Artefatos**:
   - `docs/ARCHITECTURE_BASELINE.md`: Documentar a arquitetura dos modos operacionais Varejo e Restaurantes.
   - `docs/ARCHITECTURE.md` & `docs/AGENTS.md`: Atualizar com as especificações dos novos fluxos e o tema DEsk.
   - `README.md`: Atualizar com o resumo das duas edições operacionais.

---

## 5. Plano de Execução em Fases

1. **Fase 1: Atualização dos Modelos e Registros do Sistema**
   - Configurar as suítes em `AppProfileRegistryService` e `OsProfileService`.
   - Garantir sincronização bi-direcional com o perfil local e o storage.
2. **Fase 2: Estilização Físico-Skeuomórfica DEsk**
   - Implementar os estilos estendidos de escrivaninha de madeira, folhas de papel, gavetas com puxadores e latão no `styles.css`.
   - Refatorar o cabeçalho e contêiner do compositor de janelas (`os-window-compositor`).
   - Aplicar acabamento nas barras de tarefas, menu iniciar e contexto de desktop.
3. **Fase 3: Seletor de Modo Operacional e UI de Configuração**
   - Integrar seletor interativo em `settings.component.html` e na bandeja de ações rápidas do `os-shell`.
   - Reagir dinamicamente atualizando a lista de atalhos do desktop e apps do Iniciar.
4. **Fase 4: Atualização de Documentação e Teste de Compilação**
   - Atualizar `ARCHITECTURE_BASELINE.md`, `ARCHITECTURE.md`, `AGENTS.md` e `README.md`.
   - Executar `compile_applet` para validação irrestrita de tipos e compilação do Angular.
