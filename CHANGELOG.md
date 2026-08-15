# Changelog — SIX.OS

Histórico de entregas e atualizações de funcionalidades do sistema operacional da agência.

## [Não lançado] — Hardening de segurança e integridade

- Autenticação obrigatória no perfil e remoção dos fallbacks administrativos no navegador.
- Validação estrita de JWT Cloudflare Access, origem CSRF e limite de tentativas de login.
- Migration 0021 reescrita e testada com dados filhos populados, sem perda por cascata.
- Credencial histórica removida e sessões revogadas pela migration 0022.
- Functions incluídas no typecheck; duplicação `_access.js` removida.
- Isolamento multi-organização reforçado em contratos, demandas, horas e PDI.
- Segredos de integrações isolados por organização e criptografados com AES-GCM.
- Relatórios corrigidos para impedir multiplicação cartesiana de horas.
- Testes reais adicionados a `pnpm test` e `pnpm certify:beta`.
- Dashboard, equipe, projetos e analytics passaram a usar somente dados do D1; fallbacks e edições locais foram removidos.
- Criação e ciclo de projetos agora são persistidos e isolados por organização.
- Catálogo fictício de busca, calendário aleatório, briefing rotulado indevidamente como IA e métricas simuladas foram removidos.
- Busca da biblioteca agora consulta arquivos reais e a migration 0027 elimina somente os registros históricos conhecidos da demonstração.

## [0.43.0] — 2026-08-06

### Em Desenvolvimento (Estabilização do MVP & Refinamento de UX)
- **Menu da Conta (3 pontos)**: Popover de opções do perfil (Meu Perfil, Configurações, Alterar Senha, Preferências, Ajuda, Sair).
- **Gestão Completa de Colaboradores**: Cadastro com departamento, senha inicial, bloqueio/desativação, reset de senha e edição de permissões.
- **Perfil do Colaborador na Equipe**: Detalhes completos ao clicar em qualquer membro (XP, Ranking, Missões, Projetos, Histórico).
- **Módulo de Agenda Expandido (Estilo Apple Calendar)**: Visão mensal, semanal e diária com integração de Missões, Reuniões, Prazos, Aniversários e Eventos.
- **Fluxo Operacional de Agência nas Missões**: Etapas sequenciais (Concepção → Atendimento → Redação → Criação → Revisão → Entrega) com encaminhamento automatizado entre responsáveis.
- **Comentários com @Menção**: Notificação e destaque ao mencionar colaboradores.
- **RBAC Matricial & Gamificação Avançada**: Controle fino de permissões e recompensas.

## [0.42.0] — 2026-08-06

### Adicionado / Melhorado
- **Identidade Visual SVG Oficial**: Implementação das marcas oficiais `LogoWhite` e `LogoBlack` vetorizadas em SVG, substituindo o texto genérico na sidebar e tela de login.
- **Menu Lateral Estático (Fixação e Layout)**: Estrutura da barra lateral ajustada para permanecer 100% estática sem rolagem vertical, com dimensionamento proporcional e botões otimizados.
- **Página de Perfil do Colaborador**: Painel completo contendo avatar, estatísticas de projetos, streak, nível de conquista, ranking do time e sticker album.
- **Melhorias de UI nas Missões**: Modal de seleção de data/hora encapsulado em Portal React (sem sobreposição de z-index), correção no wrapping de textos longos na descrição de missões e refinamento da lista de checklist e dropzone de arquivos.

## [0.41.0] — 2026-08-05

### Adicionado
- **Autenticação Obrigatória**: Bloqueio completo do App Shell se não houver sessão ativa. Login e Logout reativos e seguros integrados localmente.
- **Briefing Inteligente (Fase 6)**: Assistente interativo integrado à inteligência operacional para planejar projetos, estruturar marcos e propor checklists de tarefas automatizadas.
- **Dashboard do Projeto (Fase 6)**: Painel de acompanhamento expandido contendo controle de horas estimadas versus reais, progresso reativo e timeline de entrega.
- **Busca Semântica na Biblioteca (Fase 6)**: Barra de pesquisa por IA que processa buscas conceituais agrupando arquivos relevantes.
- **Feed da Agência & Kudos (Fase 7)**: Histórico dinâmico de conquistas alimentado em tempo real pelo banco de dados D1, além de funcionalidade para enviar elogios (kudos) a colegas de time com bônus de XP.
- **Painel de Integrações Externas (Fase 8)**: Configurações no painel administrativo para webhooks do Slack (alertas automáticos disparados pelo backend) e API tokens do Runrun.it.
- **Script Local Preview**: Adicionado atalho `"preview:local"` no `package.json` para facilitar a inicialização local pelo usuário.
