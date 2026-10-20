# AUDIT_00_INVENTARIO.md

## 1. Identificação do Projeto
- **Nome:** 3eatcru OS Remix Enterprise
- **Data da Auditoria:** 19 de Outubro de 2026
- **Estado Inicial:** Auditoria iniciada do zero.

## 2. Inventário de Arquivos e Tecnologias
- **Framework Frontend:** Angular 21 (Zoneless, AOT).
- **Backend:** Node.js, Express 5.1.0.
- **ORM:** Drizzle ORM 0.45.2.
- **Testes:** Vitest.
- **Configuração:** `package.json` (v0.0.0, mas dependências indicam v21+), `angular.json`.

## 3. Estrutura de Diretórios
- `src/app/`: Lógica de negócio da aplicação.
- `src/server/`: Lógica e rotas de backend.
- `docs/audit/`: Local reservado para a documentação desta auditoria.

## 4. Ferramentas Disponíveis
- `npm` scripts mapeados (`start`, `dev`, `build`, `test`, `lint`).
- `Vitest` para testes unitários/integração.
- `ESLint` para análise estática.

## 5. Próximos Passos
- Execução de testes (`npm test`) para verificar estado de reprodutibilidade.
- Análise estática com `lint`.
