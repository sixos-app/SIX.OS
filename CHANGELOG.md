# Changelog

Todas as mudanças relevantes do SIX.OS são registradas neste arquivo.

## [0.24.0] - 2026-08-04

### Adicionado

- Fundação de RBAC com cinco cargos, permissões versionadas e atribuição de cargo por usuário na migration `0003_rbac_foundation.sql`.
- Prévia visual da tela de login alinhada à identidade SIX, disponível com `?preview=login`.

### Observações

- A prévia de login não envia e-mails nem substitui o Cloudflare Access enquanto o teste público temporário estiver ativo.

## [0.23.4] - 2026-08-04

### Segurança

- Cloudflare Access temporariamente liberado para testes públicos por meio da política `SIX.OS — Teste público temporário`.
- Política restrita de Guilherme preservada para reativação após os testes.

## [0.23.3] - 2026-08-04

### Planejamento

- Roadmap priorizado para permissões, administração, projetos, biblioteca, missões, agenda, perfis, IA e feed.
- Integrações com Runrun.it, Google/Outlook Calendar e Slack movidas para a fase final.
- Estratégia de arquivos definida com Cloudflare R2 como origem e prova de conceito opcional para links compartilhados do MEGA.nz.

## [0.23.2] - 2026-08-04

### Segurança

- Cloudflare Access ativado para `six-os.pages.dev`, com política de acesso exclusiva para `six.guimell@gmail.com`.
- Usuário administrador inicial do D1 alinhado ao e-mail autorizado pelo Cloudflare Access.

## [0.23.1] - 2026-08-04

### Infraestrutura

- Banco Cloudflare D1 `six-os` criado, migrado e vinculado à produção do Cloudflare Pages pela variável `DB`.
- Dados iniciais versionados em migration para reproduzir a configuração do ambiente.

## [0.23.0] - 2026-08-04

### Adicionado

- Integração de sessão com Cloudflare Access para identificar a pessoa autenticada.
- Rotas D1 protegidas por organização e usuário autenticado via Cloudflare Access.

## [0.22.0] - 2026-08-04

### Alterado

- Analytics passa a calcular entregas, pessoas em ação e frentes saudáveis a partir da operação atual.
- Visões por pessoa e por projeto mostram missões concluídas, pendências e saúde das frentes.

## [0.21.0] - 2026-08-04

### Adicionado

- Alertas automáticos para missões urgentes e frentes que pedem atenção.
- Histórico recente de entregas concluídas e missões em andamento na central de notificações.

## [0.20.0] - 2026-08-04

### Adicionado

- Missões pendentes aparecem automaticamente na Agenda como entregas.
- Cada entrega da missão exibe prazo, frente de projeto e responsável.

## [0.19.0] - 2026-08-04

### Adicionado

- Gestão do ciclo do projeto com status, próximo marco e próximo movimento.
- Indicador de saúde da frente calculado pelas missões atribuídas e pendentes.

## [0.18.0] - 2026-08-04

### Adicionado

- Edição de título, projeto, responsável, prazo e prioridade das missões.
- Persistência local das alterações em missões existentes e criadas pelo time.

## [0.17.0] - 2026-08-04

### Alterado

- Projetos passam a mostrar o time calculado pelas missões efetivamente atribuídas.
- Avatares e resumo de pessoas nas frentes acompanham as redistribuições de missões.

## [0.16.0] - 2026-08-04

### Adicionado

- Criação de missões diretamente pelo detalhe da frente de projeto.
- Projeto selecionado preenchido automaticamente na nova missão.

## [0.15.0] - 2026-08-04

### Adicionado

- Filtros de projeto e responsável na Central de Missões.
- Combinação dos filtros com os estados de missão em aberto, concluída e todas.

## [0.14.0] - 2026-08-04

### Adicionado

- Painel de gestão para revisar e redistribuir o responsável de qualquer missão.
- Persistência local das redistribuições, incluindo missões já existentes no SIX.OS.

## [0.13.0] - 2026-08-04

### Adicionado

- Visão da equipe conectada às missões atribuídas, com status e projeto de cada entrega.
- Resumo de missões em aberto e de pessoas em atuação no time.

## [0.12.0] - 2026-08-04

### Alterado

- Missões agora são vinculadas a uma frente de projeto e a uma pessoa responsável.
- O progresso de cada projeto é calculado pelas suas missões concluídas.

## [0.11.0] - 2026-08-04

### Adicionado

- Criação local de projetos com cliente, prazo e identidade visual.
- Persistência dos novos projetos no navegador e integração à carteira do SIX.OS.

## [0.10.0] - 2026-08-04

### Adicionado

- Criação local de missões com cliente, prazo e prioridade.
- Persistência das missões criadas no navegador, integrada ao dashboard e à gamificação.

## [0.9.0] - 2026-08-04

### Adicionado

- Jornada de gamificação local com níveis, marcos de XP e conquistas.
- Progresso da jornada conectado às missões concluídas no SIX.OS.

## [0.8.0] - 2026-08-04

### Adicionado

- Central local de notificações com filtros e estado de leitura persistente.
- Avisos de aprovação, agenda e capacidade da equipe.

## [0.7.0] - 2026-08-04

### Adicionado

- Paleta de comandos local para pesquisar e abrir módulos rapidamente.
- Atalho global `⌘/Ctrl + K` e acesso direto ao SIX AI pela busca.

## [0.6.0] - 2026-08-04

### Adicionado

- SIX AI local com respostas contextualizadas por missões, agenda e capacidade da equipe.
- Atalhos de navegação a partir das recomendações do assistente.

## [0.5.0] - 2026-08-04

### Adicionado

- Biblioteca SIX local com filtros por tipo de material e painel de detalhes.
- Acervo inicial de referências, modelos, playbooks e documentos de projeto.

## [0.4.0] - 2026-08-04

### Adicionado

- Central local de Analytics com evolução de XP, indicadores de execução e saúde dos projetos.
- Leitura semanal de ritmo para apoiar decisões de priorização.

## [0.3.0] - 2026-08-04

### Adicionado

- Central local de Equipe com disponibilidade, foco atual, capacidade e responsáveis por projeto.
- Visão detalhada de cada pessoa para apoiar a distribuição do trabalho.

## [0.2.0] - 2026-08-04

### Adicionado

- Agenda compartilhada local com filtros de programação e painel de detalhes por evento.
- Eventos tipados reutilizados no dashboard e na central de agenda.

## [0.1.0] - 2026-08-04

### Adicionado

- Central local de projetos com painel de contexto, progresso, responsáveis e próximos passos.
- Base tipada de dados para projetos, pronta para ser conectada ao banco na próxima etapa.

## [0.0.3] - 2026-08-04

### Adicionado

- Módulo local de missões com filtros, resumo de progresso e conclusão de atividades.
- Persistência local das missões concluídas e da pontuação obtida entre recarregamentos.

### Alterado

- Navegação do dashboard passa a levar para a central de missões.

## [0.0.2] - 2026-08-04

### Alterado

- Repositório integrado à branch de produção `main` do GitHub.
- Configuração de publicação atualizada para Cloudflare Pages.

## [0.0.1] - 2026-08-04

### Adicionado

- Dashboard responsivo do SIX.OS com missões, agenda, projetos, feed e SIX AI.
- Base de dados, API e migração inicial preparadas para Cloudflare D1.
- Camada de dados no frontend com modo demonstrativo enquanto o banco não está conectado.
