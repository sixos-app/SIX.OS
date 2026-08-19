## [0.50.1] - 2026-08-18

### Changed
- Auditoria UX/UI da página de Colaboradores & RH concluída com sucesso.
- Correção de deslocamento horizontal e padding excessivo resolvendo o aninhamento indevido da classe `content-area`.
- Implementação de um grid responsivo de 2 colunas para exibição dos cards de colaboradores.
- Refatoração da barra de filtros com suporte a grid flexível e adoção de inputs/selects nativos padronizados (`.admin-input`).
- Atualização visual e semântica do card de colaborador, adicionando badges corretos, efeitos de hover consistentes e hierarquia visual de cargo/departamento.
- Ajuste no botão de ação primária "NOVO COLABORADOR" usando estilo padronizado no sistema.

# Changelog

Todas as alterações notáveis no projeto **SIX.OS** serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/), e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/) conforme definido em [VERSIONING.md](./VERSIONING.md).

---

## [0.50.0] - 2026-08-18
### Changed
- **Redesign UX/UI do MissionDetailsModal**: Modal consideravelmente ampliado para uso como workspace (até 1540px), comportando mais dados com melhor leitura.
- **Nova aba de Gestão**: Separação clara entre a operação (aba Missão) e o tracking administrativo da missão (Detalhes, Tempo, Equipe e Progresso), movendo o botão Excluir para reduzir risco de cliques acidentais.
- **Reorganização Tab Missão**: Grid balanceado entre a Descrição (extensa) e Checklist de operação (compacto), promovendo maior protagonismo à leitura e formatação.
- **Novo Pipeline de Etapas**: Adaptado para scroll horizontal limpo com overflow dinâmico, suportando workflows alongados sem quebra de tela.
- Melhorias gerais de responsividade, transformando o modal em um painel fullscreen (100vh) no uso via celular (<768px).

## [0.49.2] - 2026-08-18
### Fixed
- Correção da ação de clique nos cards de missões na Home/Dashboard, que agora abrem corretamente o modal de detalhes da missão já existente.
- Propagação do clique no botão "Concluir" dos cards de missões na Home ajustada para não abrir o modal acidentalmente.

## [0.49.1] - 2026-08-17
### Fixed
- Refatoração visual do módulo Colaboradores & RH para adequação ao Design System oficial do SIX.OS.
- Correção do modal de Colaborador (remoção de fundo preto genérico, uso de abas no padrão da biblioteca).
- Remoção do botão de Novo Colaborador da tela Administração.
- Correção da estilização do botão de Excluir Missão.
- Remoção de emojis incompatíveis em listagens.

## [0.49.0] - 2026-08-17

### Added
- **Módulo Completo de Colaboradores / RH**:
  - Separação arquitetural entre a entidade de autenticação/acesso (`users`) e a entidade de vínculo funcional e de pessoas (`employees`).
  - Cadastro estruturado com Dados Pessoais (CPF, RG, Órgão Emissor, Data de Nascimento, Estado Civil, Telefone, E-mail Pessoal, Contatos de Emergência e Endereço Completo).
  - Dados Profissionais (Matrícula Interna, Departamento, Cargo Profissional, Nível/Senioridade, Liderança Direta, Data de Admissão, Tipo de Contratação CLT/PJ/Estágio/Freelancer e Modalidade Híbrido/Remoto/Presencial).
  - Estados operacionais e de vínculo: Ativo, Em Férias, Afastado (Licença), Inativo e Desligado (com retenção de data, motivo e preservação histórica).
- **Remuneração & Histórico Salarial Imutável (`employee_compensation_history`)**:
  - Linha do tempo de vigências salariais com data de início e fim, salário base, jornada mensal em horas e cálculo determinístico do custo salarial por hora (`hourly_cost = salary / monthly_hours`).
  - Proteção contra reescrita: cada reajuste encerra a vigência anterior e inicia uma nova, mantendo a rastreabilidade completa.
- **Snapshot Financeiro nos Apontamentos de Tempo (`time_entries`)**:
  - Persistência imutável de `hourly_cost_snapshot` e `compensation_history_id` em cada apontamento no momento do encerramento (`closeActiveTimers`).
  - Garantia de que aumentos ou alterações salariais futuras não alterem retroativamente o custo de mão de obra de missões já realizadas.
- **Biblioteca Privada de Documentos do Colaborador (`employee_documents`)**:
  - Armazenamento em Cloudflare R2 com metadados no D1 categorizados por pastas padrão (Contratos, Holerites, Atestados Médicos, Férias, Benefícios, Advertências/Termos, Avaliações e Outros).
  - Upload, download com streaming autenticado e exclusão com verificação estrita de permissões no backend.
- **Perfil de Acesso e Permissões do "Financeiro"**:
  - Criação do perfil nativo `finance` (`prof-finance`) e matriz granular de permissões: `employees.view`, `employees.create`, `employees.edit`, `employees.view_sensitive`, `employees.edit_sensitive`, `employees.salary.view`, `employees.salary.edit`, `employees.documents.view`, `employees.documents.upload`, `employees.documents.delete`, `employees.history.view`, `finance.manage` e `mission_costs.view`.
  - **Isolamento de Acesso**: Usuários do setor Financeiro/RH têm acesso total à gestão de colaboradores e finanças sem necessidade de possuir permissões de visualização ou edição de missões e projetos operacionais.
- **Trilha de Auditoria Sensível (`employee_audit_logs`)**:
  - Rastreamento e log de todas as mutações cadastrais, reajustes salariais, alterações de CPF/dados sensíveis, upload/exclusão de documentos e desligamentos.

### Fixed
- **Unificação do Fechamento de Timers e Custo**:
  - Centralização de todo o cálculo financeiro de mão de obra em `closeActiveTimers`, consultando a vigência de remuneração ativa do colaborador com fallback seguro para `users.hourly_rate`.

---

## [0.48.2] - 2026-08-17

### Fixed
- **Eliminação e Prevenção de Timers Órfãos no Topbar**:
  - Correção na consulta do `activeTimer` em `functions/api/dashboard.ts` para restringir estritamente a missões em status ativo (`open`, `in_progress`) e projetos não arquivados, impedindo que missões canceladas/arquivadas permaneçam presas na barra superior como "MISSÃO ATIVA".
  - Encerramento atômico de cronômetros abertos no cancelamento/exclusão de missões (`functions/api/missions/[id].ts`) e arquivamento de projetos (`functions/api/projects/[id].ts`).
  - Recuperação resiliente no endpoint de timer (`functions/api/missions/[id]/timer.ts`): ação `stop` e início de nova missão agora encerram e limpam automaticamente quaisquer timers órfãos pertencentes a missões encerradas, prevenindo bloqueio de novos timers pelo erro 409.
  - Adição de botão de parada direta (`⏹`) no widget de Missão Ativa da barra superior (`AppShell.tsx`), permitindo ao colaborador pausar ou limpar o próprio cronômetro em 1 clique sem travar a navegação.
- **Migration Corretiva de Dados (`0044_close_orphan_active_timers.sql`)**:
  - Encerramento idempotente de timers órfãos em `time_entries` preservando início, histórico e duração com base no `updated_at` da missão.
  - Criação do índice parcial `idx_time_entries_active_user_timer` para otimizar a resolução do timer ativo por usuário.

---

## [0.48.1] - 2026-08-17

### Fixed
- **Contabilização de Custo de Timer Unificada**: Extração da função compartilhada `closeActiveTimers` em `_missionWorkflow.ts`, garantindo que avanço de workflow, solicitação de aprovação e conclusão de missões calculem o custo financeiro (`realized_cost`) dos timers ativos com base no `hourly_rate` do usuário, prevenindo perda de dados financeiros.
- **Sincronização em Tempo Real de Missões com o Dashboard**: Integração da prop callback `onMissionUpdated` em `MissionDetailsModal` e `MissionsPage`, disparando atualização reativa dos dados operacionais no `AppShell` após avanços de etapa, devoluções/ajustes e controle de cronômetro sem necessidade de recarregar a página (F5).
- **Isolamento de Estado do `localStorage` por Usuário**: Aplicação de namespace dinâmico com o `userId` autenticado para as chaves `sixos_seen_feed`, `six-os:read-notifications` e `sixos:client-library-view`, incluindo migração segura e transparente de chaves legadas e prevenindo vazamento de preferências entre múltiplos usuários no mesmo navegador.
- **Normalização de Schema de Migrations (Gap 0022)**: Criação da migration corretiva e idempotente `0043_fix_duplicate_0022_schema.sql` para documentar e assegurar a consistência de índices da tabela `auth_login_attempts` sem alterar arquivos históricos de produção.

---

## [0.48.0] - 2026-08-17

### Added
- **Sistema Global de Menções de Colaboradores (@mentions)**: Implementação centralizada do sistema de menções no formato `@login` (utilizando o username já cadastrado dos usuários), com detecção de gatilho, busca em tempo real, suporte completo a navegação por teclado (`ArrowDown`, `ArrowUp`, `Enter`, `Tab`, `Escape`) e vinculação estruturada com o `user.id` real.
- **Componentes Globais Reutilizáveis**:
  - `MentionTextarea`: Componente desacoplado para escrita colaborativa com popover de menções integrado.
  - `MentionPopover`: Popover de sugestões com superfície escura SIX.OS, avatar e setor do colaborador.
  - `MentionRenderer`: Renderizador de texto com destaque visual verde-lima (`#c6ff38`) para menções e abertura segura de links.
  - `useMentions`: Hook customizado para lógica de menções e posicionamento de cursor.
- **Tabela e Sistema de Notificações de Menções**:
  - Migration `0042_app_notifications.sql` criando a tabela `app_notifications` no D1.
  - Módulo `functions/api/_notifications.ts` para extração de menções, deduplicação por ID, exclusão de auto-menção e geração de alertas contextuais.
  - Endpoint `functions/api/notifications/read.ts` para sincronização de leitura.
- **Integração Global nas Áreas do SIX.OS**:
  - Missões: Comentários operacionais, briefing da missão e motivo de solicitação de ajustes.
  - Projetos: Próximo movimento (*Next Step*) no ciclo do projeto.
  - Agenda: Contexto e descrição de compromissos.
  - Feed: Motivo de envio de Kudos/Reconhecimento.
- **Documentação de Design System**: Arquivo `SIXOS_DESIGN_SYSTEM.md` com diretrizes e regras fixas para campos colaborativos.

## [0.47.3] - 2026-08-17

### Changed
- **Reorganização do Detalhe da Missão em Abas**: O modal de detalhes da missão (`MissionDetailsModal`) agora conta com uma arquitetura interna baseada em abas (`MISSÃO`, `ANEXOS`, `COMENTÁRIOS` e `HISTÓRICO`) reduzindo o comprimento vertical da tela e organizando o fluxo de trabalho.
- **Timer Compacto no Header**: O botão horizontal de timer em faixa verde foi removido e substituído por um controle compacto de Play/Pause integrado diretamente na linha de metadados do cabeçalho, à esquerda do badge de prioridade.
- **Box de Descrição com Scroll e Links**: A descrição da missão foi inserida em um card dedicado com scroll interno contido (`max-height: 140px`) e linkificação segura para URLs externas.
- **Aba Principal de Missão**: Agrupa o Workflow Operacional interativo, o novo Box de Descrição e o Checklist de atividades da missão.
- **Abas de Anexos, Comentários e Histórico**: Telas dedicadas para upload/gerenciamento de arquivos (com contador de anexos), registro de comentários operacionais (com contador) e timeline auditável.

## [0.47.2] - 2026-08-17

### Fixed
- **Modal Centralizado de Confirmação de Exclusão**: `ConfirmActionModal` reestruturado para ser exibido centralizado na viewport, com backdrop escuro com blur (`backdrop-filter: blur(8px)`), micro-badge `AÇÃO DESTRUTIVA`, tipografia nativa do SIX.OS e botões padronizados (`dialog-cancel-button` e `mission-delete-button`), eliminando a exibição como gaveta lateral ou elementos sem estilo.
- **Modal Centralizado de Detalhes da Missão**: `MissionDetailsModal` convertido de gaveta/drawer lateral para dialog centralizado na viewport (`width: min(1100px, calc(100vw - 64px))`, `max-height: calc(100vh - 48px)`) com scroll interno contido, animação suave e sem deslocamento de layout da página.
- **Padronização de Botões Destrutivos**: Componente de botão destrutivo (`.mission-delete-button`) unificado com fundo translúcido vermelho discreto, borda, tipografia em uppercase e estados de hover, active e disabled consistentes em todo o sistema.

## [0.47.1] - 2026-08-17

### Fixed
- **Permissões Atômicas de Exclusão (RBAC V2)**: Registro oficial de `projects.delete` e `missions.delete` no catálogo geral de permissões (`permissions`) e atribuição explícita aos perfis de acesso (`admin_tech`, `operations_management`) via migration 0041.
- **Herança de Capacidades no Backend**: `getEffectiveCapabilities` e `resolvePermission` agora concedem automaticamente `projects.delete` e `missions.delete` a perfis com gestão de projetos/missões.
- **Visibilidade de Exclusão no Frontend**: Adicionado fallback de segurança para garantir a renderização dos botões de exclusão de projetos e missões para administradores e gestores, além de disponibilizar o botão de exclusão de missão diretamente no cabeçalho do `MissionDetailsModal`.

## [0.47.0] - 2026-08-17

### Added
- **Custo Real de Missões**: O timer de missões agora calcula automaticamente o custo da sessão multiplicando as horas trabalhadas pelo custo/hora do colaborador, acumulando e exibindo o custo real ("realized_cost") nos detalhes da missão.
- **Tratamento de Conflito de Timer**: O backend bloqueia timers simultâneos (HTTP 409). O frontend intercepta via `TimerConflictError` e apresenta um modal amigável sugerindo pausar a missão ativa para iniciar a nova.
- **Exclusão de Missão**: Nova permissão `missions.delete` (incorporada por padrão para roles administrativas) para exclusão limpa via interface (que realiza um cancelamento com retenção de histórico). Um modal customizado (`ConfirmActionModal`) previne exclusões acidentais.
- **Exclusão de Projeto**: Botão "EXCLUIR" dentro do modal de ciclo de projeto, visível para perfis com permissão `projects.delete`. Realiza "soft-delete" (status `archived`) com retenção de dependências e histórico. Utiliza o mesmo padrão de modal de confirmação anti-acidentes.

### Changed
- **UI do AppShell**: Refatoração no componente principal para comportar os múltiplos modais nativos de confirmação (Timer Switch, Confirm Delete Mission, Confirm Delete Project) e os estados associados.


## [0.46.3] - 2026-08-17

### Added
- **Captação na Agenda**: Novo tipo de evento com vínculo opcional à missão/roteiro e upload de documentos DOC, DOCX ou PDF (até 25 MB), armazenados no bucket privado da organização.
- **Participantes de Eventos**: Responsáveis autorizados podem adicionar colaboradores ativos da própria organização; os eventos também passam a aparecer na agenda individual dos participantes.

### Fixed
- **Fluxo Setorial da Nova Missão**: O formulário agora utiliza exclusivamente os setores ativos da organização, eliminando o erro “A sequência contém um setor inválido” causado pelo catálogo fixo divergente em alguns perfis.
- **Estado do Formulário de Missão**: Cada abertura inicia uma sessão limpa, e o modal só é fechado depois da confirmação do servidor; falhas preservam apenas a tentativa atual para permitir correção.
- **Modal de Evento Responsivo**: Conteúdo longo ganhou rolagem interna delimitada e rodapé estável, sem corte dos participantes, vínculo de roteiro, anexo ou CTA em desktop, tablet e mobile.

## [0.46.2] - 2026-08-16

### Fixed
- **Matriz de Permissões**: Cabeçalho, identificação do perfil e ações de cancelar/salvar foram ajustados para a superfície clara do Painel Administrativo, com contraste correto, proporções compactas e empilhamento responsivo no mobile.
- **Navegação das Notificações**: O clique agora mantém a marcação como lida e abre o destino operacional correspondente, selecionando a missão ou o projeto relacionado quando disponível e usando Agenda/Equipe como fallback por categoria.

## [0.46.1] - 2026-08-16

### Fixed
- **Modais Nova Frente e Nova Missão**: Separação entre corpo rolável e rodapé de ação, eliminando sobreposição do CTA, corte de conteúdo e conflitos de `overflow`/`z-index`; seletores de Tipos de Trabalho agora expandem no fluxo do formulário.
- **Responsividade da Nova Missão**: Grids com colunas flexíveis e largura mínima zerada nos filhos, briefing em largura total e transição para coluna única em tablet/mobile, sem rolagem horizontal.
- **Área de Anexos**: Dropzone alinhada à largura dos campos, com altura compacta e sem espaço vazio estrutural após o componente.
- **Botão Nova Pasta da Biblioteca**: Uso direto dos assets oficiais `botao mas negativo.svg` no estado normal e `botao mais positivo.svg` em hover/focus, sem fundo, borda ou container visual adicional.
- **Navegação do Painel Administrativo**: Substituição das abas principal e interna sem contraste por controles segmentados responsivos, com estados ativo, hover e foco alinhados à linguagem visual do SIX.OS; cabeçalhos de Cargos, Departamentos, Níveis e Perfis também foram normalizados para o fundo claro.

## [0.46.0] - 2026-08-16

### Added
- **Catálogo de Tipos de Trabalho**: Módulo completo com tabela `work_types`, endpoints REST (`/api/work-types`), permissões RBAC (`work_types.view`, `work_types.manage`), normalização automática e prevenção de duplicidade por inquilino.
- **Componente Searchable `WorkTypeSelector`**: Seletor com suporte a seleção simples e múltipla, busca em tempo real, badges de cor e duração, e sub-formulário para criação inline de novos tipos com paleta de cores.
- **Relação N:N entre Projetos e Tipos de Trabalho**: Tabela associativa `project_work_types`, permitindo vincular tipos de entregas aos projetos tanto no modal de criação quanto na visualização de dashboard do projeto.
- **Seleção de Tipo de Trabalho na Missão**: Integração no `MissionCreateModal` com autopreenchimento dinâmico de horas estimadas (`defaultMinutes`) e respeito às restrições do projeto.
- **Upload Drop-in e Gestão de Anexos**: Dropzone interativa no modal de criação de missões com suporte a arrastar e soltar (drag & drop), chips visuais com tamanho de arquivo formatado (KB/MB) e remoção individual.
- **Paleta Estendida de 10 Cores**: Suporte completo e tokens CSS para as 10 cores oficiais (`lime`, `purple`, `orange`, `blue`, `cyan`, `turquoise`, `yellow`, `pink`, `coral`, `magenta`) nos cards, chips e badges do sistema com fallback retrocompatível.
- **Migration 0038**: Criação de `work_types`, `project_work_types`, coluna `missions.work_type_id`, `color_key` e permissões de catálogo.
- **Gate de Certificação do Catálogo**: Novo teste multi-tenant `scripts/test_work_types_catalog.ts` integrado à suíte de certificação (9 gates).

### Fixed
- **Layout do Modal de Nova Missão**: Reorganização em grid de alta densidade no desktop sem rolagem interna vertical, preservando responsividade em telas menores.
- **Botão Adicionar Pasta na Biblioteca**: Dimensões travadas em 38×38px, eliminação de deslocamento no hover (`scale`), inversão de cores nítida e ícone vetorial SVG.

---

## [0.45.0] - 2026-08-15

### Added
- **Construtor Dinâmico de Fluxo de Missões**: Card *"FLUXO DA MISSÃO"* em `MissionCreateModal.tsx` com adição, remoção e ordenação de etapas por setor e responsável, além de presets rápidos (Campanha, Design, Vídeo, Social).
- **Pipeline Interativo de Workflow no Detalhe**: Visualização do status de cada etapa ($✓, \bullet, \circ$) e botões de ação para avanço de etapa e solicitação de ajustes/revisão.
- **Sistema Estruturado de Revisão e Retrabalho**: Modal dedicado para solicitar ajustes com motivo detalhado, registro do histórico de auditoria e persistência de notas de revisão (`review_notes`).
- **Controle de Tempo Estimado vs Realizado**: Suporte a estimativas de tempo em horas/minutos (`expected_minutes`) na missão e no detalhe, comparando o planejado com os timers realizados.
- **Migration 0037**: Adição de campos operacionais não-destrutivos em `missions` e `mission_workflow_steps`.
- **Gate de Certificação Operacional**: Novo teste `scripts/test_operational_missions.ts` integrado à suíte de certificação.

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
