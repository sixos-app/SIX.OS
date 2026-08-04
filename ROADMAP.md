# Roadmap do SIX.OS

Este documento organiza as próximas entregas do produto. As fases são sequenciais pelas dependências técnicas, não por prazo. Nenhuma alteração é publicada sem autorização explícita.

## Decisões de produto

- A Agenda nativa será construída antes das sincronizações externas. Google Calendar, Outlook e Slack entram apenas na fase final de integrações.
- O Cloudflare D1 será a fonte de verdade dos dados operacionais e o Cloudflare R2 será a fonte de verdade dos arquivos do SIX.OS.
- O MEGA.nz será estudado como conector opcional de links compartilhados e não como armazenamento primário. A prova de conceito deve validar permissões, expiração, versionamento e acesso aos links antes de qualquer integração de upload.
- RBAC é requisito base: nenhuma visão compartilhada, arquivo ou ação administrativa será liberada sem verificar o cargo da pessoa autenticada.

## Fase 0 — Acesso e fundação

- Concluir a validação de login do Cloudflare Access com `six.guimell@gmail.com`.
- Criar a tela de login alinhada à identidade SIX: logo, textura, frase dinâmica e entrada por e-mail.
- Preparar os pontos de extensão para login Google e Microsoft, sem ativar os provedores nesta fase.
- Evoluir o modelo de usuários, cargos e escopos para sustentar RBAC.

## Fase 1 — Administração e controle por cargo

- Criar o painel administrativo exclusivo para administradores.
- Permitir cadastro de colaboradores, clientes e cargos.
- Implementar as permissões de Administrador, Gestão, Coordenador, Atendimento e Especialistas (Designer, Motion e Social Media).
- Liberar configurações de gamificação, níveis, recompensas, biblioteca global, relatórios e integrações conforme a permissão.

## Fase 2 — Projetos, clientes e biblioteca de arquivos

- Adicionar arquivos do cliente diretamente no projeto e organizá-los automaticamente na Biblioteca.
- Criar pastas padronizadas: Logo, KV, Vídeos, Artes, Briefing, Contrato e categorias personalizadas.
- Implementar metadados, histórico e versionamento de arquivos.
- Integrar uploads ao Cloudflare R2 com regras de acesso por projeto e cargo.
- Realizar a prova de conceito do MEGA.nz para associar links compartilhados a pastas ou versões de arquivos; manter R2 como armazenamento oficial caso a integração não atenda aos requisitos de segurança e automação.

## Fase 3 — Missões completas

- Exigir título, cliente, projeto, descrição, checklist, responsável, prioridade, criação, prazo, XP, recompensa e status.
- Adicionar anexos com arrastar e soltar, comentários e histórico de alterações.
- Relacionar cada anexo à pasta específica do projeto; a opção MEGA só entra após a prova de conceito da Fase 2.
- Aplicar regras de criação, distribuição, aprovação e conclusão por cargo.

## Fase 4 — Agenda nativa e privacidade

- Criar agenda individual para reuniões, prazos, compromissos, férias e missões.
- Criar agenda compartilhada da equipe, visível somente para Atendimento, Coordenador, Gestão e Administrador.
- Garantir que os demais colaboradores visualizem apenas a própria agenda.
- Vincular eventos a projetos, missões e pessoas responsáveis.

## Fase 5 — Perfil e gamificação

- Permitir foto, nome social, cargo, bio, cor de destaque, banner, redes internas e assinatura.
- Exibir stickers, XP, ranking, conquistas, projetos entregues, aprovação média e streak.
- Permitir ao administrador configurar XP, níveis e recompensas.

## Fase 6 — Inteligência operacional

- Criar Briefing Inteligente com cliente, objetivo, público, concorrentes, canais e prazo.
- Gerar com a SIX AI cronograma, checklist, missões e sugestões revisáveis antes da criação.
- Construir a Biblioteca Inteligente: indexação de metadados e busca semântica por projeto, cliente, campanha e período.
- Criar Dashboard do Projeto com progresso, horas previstas versus realizadas, arquivos, aprovações, pendências, entregas e equipe.

## Fase 7 — Feed da agência

- Registrar eventos relevantes: missões concluídas, aprovações, kudos, entrada de colaboradores e início de projetos.
- Exibir créditos de XP e links seguros para os itens relacionados.
- Aplicar visibilidade por organização, projeto e cargo.

## Fase 8 — Integrações externas (fase final)

- Integrar Runrun.it para importar ou sincronizar eventos que alimentem missões e gamificação.
- Sincronizar Google Calendar e Outlook apenas depois de a Agenda nativa estar estável.
- Integrar Slack para alertas e eventos selecionados do feed.
- Guardar credenciais de forma criptografada, implementar reautorização, logs de sincronização e tratamento de falhas.

## Fase 9 — Qualidade e lançamento

- Testar permissões RBAC, isolamento de dados, fluxos de upload e recuperação de erros.
- Validar desempenho, acessibilidade, responsividade e observabilidade.
- Atualizar documentação operacional e preparar a publicação quando autorizada.

## Critérios para seguir de fase

- Fluxo principal validado localmente.
- Migrações e regras de autorização revisadas.
- Versão, changelog, commit e tag criados localmente.
- Publicação no GitHub/Cloudflare somente após autorização explícita.
