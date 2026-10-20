# Padrões Proibidos (Forbidden Patterns)

A IA está ESTRITAMENTE PROIBIDA de implementar os seguintes padrões neste projeto:

1. **NÃO** criar novo sistema de login genérico (Autenticação do OS e HQ são separadas).
2. **NÃO** criar `AuthService` global que mistura permissões de Admin HQ com Usuário do OS.
3. **NÃO** duplicar repositories para a mesma entidade sem justificativa arquitetural.
4. **NÃO** colocar regra de negócio em componentes do Angular (`.ts` de UI). Regras pertencem ao `Domain` ou `Application`.
5. **NÃO** colocar lógica offline ou Sync Engine no cliente Web. O Web é estritamente Online.
6. **NÃO** importar infraestrutura (ex: `HttpClient`, `IndexedDB`) dentro de arquivos do diretório de Domínio.
7. **NÃO** criar rotas duplicadas para a mesma função.
8. **NÃO** utilizar mocks permanentes que finjam ser o backend real após a Fase de API ser estabelecida.
9. **NÃO** criar IA dentro de todos os módulos sem justificativa funcional estrita.
10. **NÃO** usar o Angular Router para gerenciar janelas simultâneas no Web OS. Use o WindowManager (State).
