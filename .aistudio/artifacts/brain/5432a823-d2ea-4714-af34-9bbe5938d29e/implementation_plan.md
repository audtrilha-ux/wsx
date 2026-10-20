# Plano de Implementação: Modos Varejo e Restaurantes

## 1. Arquitetura de Perfis (OS Profiles)
- Criar `OsProfileService` para gerenciar o perfil atual:
  - `OsProfileType`: 'retail' | 'restaurant'
- Atualizar `AppRegistryService` para carregar o conjunto de aplicativos pré-instalados com base no perfil escolhido.

## 2. Atualização da Documentação
- Atualizar `/docs/ARCHITECTURE.md` para detalhar:
  - Definições dos perfis Varejo vs. Restaurantes.
  - Lista de aplicativos pré-instalados para cada modo.
  - Diferenças na interface do usuário (Widgets, Dashboards).

## 3. Integração do Tema DEsk (Continuação)
- Aplicar o tema skeuomórfico aos novos painéis de Varejo/Restaurantes.
- Estilizar widgets específicos de cada modo (ex: Dashboard de Vendas de Varejo vs. Comanda de Restaurante) com texturas amadeiradas e elementos de latão.

## 4. Configuração Inicial
- Adicionar lógica de inicialização no `OsShellComponent` para detectar ou definir o perfil do terminal na primeira execução.
