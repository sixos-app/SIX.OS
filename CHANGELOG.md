# Changelog — SIX.OS

Histórico de entregas e atualizações de funcionalidades do sistema operacional da agência.

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
