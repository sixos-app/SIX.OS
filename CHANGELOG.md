# Changelog

Todas as alterações notáveis no projeto **SIX.OS** serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/), e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/) conforme definido em [VERSIONING.md](./VERSIONING.md).

---

## [0.44.0] - 2026-08-15

### Added
- **Módulo de Agenda Expandido**: Visualização fluida estilo Apple Calendar com visões Mensal, Semanal de 7 colunas e Diária de 08:00 às 21:00 (`src/components/AgendaCalendar.tsx`).
- **Novos Tipos de Eventos de Agenda**: Suporte nativo a `birthday` (Aniversários da equipe/clientes), `vacation` (Férias/Ausências), `meeting` (Reuniões), `deadline` (Prazos) e `appointment` (Compromissos).
- **Criação Ágil no Calendário**: Clique direto em uma data abre o modal de criação pré-preenchido para o dia selecionado.
- **Exibição Dinâmica da Versão**: Tag oficial de versão renderizada no topo da barra lateral esquerda da aplicação (`src/components/AppShell.tsx`), consumindo a fonte única em `src/version.ts`.
- **Suíte de Certificação Beta Unificada**: Script mestre de validação automatizada de qualidade (`scripts/certify-beta.ts` / `npm run certify:beta`) cobrindo 7 gates de types, segurança, workflows e build.
- **Diretriz Oficial de Versionamento**: Documento permanente [VERSIONING.md](./VERSIONING.md) com regras estritas de SemVer para desenvolvedores e agentes de IA.

### Changed
- **Modularização Arquitetural de `src/App.tsx`**: Monólito refatorado de ~3.550 linhas para 58 linhas, segregando 28 componentes atômicos organizados por domínio em `src/components/`.
- **Workflows Setoriais com Troca Automática de Responsável**: Ao avançar ou devolver etapas de uma missão entre setores (Concepção → Atendimento → Redação → Criação → Revisão → Aprovação), a tabela `mission_assignees` sincroniza imediatamente o colaborador responsável ativo.
- **Auto-Encerramento de Timers de Produção**: Ao avançar etapa, devolver ou concluir uma missão com cronômetro em execução, o registro em `time_entries` é encerrado com cálculo preciso da duração.
- **Distribuição de XP Multi-Participante**: Conclusão de missões credita recompensas de XP e bônus de pontualidade individualmente para todos os colaboradores que concluíram etapas no fluxo.

### Security
- **Auditoria e Isolamento Multi-Tenant**: Validação estrita de JWT Cloudflare Access, proteção contra CSRF e PBKDF2 com salt aleatório na autenticação.
- **RBAC V2 Deny-by-Default**: Resolução determinística de permissões matriciais por perfis e permissões granulares.

---

## [0.43.0] - 2026-08-06

### Added
- **Menu da Conta**: Popover de opções do perfil (Meu Perfil, Configurações, Alterar Senha, Preferências, Ajuda, Sair).
- **Gestão Completa de Colaboradores**: Cadastro com departamento, senha inicial, bloqueio/desativação, reset de senha e edição de permissões.
- **Perfil do Colaborador na Equipe**: Detalhes completos ao clicar em qualquer membro (XP, Ranking, Missões, Projetos, Histórico).
- **Fluxo Operacional de Agência nas Missões**: Etapas sequenciais com encaminhamento automatizado entre responsáveis.
- **Comentários com @Menção**: Notificação e destaque ao mencionar colaboradores.
- **RBAC Matricial & Gamificação**: Controle fino de permissões e regras de recompensas.

---

## [0.42.0] - 2026-08-06

### Added
- **Identidade Visual SVG Oficial**: Implementação das marcas oficiais `LogoWhite` e `LogoBlack` vetorizadas em SVG na sidebar e tela de login.
- **Página de Perfil do Colaborador**: Painel completo contendo avatar, estatísticas de projetos, streak, nível de conquista, ranking do time e sticker album.

### Changed
- **Menu Lateral Estático**: Estrutura da barra lateral ajustada para permanecer estática sem rolagem vertical, com dimensionamento proporcional e botões otimizados.

### Fixed
- **Melhorias de UI nas Missões**: Modal de seleção de data/hora encapsulado em Portal React, correção no wrapping de textos longos e dropzone de arquivos.

---

## [0.41.0] - 2026-08-05

### Added
- **Autenticação Obrigatória**: Bloqueio do App Shell se não houver sessão ativa. Login e Logout reativos e seguros.
- **Briefing Operacional**: Assistente interativo para estruturar marcos e checklists de tarefas operacionais.
- **Dashboard do Projeto**: Painel de acompanhamento expandido contendo controle de horas estimadas versus reais e progresso.
- **Busca na Biblioteca**: Pesquisa textual de arquivos reais isolados por organização.
- **Feed da Agência & Kudos**: Histórico de conquistas alimentado pelo banco de dados D1 e envio de kudos com bônus de XP.
- **Painel de Integrações Externas**: Configurações no painel administrativo para webhooks do Slack e Runrun.it.
