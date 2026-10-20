# 3eatcru OS - Sistema Operacional Web para Todos os Tipos de Empresas

O **3eatcru OS** é uma plataforma e sistema operacional web moderno, reativo e tolerante a falhas projetado para todos os tipos de empresas, comércios e redes multifiliais. Ele implementa uma **Arquitetura Dual-OS** inovadora com alta performance e suporte nativo a operações offline-first.


### 12. Segurança, Governança e Isolamento de Tenants
* **RBAC Estrito (Role-Based Access Control)**: Controles granulares (`admin`, `manager`, `operator`) que definem acesso de alto nível e impedem elevação de privilégios.
* **Isolamento de Estado Multi-Tenant**: Divisão rigorosa por ID de empresa (`companyId`) e filial (`branchId`) com validação server-authoritative em todas as rotas e transações.
* **MFA TOTP & Credenciais de Produção**: Autenticação de dois fatores RFC 6238 para HQ Admins, com credenciais obrigatoriamente lidas de variáveis de ambiente (`HQ_ADMIN_PASSWORD` / `HQ_ADMIN_SECRET`) em produção.
* **Provisionamento Dinâmico de Instâncias**: Endpoint de criação de tenants (`POST /companies`) emitindo credenciais temporárias dinâmicas e auditadas (`bootstrapCredentials`).
* **Sessões Auditadas de Suporte (Impersonation)**: Acesso temporário por engenheiros da Central registrado em logs de auditoria (`SUPPORT_SESSION_STARTED` / `SUPPORT_SESSION_ENDED`).
* **Persistência Central Atômica & SQLite-First**: Armazenamento principal e autoridade única via SQLite (`central_platform.db`) com transações ACID rigorosas. O arquivo `central_store.json` atua estritamente como snapshot de backup secundário e export.
* **Outbox Resilience & Dead-Letter Queue**: Sincronização offline com 3 níveis de conectividade, backoff exponencial com jitter e isolamento em Dead-Letter Queue (`dead_letter`).

---

---

## 🏬 Edições Operacionais do Sistema (Varejo & Restaurantes)

O **3eatcru OS** disponibiliza dois modos de operação primários que adaptam a interface e os aplicativos pré-instalados com um clique:

1. **Modo Varejo & Comércio (`retail`)**:
   - **Suíte Pré-instalada**: PDV / Frente de Caixa com leitor e balança (`app_pos`), Controle de Estoque (`app_inventory`), Gestão de Clientes CRM (`app_crm`) e Alertas Telegram (`app_telegram`).
   - **Indicado para**: Lojas de varejo, minimercados, confecções, materiais de construção e comércio em geral.

2. **Modo Restaurantes & Gastronomia (`restaurant`)**:
   - **Suíte Pré-instalada**: Salão & Mesas / KDS Cozinha (`app_tables`), Financeiro & Fechamento de Caixa (`app_finance`), PDV Balcão (`app_pos`) e Estoque de Insumos (`app_inventory`).
   - **Canais Conectados**: Integração com delivery iFood e bot WhatsApp.
   - **Indicado para**: Restaurantes, bares, cafeterias, pizzarias e lanchonetes.

3. **Chaveamento Dinâmico**:
   - Alternância rápida na **Bandeja do Sistema (System Tray)**, na **Gaveta de Aplicativos (Taskbar)** ou no **Painel de Controle (Configurações)**, com atualização instantânea dos atalhos da área de trabalho e persistência offline.

---

## 🪵 Tema Físico Skeuomórfico DEsk (`fyzugx/DEsk` Inspired)

O sistema operacional incorpora o visual analógico e físico de escrivaninha de madeira nobre:
- **Bancada de Nogueira**: Textura de madeira realista com acabamento escuro sofisticado.
- **Janelas em Folhas de Papel (`desk-paper-sheet`)**: Cantos naturais, sobreposição de folhas e cabeçalho com frisos metálicos.
- **Barra de Tarefas em Gaveteiro (`desk-drawer`)**: Puxadores e parafusos de latão polido (`desk-brass-plate` e `desk-brass-screw`).
- **Luminária de Banqueiro (`desk-lamp-raytrace`)**: Iluminação cônica radial quente controlável pelo operador.
- **Carimbos de Validação (`desk-stamp-badge`)**: Selos fiscais e administrativos com efeito de tinta prensada.

---

## 🏛️ Arquitetura do Sistema

O ecossistema divide-se estritamente em duas camadas operacionais:

1. **HQ OS (Control Plane):** Painel administrativo centralizado para gestão da plataforma, tenants, faturamento, auditoria e governança de dados.
2. **Client OS (Runtime Plane):** Interface de desktop operacional estilo mesa física de trabalho, com barra de tarefas, menu iniciar, bandeja do sistema (system tray), gerenciamento de janelas e periféricos físicos (como impressoras térmicas de 80mm).

---

## 🚀 Principais Recursos e Módulos

### 1. Central de Documentação Local (Local Docs & Specifications Search)
* **Busca Conectada a Documentos:** Consulta local indexada por palavra-chave em tempo real em todas as especificações e contratos do ecossistema, com zero uso de APIs de IA.
* **Categorias de Pesquisa:** Filtros temáticos dedicados para buscas gerais, notícias atuais, desenvolvimento técnico/SaaS e indicadores financeiros nos documentos.
* **Renderizador Markdown Avançado:** Suporte completo para tabelas estilizadas, formatação de listas aninhadas, códigos inline, citações e hiperlinks externos.
* **Histórico e Favoritos (Bookmarks):** Persistência local reativa das últimas pesquisas e gerenciamento de marcadores salvos.
* **Autocomplete Reativo na Barra de Endereços:** Sugestões dinâmicas com bloqueio de blur seguro (200ms) para navegação fluida.
* **Impressão Térmica de Síntese:** Envio direto do resumo de pesquisas para o Spooler de Impressão do OS.
* **Resiliência e Fidelidade de Dados:** Sem alucinações de inteligência artificial ou dependências de conexão externa para pesquisa.

### 2. Gerenciador de Janelas de Alta Performance & Painel do Operador Bento
* **Layouts Automáticos:** Organização instantânea de janelas em Grade Lado a Lado (`Alt + G`) ou em Cascata Diagonal (`Alt + C`).
* **Auto-Ajuste Responsivo:** Algoritmo inteligente de calibração geométrica (`Alt + A`) para ajustar janelas ao viewport sem extravasar a área de trabalho.
* **Encaixe Lateral (Snap Zones):** Pré-visualizações visuais translúcidas de encaixe à esquerda ou à direita ao arrastar janelas até as bordas.
* **Miniaturas na Barra de Tarefas (Live Taskbar App Hover Preview Card):** Pré-visualizações flutuantes ao passar o cursor sobre as abas abertas da barra de tarefas.
* **Painel do Operador Bento Integrado**: Widget lateral estilo bento-grid com telemetria física (bobina de papel e conectividade), notas/memos persistentes por empresa e monitor detalhado de sincronização com feed de transações da Outbox e alertas de Dead-Letter Queue.
* **Botão Mostrar Área de Trabalho:** Atalho no canto inferior direito (`Alt + D`) para minimizar ou restaurar todas as janelas de uma só vez.

### 3. Gerenciador de Tarefas do Sistema (Task Manager)
* **Monitoramento de Processos em Execução:** Lista todas as janelas e aplicativos ativos com consumo simulado de CPU, memória (RAM) e PID, permitindo focar ou encerrar processos (`Finalizar Tarefa`).
* **Serviços do Kernel do OS:** Supervisão contínua de daemons e subsistemas essenciais (Kernel Bus, Window Compositor, Print Spooler Daemon, Sync Queue Daemon, Adaptive Auto-Fit Engine, Grounded AI Engine).
* **Painel de Desempenho e Telemetria em Tempo Real:** Medidores gráficos de carga de CPU e uso de memória com indicador de saúde do sistema, contadores de processos ativos e threads de background.
* **Atalho Rápido:** Inicie instantaneamente com `Alt + T` ou pelo menu de contexto na Área de Trabalho.

### 4. Menu Iniciar no Estilo Windows 10 (Tripartite Start Menu & Live Tiles)
* **Arquitetura Tripartida**:
  * **Trilho Lateral de Navegação (Navigation Rail)**: Barra expansível com botão hambúrguer, avatar e perfil do operador ativo, atalhos rápidos para Documentos, Imagens, Configurações e menu de energia (Bloquear Terminal, Reiniciar Ambiente e Encerrar Sessão).
  * **Diretório Alfabético de Aplicativos**: Seções para "Adicionados recentemente" (com badge visual de novidade), pastas colapsáveis do sistema ("Acessórios do Sistema" e "Ferramentas do Kernel") e catálogo em ordem alfabética agrupado por letras iniciais.
  * **Painel de Blocos Dinâmicos (Live Tiles)**: Grade interativa organizada em seções "Produtividade" e "Explorar", incluindo blocos largos (Wide Tile do PDV 365), Docs OS, CRM Fidelidade, Tarefas do OS com monitoramento de integridade, Inventário, App Store e Calculadora.
* **Pesquisa Integrada Instantânea**: Digitação rápida com filtragem reativa e opção de busca nos documentos locais do sistema operacional.
* **Layout Adaptativo para Mobile**: Alternância automática com abas de navegação em telas pequenas.

### 5. Calculadora Nativa do Sistema (Calculator App)
* **Operações Aritméticas e Avançadas**: Cálculos precisos com soma, subtração, multiplicação, divisão, porcentagem, raiz quadrada, potência quadrática e inversão de sinal.
* **Gerenciamento de Memória**: Funções dedicadas de memória padrão (`MC`, `MR`, `M+`, `M-`, `MS`).
* **Suporte Completo a Teclado Físico**: Aceita digitação direta de números, operadores (`+`, `-`, `*`, `/`), `Enter` para igual, `Backspace` para apagar e `Escape` para limpar.
* **Integração com o Gerenciador de Janelas**: Abre em janela redimensionável e móvel no OS.

### 6. Explorador de Arquivos Virtual Nativo (Este Computador)
* **Estrutura de Pastas e Navegação**: Árvore com pastas do sistema ("Documentos", "Downloads", "Recibos & Comprovantes", "Imagens", "Logs do Sistema", "Backups & Bancos de Dados") e criação de pastas personalizadas.
* **Modos de Exibição**: Alternância dinâmica entre Grade com ícones de alta resolução por extensão (`.txt`, `.json`, `.csv`, `.pdf`, `.log`, `.sql`, `.sqlite`) e Lista Detalhada com ordenação e metadados de tamanho e data.
* **Barra de Endereços com Breadcrumb**: Histórico de navegação (Voltar, Avançar, Subir nível) e caminho navegável em tempo real.
* **Gestão e Exportação**: Criação de novos arquivos com conteúdo inicial, exclusão de arquivos e download direto para o sistema operacional físico.
* **Visualizador & Impressão Térmica**: Modal de pré-visualização de texto/comprovantes com botão de impressão direta integrado ao spooler de 80mm (`PrinterService`).
* **Integração no Desktop e Menu Iniciar**: Atalho na Área de Trabalho ("Este Computador"), atalho no menu de contexto do desktop, no trilho de navegação lateral (Documentos e Imagens), no Live Tile do Menu Iniciar e pelo atalho global `Alt + E`.

### 7. Aplicativo Nativo de Diagnóstico & Telemetria do Kernel (Health Diagnostics)
* **Auditoria de Subsistemas**: Inspeção visual do estado operacional de cada subsistema (Core Kernel, App Runtime, Device Service, Spooler 80mm, Adapters IndexedDB, Server API, Fila Outbox).
* **Análise de Storage e Storage Namespaces**: Monitoramento de volumetria IndexedDB por namespace com contadores dinâmicos de entidades.
* **Fila Outbox Offline-First**: Visualização do status da fila de sincronização com controle para forçar o esvaziamento imediato (`SyncService.sync()`).
* **Testador de Periféricos & Hardware Loop**: Impressão de cupons de teste no Spooler 80mm e simulação de leitura em tempo real da balança digital RS232.
* **Console de Logs e Exportação**: Pesquisa e filtragem por nível de severidade (`info`, `warn`, `error`) com exportação direta para a pasta `/Logs do Sistema/` no Explorador de Arquivos.
* **Atalho Rápido**: Inicie com `Alt + H` ou pelo Menu de Contexto da Área de Trabalho.

### 8. Menu de Contexto da Área de Trabalho (Right-Click Context Menu)
* **Acesso Imediato pelo Botão Direito:** Clique com o botão direito na Área de Trabalho para acionar o menu contextual suspenso.
* **Ajustes Rápidos de Exibição:** Alterne o tamanho dos ícones do desktop (Pequeno, Normal, Grande).
* **Gerenciamento de Janelas e Workspace:** Comandos para Organizar em Grade (`Alt + G`), Organizar em Cascata (`Alt + C`), Auto-Ajustar à Tela (`Alt + A`) ou Mostrar Área de Trabalho (`Alt + D`).
* **Acesso a Utilitários do Sistema:** Lançamento rápido do Explorador de Arquivos (`Alt + E`), Diagnóstico do Sistema (`Alt + H`), Gerenciador de Tarefas (`Alt + T`), Docs OS (`Alt + S`), Painel de Controle e comando para Atualizar a Área de Trabalho.

### 9. Central de Atalhos de Teclado (HUD de Ajuda)
Pressione `Alt + /` ou clique no ícone de teclado na bandeja do sistema para abrir a Central de Atalhos:
* `Alt + E`: Abrir Explorador de Arquivos (Este Computador).
* `Alt + H`: Abrir Diagnóstico do Sistema & Telemetria.
* `Alt + S`: Abrir Docs OS / Central de Documentos.
* `Alt + T`: Abrir Gerenciador de Tarefas do OS.
* `Alt + Q` ou `Alt + Espaço`: Abrir Menu Iniciar no Estilo Windows 10.
* `Alt + N`: Abrir Flyout de Calendário e Central de Notificações.
* `Alt + D`: Mostrar Área de Trabalho (Minimizar/Restaurar tudo).
* `Alt + G`: Organizar Janelas em Grade Lado a Lado.
* `Alt + C`: Organizar Janelas em Cascata Diagonal.
* `Alt + A`: Auto-Ajustar e Recalibrar Janelas ao Viewport.
* `Alt + ◄ / ►`: Encaixar Janela ativa à Esquerda ou à Direita.
* `Alt + ▲ / ▼`: Maximizar ou Minimizar Janela ativa.
* `Alt + /`: Exibir/Ocultar Central de Atalhos.
* `ESC`: Fechar painéis flutuantes, menu iniciar, menu de contexto ou modais.

### 9. Central de Notificações e Calendário do Sistema (Flyout)
* **Relógio e Calendário Interativo:** Flyout elegante no estilo Windows/ChromeOS com relógio em tempo real, data por extenso e calendário mensal interativo.
* **Histórico Contínuo de Notificações:** Registro contínuo das últimas 30 notificações emitidas pelo OS, permitindo consultar e auditar mensagens anteriores com botão de limpeza rápida.
* **Badge Contador na Bandeja:** Indicador visual em tempo real na bandeja do sistema informando alertas pendentes ou arquivados.

### 10. Aplicativos de Negócios Conectados ao Kernel
* **PDV (Ponto de Venda):** Emissão de vendas, integração direta com clientes do CRM e controle transacional de estoque com despacho imediato para a fila outbox (`sale.create`).
* **Inventário:** Controle com transações atômicas ACID, sem permitir saldo negativo injustificado, sincronizado via `stock.item.save` e `stock.adjust`.
* **CRM:** Base soberana de clientes e fidelidade com histórico de compras e recálculo dinâmico de pontuação e tier (`customer.create` e `customer.points.adjust`).
* **Financeiro:** Balanço de fluxo de caixa, conciliação e transações registradas no outbox (`finance.transaction`).
* **Mesas / Restaurante:** Mapa visual de mesas, comandas e despacho atômico de fechamento (`sale.create`, `finance.transaction` e `table.close`).
* **Hubs de Canais:** Simuladores e integrações com WhatsApp, Telegram e delivery iFood.

### 11. Motor de Sincronização e Fila Outbox (Offline-First Enterprise Engine)
* **Protocolo Unificado de Sincronismo (`SyncAction`)**: Contratos canônicos estruturados entre todos os repositórios de domínio do OS e o backend central (`/api/v1/sync/batch`).
* **Pipeline de Transação Atômica Offline (`queueOperationTransacted`)**: Assegura a atomicidade indivisível das operações offline (gravação local ACID no SQLite + enfileiramento na Outbox + registro da intenção), mitigando falhas parciais por quebra de ciclo de energia ou interrupções físicas de processo.
* **Processamento Transacional no Servidor**: O servidor central processa cada lote atomicamente: deduz estoque, atualiza pontuação/tiers de clientes no CRM, reconcilia transações de caixa e conclui mesas.
* **Resiliência e Recuperação Automática**: Detecção reativa de eventos de rede (`online`/`offline`) para esvaziamento imediato da fila outbox assim que a conectividade é restabelecida.
* **Backoff Exponencial com Full Jitter**: Prevenção inteligente contra sobrecarga de servidores (*thundering herd problem*) através de dispersão aleatória controlada em falhas de requisição.

### 12. App Package Manager & Dynamic Runtime Loader
* **Desacoplamento de Instalações**: Transição completa do registro estático (`APP_REGISTRY`) para carregamento dinâmico via pacotes isolados (`AppPackage`) sem exigir recompilação do Kernel do OS.
* **Verificação de Integridade & Assinaturas (OTA)**: Mecanismo de hashing SHA-256 e verificação de SemVer para validar pacotes externos antes de executar seu carregamento dinâmico.
* **Host do Runtime em Sandbox (`AppRuntimeHostComponent`)**: Wrapper isolador que intercepta as interações do compositor de janelas do OS para disparar ganchos dinâmicos de ciclo de vida do aplicativo (`onAppInit`, `onAppPause`, `onAppResume`, `onAppDestroy`) e expõe as capacidades do sistema estritamente no sandbox `OsContext`.

### 13. HQ Central (Control Plane & Governança SaaS)
* **Magic Link & Impersonation de Suporte**: Acesso temporário seguro a instâncias de tenants para atendimento de suporte técnico (`hq_support_admin`) com banner de identificação e encerramento rápido.
* **Command Palette Global (`Alt + K`)**: Busca instantânea e atalhos globais para navegação ultrarrápida entre tenants, faturamento, catálogo de apps, releases do SO e Client OS.
* **Gerenciamento de Configurações do Tenant (`TenantConfigModalComponent`)**: Edição em tempo real de planos de licenciamento, limite de terminais, canal de atualização (Stable/Beta) e módulos instalados.
* **Governança Financeira & Faturamento Recorrente**: Motor de apuração mensal automatizada que processa débitos de assinaturas de módulos e suspende automaticamente tenants inadimplentes.
* **Gestão de Releases OTA & Rollback de Emergência**: Distribuição de versões do Core OS com suporte a canais e reversão instantânea para versão LTS.

### 14. Arquitetura Reativa por Sinais (Proibição de NgModel & Zoneless Compliance)
* **Eradicação do `ngModel`**: Substituição total de `FormsModule` por um fluxo reativo unidirecional alimentado por `signal()`, bindings `[value]` e captura atômica de eventos `(input)` e `(change)`.
* **Desempenho Zoneless de Alta Frequência**: Ausência de Zone.js com detecção de mudanças granulares impulsionadas por reatividade de Sinais Angular v21 no Client OS e HQ Central.

---

## 🛠️ Tecnologias Utilizadas

* **Framework Front-End:** Angular 21 (Zoneless, Signals, OnPush, Standalone Components, Reactive Forms).
* **Estilização:** Tailwind CSS v4 com padrão bento-grid de alto contraste e tipografia refinada.
* **Ícones:** Angular Material Icons (`@angular/material/icon`).
* **Servidor e API:** Node.js + Express com rotas centralizadas e middleware de autenticação.
* **Segurança e Isolamento:** Isolamento rigoroso por Tenant (`companyId` e `branchId`), mitigação de vulnerabilidades e Operator Lock de terminal.

---

## 📦 Comandos do Projeto

```bash
# Instalação de dependências
npm install

# Execução em desenvolvimento (dev server na porta 3000)
npm run dev

# Execução dos testes automatizados (95 testes cobrindo Client e Server)
npm test

# Verificação de qualidade estática (zero warnings exigido)
npm run lint

# Compilação para produção
npm run build
```
