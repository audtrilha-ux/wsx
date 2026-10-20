# Matriz de Regressão Transversal — 3eatcru OS

Matriz de garantia da qualidade, segurança e conformidade arquitetural do ecossistema 3eatcru OS. Define os 15 cenários de teste transversal exigidos pelo Adendo Mestre de Engenharia, mapeando pré-condições, procedimentos de execução, resultados esperados e suites de validação automatizadas em Vitest.

---

## 1. Visão Geral da Matriz de Regressão

| # | Cenário Transversal | Camadas Afetadas | Severidade | Suite de Teste Automatizada |
| :--- | :--- | :--- | :--- | :--- |
| **01** | HQ administra empresa autorizada | B, C, D | Crítica | `src/server/db/ecosystem-regression.spec.ts` |
| **02** | Empresa A tenta acessar dados da empresa B | C, D, E | Crítica (Bloqueante) | `src/server/db/ecosystem-regression.spec.ts` |
| **03** | Proprietário administra seus funcionários | C, D | Alta | `src/server/db/ecosystem-regression.spec.ts` |
| **04** | Funcionário acessa apenas os recursos permitidos | D, E | Alta | `src/server/db/ecosystem-regression.spec.ts` |
| **05** | Usuário participa de mais de uma empresa sem contaminação | C, D | Média | `src/server/db/ecosystem-regression.spec.ts` |
| **06** | Cliente consumidor acessa somente os próprios dados | D, F | Alta | `src/server/db/customer-identity.spec.ts` |
| **07** | Cliente consulta dados públicos sem receber informações internas | E, F | Crítica | `src/server/db/ecosystem-regression.spec.ts` |
| **08** | Dispositivo fica offline e retorna à rede sem perda | E, H | Alta | `src/server/db/ecosystem-regression.spec.ts` |
| **09** | Usuário troca de empresa com operações pendentes | C, D, H | Média | `src/server/db/ecosystem-regression.spec.ts` |
| **10** | Venda sincronizada não repete efeitos (Idempotência) | E, H, A | Crítica | `src/server/db/ecosystem-regression.spec.ts` |
| **11** | Alteração de permissões aplicada imediatamente | D, E | Alta | `src/server/db/ecosystem-regression.spec.ts` |
| **12** | Empresa suspensa impedida de executar novas operações | B, C, E | Crítica (Bloqueante) | `src/server/db/ecosystem-regression.spec.ts` |
| **13** | Atualização de esquema (schema) não corrompe dados existentes | A | Alta | `src/server/db/legacy-migration-upgrade.spec.ts` |
| **14** | Integração externa falha e o sistema recupera estado com segurança | E, G | Média | `src/server/db/ecosystem-regression.spec.ts` |
| **15** | Reinicialização completa não perde registros confirmados | A, E, H | Crítica | `src/server/db/central-boot-integrity.spec.ts` |

---

## 2. Especificação Detalhada dos Cenários

### Cenário 01: HQ Administra Empresa Autorizada
- **Objetivo**: Garantir que administradores da HQ possam inspecionar, provisionar empresas, ajustar quotas e registrar logs de auditoria sem interrupções.
- **Pré-condições**: Usuário autenticado com token do plano `HQ` e role `superadmin` ou `hq_auditor`.
- **Procedimento**:
  1. Emitir token JWT com `authPlane: 'HQ'`.
  2. Executar `POST /api/v1/hq/tenants` com dados de uma nova empresa.
  3. Consultar `GET /api/v1/hq/tenants/:id` para validar persistência.
- **Resultado Esperado**: Código `200/201 OK`, criação da empresa no banco de dados e inserção de registro correspondente na tabela `hq_audit_logs`.

### Cenário 02: Empresa A Tenta Acessar Dados da Empresa B
- **Objetivo**: Comprovar a barreira hermética de isolamento multi-tenant (camada C).
- **Pré-condições**: Duas empresas distintas criadas no banco de dados (`company_alpha` e `company_beta`), cada uma com seus produtos e mesas.
- **Procedimento**:
  1. Usuário autenticado com credenciais da `company_alpha`.
  2. Tentar efetuar `GET /api/v1/products?companyId=company_beta`.
  3. Tentar efetuar `PUT /api/v1/tables/:tableId` pertencente à `company_beta`.
- **Resultado Esperado**: Retorno obrigatório de `403 Forbidden` ou lista restrita exclusivamente aos dados de `company_alpha`. Zero contaminação entre tenants.

### Cenário 03: Proprietário Administra Funcionários
- **Objetivo**: Garantir que o administrador de uma loja possa convidar e revogar operadores sem afetar outros estabelecimentos.
- **Pré-condições**: Usuário logado com role `ADMIN` na `company_alpha`.
- **Procedimento**:
  1. Chamar `POST /api/v1/companies/:id/users` com novo operador de caixa.
  2. Verificar listagem de usuários da empresa.
  3. Revogar permissão do operador.
- **Resultado Esperado**: Criação e revogação corretas na tabela `company_users`, restritas ao `companyId` do proprietário.

### Cenário 04: Funcionário Acessa Apenas Recursos Permitidos
- **Objetivo**: Garantir enforcement estrito de RBAC dentro do estabelecimento (camada D).
- **Pré-condições**: Operador com papel `CASHIER` ou `WAITER`.
- **Procedimento**:
  1. Operador realiza chamadas de abertura de comanda e registro de item.
  2. Operador tenta acessar rotas restritas de alteração de dados fiscais da empresa (`PUT /api/v1/companies/:id`).
- **Resultado Esperado**: Sucesso nas operações de PDV/comanda (`200 OK`) e bloqueio com `403 Forbidden` nas operações administrativas.

### Cenário 05: Usuário Participa de Mais de Uma Empresa Sem Mistura de Dados
- **Objetivo**: Assegurar que um mesmo profissional que trabalhe em dois comércios mantenha sessões isoladas.
- **Pré-condições**: Usuário cadastrado em `company_1` como Gerente e em `company_2` como Caixa.
- **Procedimento**:
  1. Obter JWT especificando `companyId: 'company_1'`.
  2. Obter JWT especificando `companyId: 'company_2'`.
  3. Executar consultas com cada token e verificar se os contextos retornados não se misturam.
- **Resultado Esperado**: Cada token reflete rigorosamente a empresa ativa selecionada no momento da emissão.

### Cenário 06: Cliente Acessa Somente os Próprios Dados
- **Objetivo**: Proteger o histórico de compras e informações pessoais do consumidor final no marketplace.
- **Pré-condições**: Dois clientes autenticados via 3eatcru ID (`customer_1` e `customer_2`).
- **Procedimento**:
  1. `customer_1` tenta consultar pedidos de `customer_2` via `/api/v1/customer/orders`.
- **Resultado Esperado**: Retorno estrito apenas dos pedidos de `customer_1`. Tentativa de acesso direto a ID de terceiro retorna `403 Forbidden`.

### Cenário 07: Cliente Consulta Dados Públicos sem Receber Informações Internas
- **Objetivo**: Impedir vazamento de dados estratégicos da empresa na vitrine pública (camadas E e F).
- **Pré-condições**: Produtos cadastrados com margem de lucro, custo do fornecedor e anotações internas.
- **Procedimento**:
  1. Fazer requisição desautenticada em `GET /api/v1/public-space/:slug/menu`.
- **Resultado Esperado**: Objeto JSON com nome, descrição, foto, categoria e preço de venda. Os campos `costPrice`, `margin`, `supplier` e `internalNotes` devem estar ausentes (`undefined`).

### Cenário 08: Dispositivo Fica Offline e Retorna à Rede
- **Objetivo**: Assegurar continuidade operacional local e envio posterior sem perda de dados (camada H).
- **Pré-condições**: Terminal operando desconectado da rede.
- **Procedimento**:
  1. Vendas gravadas localmente no IndexedDB com UUIDs gerados no cliente.
  2. Restabelecimento da conexão e envio do payload via `POST /api/v1/sync`.
- **Resultado Esperado**: Servidor valida e persiste vendas com código `200 OK`.

### Cenário 09: Usuário Troca de Empresa com Operações Pendentes
- **Objetivo**: Evitar que transações em fila local de uma empresa sejam enviadas com as credenciais de outra.
- **Pré-condições**: Fila offline com vendas gravadas sob `company_alpha`.
- **Procedimento**:
  1. Operador faz logout e faz login na `company_beta`.
  2. Dispositivo tenta descarregar a fila de sincronização.
- **Resultado Esperado**: O sincronizador valida o `companyId` da transação gravada no payload contra a sessão ativa, rejeitando itens cruzados.

### Cenário 10: Venda Sincronizada Não Repete Efeitos (Idempotência)
- **Objetivo**: Prevenir duplicação de faturamento e baixa duplicada de estoque em caso de retentativas na rede (camadas E, H e A).
- **Pré-condições**: Venda gerada com UUID `tx-e2e-idempotent-001`.
- **Procedimento**:
  1. Enviar lote de sincronização pela primeira vez.
  2. Simular timeout e reenviar exatamente o mesmo lote com mesmo UUID.
- **Resultado Esperado**: Primeiro envio insere a venda e movimenta estoque. Segundo envio retorna `200 OK` (ou `acknowledged: true`) e é descartado na tabela `idempotency_log` sem alterar o saldo financeiro ou de produtos.

### Cenário 11: Alteração de Permissões Aplicada Corretamente
- **Objetivo**: Garantir que a revogação de acessos de um funcionário invalide ações subsequentes imediatamente.
- **Pré-condições**: Operador com acesso ativo à empresa.
- **Procedimento**:
  1. Administrador altera status do usuário para inativo no banco.
  2. Operador tenta realizar chamada de API autenticada com token anterior.
- **Resultado Esperado**: Rejeição imediata com `401 Unauthorized` ou `403 Forbidden`.

### Cenário 12: Empresa Suspensa Não Continua Executando Operações
- **Objetivo**: Bloquear lojas inadimplentes ou suspensas pela central HQ (camadas B, C e E).
- **Pré-condições**: Empresa com status alterado para `SUSPENDED` pela HQ.
- **Procedimento**:
  1. Operador da empresa tenta lançar uma nova venda via `POST /api/v1/sales`.
  2. Cliente tenta realizar pedido na vitrine da empresa.
- **Resultado Esperado**: Resposta `403 Forbidden` informando suspensão do estabelecimento comercial.

### Cenário 13: Atualização de Esquema Não Corrompe Dados Existentes
- **Objetivo**: Preservar dados históricos durante migrações estruturais do banco de dados (camada A).
- **Pré-condições**: Banco com registros de versões anteriores.
- **Procedimento**:
  1. Executar rotinas de migração do Drizzle / SQLite.
  2. Validar integridade das tabelas `sales`, `products` e `company_ledger`.
- **Resultado Esperado**: Colunas novas adicionadas com valores padrão sem perda ou alteração dos registros preexistentes.

### Cenário 14: Integração Externa Falha e o Sistema Recupera o Estado
- **Objetivo**: Resiliência contra quedas de APIs de pagamento ou mensageria (camadas E e G).
- **Pré-condições**: Falha induzida (timeout ou 500) em webhook simulado.
- **Procedimento**:
  1. Tentativa de notificação WhatsApp durante emissão de comanda.
  2. Simular erro de rede no serviço externo.
- **Resultado Esperado**: A transação principal da comanda é confirmada e o evento de mensageria é enfileirado para retentativa assíncrona, sem abortar a venda.

### Cenário 15: Reinicialização Não Perde Registros Confirmados
- **Objetivo**: Assegurar integridade e durabilidade (ACID) após reboot do servidor ou da aplicação (camadas A e H).
- **Pré-condições**: Registro de vendas, turnos de caixa e logs de auditoria confirmados no banco de dados.
- **Procedimento**:
  1. Fechar conexão do SQLite via `centralDatabase.close()`.
  2. Reiniciar o processo e reinicializar o banco via `centralDatabase.init()`.
  3. Executar consultas de checagem em todas as tabelas.
- **Resultado Esperado**: 100% dos dados pré-reboot recuperados com integridade referencial intacta.
