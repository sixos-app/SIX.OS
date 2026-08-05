# Changelog

Todas as mudanças relevantes do SIX.OS são registradas neste arquivo.

## [0.39.1] - 2026-08-05

### Corrigido

- Barra lateral fixa no desktop, com rolagem própria quando necessário e conteúdo central independente.

## [0.39.0] - 2026-08-05

### Adicionado

- Fundação da Agenda nativa: eventos pessoais e da equipe para reuniões, prazos, compromissos e férias.
- Criação de eventos com período, local, contexto e vínculo opcional a projeto/cliente.
- API isolada por organização: todos visualizam a própria agenda; somente Atendimento, Coordenação, Gestão e Administração acessam eventos compartilhados.

### Estrutura

- Migração `0010_native_agenda.sql` amplia a base de calendário e inclui os primeiros eventos de equipe.

## [0.38.0] - 2026-08-05

### Segurança

- Ações de criação, edição e redistribuição de missão agora são ocultadas na interface para cargos sem permissão.
- Especialistas recebem apenas a ação de concluir a própria missão; o servidor continua sendo a camada definitiva de autorização.
- Endpoint de detalhes passa a informar permissão de interação, gestão e aprovação à interface.

### Validação

- Acesso sem sessão foi bloqueado com `401`; sessão administrativa recebeu permissões completas e a prévia local respondeu normalmente.

## [0.37.0] - 2026-08-05

### Corrigido

- Modal de detalhes deixa de permanecer em carregamento quando a API exige sessão; agora exibe o resumo local e a orientação adequada.
- Clique no card de uma missão abre diretamente os seus detalhes completos.

### Alterado

- Prazo de criação e edição passou para seletor nativo de data e hora.
- Criação de missão ganhou descrição para texto e links, além de seleção de imagens e vídeos enviados à Biblioteca do Projeto.

### Validação

- Detalhes sem sessão (`401`) e com sessão válida (`200`) foram conferidos localmente; build passou.

## [0.36.0] - 2026-08-05

### Alterado

- Dashboard passa a retornar o estado e a aprovação de cada missão, incluindo as concluídas.
- Central de Missões, filtros, contadores, progresso de projetos e atividades recentes usam o estado persistido no D1.
- Missões enviadas para aprovação exibem o status visual `EM APROVAÇÃO` e não podem ser concluídas duas vezes.

### Validação

- Transição de uma missão temporária para `completed/approved` foi confirmada na API do Dashboard; XP e registros de teste foram restaurados depois do teste.

## [0.35.0] - 2026-08-05

### Alterado

- Criação, edição e redistribuição de missões agora persistem no D1 para sessões autorizadas.
- Fallback local permanece apenas quando não há sessão ativa, preservando a demonstração do app.

### Adicionado

- Área de anexo por arrastar e soltar na missão.
- Arquivo solto na missão é enviado à pasta escolhida na Biblioteca do Projeto e anexado automaticamente.

### Validação

- Fluxo local confirmado com criação, edição, redistribuição, upload, anexo e limpeza dos registros temporários.

## [0.34.0] - 2026-08-05

### Adicionado

- Primeira entrega da Fase 3: área de Detalhes completos para cada missão.
- Descrição, checklist persistido, comentários, anexos da Biblioteca do Projeto e histórico de ações no D1.
- Endpoint protegido para criação e distribuição de missões.

### Regras de cargo

- Especialistas enviam a entrega para aprovação; Coordenador, Gestão e Administrador aprovam a missão.
- O XP é liberado para a pessoa responsável apenas após a aprovação.

### Validação

- Migração local aplicada; detalhes, checklist, comentários e criação autorizada foram testados com sessão válida e os dados temporários foram removidos.

## [0.33.0] - 2026-08-05

### Adicionado

- Biblioteca própria do Cliente no Ecossistema, separada da Biblioteca de cada Projeto.
- Pastas padrão por cliente: Logo, Brandbook, Briefing, Contrato, Referências e Outros.
- Criação de pastas personalizadas, upload, download e listagem de arquivos diretamente na área do cliente.
- Versionamento automático de materiais: o reenvio com o mesmo nome na mesma pasta mantém o histórico e incrementa a versão.

### Segurança

- Consulta e download exigem sessão válida e respeitam a organização; criação de pastas e uploads ficam restritos às permissões de gestão da biblioteca.

### Validação

- Fluxo local confirmado com upload, duas versões do mesmo arquivo, listagem, download autenticado e limpeza dos dados de teste.

## [0.32.0] - 2026-08-04

### Alterado

- Biblioteca do Ecossistema reposicionada como diretório de arquivos por cliente.
- Seletor “Todos os clientes” adicionado à Biblioteca; a visão agora lista apenas os projetos do cliente escolhido.
- Campo Cliente na criação de projeto passa a iniciar sem seleção e exige a escolha explícita de um cliente cadastrado.

## [0.31.0] - 2026-08-04

### Alterado

- Biblioteca transformada em central unificada de clientes e projetos, com acesso direto às frentes de cada cliente.
- Criação de projetos agora exige selecionar um cliente já cadastrado, preservando sigla e imagem em toda a operação.

## [0.30.0] - 2026-08-04

### Adicionado

- Criação de pastas personalizadas dentro da Biblioteca do Projeto.
- Validação de nome, prevenção de duplicidade e ordenação das novas categorias no D1.

### Segurança

- Apenas Administração e Gestão podem criar categorias personalizadas.

## [0.29.0] - 2026-08-04

### Adicionado

- Upload de arquivos de até 25 MB direto na Biblioteca do Projeto, com download autenticado.
- Armazenamento de conteúdo no binding Cloudflare R2 `FILES` e metadados no D1.
- Versionamento automático ao reenviar um arquivo com o mesmo nome para a mesma pasta.
- Permissão de upload para Administração e Gestão, além de colaboradores com missão atribuída ao projeto.

### Segurança

- Consulta, envio e download da biblioteca agora exigem gestão da biblioteca ou vínculo por missão com a frente solicitada.

### Observações

- O R2 foi validado apenas no ambiente local do Wrangler. O bucket remoto `six-os-files` ainda não foi criado nem vinculado a uma publicação.

## [0.28.0] - 2026-08-04

### Adicionado

- Biblioteca individual por projeto, acessível pela Central de Projetos.
- Pastas padrão para Logo, KV, Vídeos, Artes, Briefing, Contrato e Outros.
- Estrutura no D1 para metadados de arquivo, fornecedor de armazenamento e histórico versionado.
- Endpoint autenticado e isolado por organização para consultar a biblioteca de cada projeto.

### Observações

- O upload físico para Cloudflare R2 ainda não foi habilitado; a interface informa claramente este próximo passo e não simula arquivos armazenados.
- MEGA.nz segue planejado somente como link compartilhado opcional após prova de conceito.

## [0.27.0] - 2026-08-04

### Adicionado

- Identidade do cliente com sigla obrigatória de 2 a 6 caracteres, usada automaticamente nos cartões e detalhes de projetos.
- Imagem de perfil opcional para o cliente; quando presente, ela substitui a sigla nas referências visuais do projeto.
- API autenticada para consultar identidades de clientes na operação.

### Observações

- Enquanto o Cloudflare R2 não entra na Fase 2, imagens pequenas de perfil ficam no D1 como data URL, limitadas a 250 KB e aos formatos PNG, JPEG e WebP.

## [0.26.0] - 2026-08-04

### Adicionado

- Cadastro administrativo de colaboradores com nome, e-mail, login opcional e cargo RBAC.
- Cadastro administrativo de clientes com atualização imediata dos indicadores do painel.

### Segurança

- Novos endpoints verificam sessão e permissões no servidor antes de gravar dados no D1.
- Validações de formato, cargo e duplicidade de e-mail ou login retornam erros seguros ao painel.

## [0.25.0] - 2026-08-04

### Adicionado

- Perfil administrador `agsix` criado pela migration `0004_admin_credentials.sql`, com credencial derivada por PBKDF2 e sessão HTTP-only de 12 horas.
- Endpoints de login, logout e sessão complementar ao Cloudflare Access.
- Painel administrativo restrito ao cargo Administrador, com visão de colaboradores, cargos, permissões e clientes.

### Segurança

- Tokens de sessão são aleatórios, armazenados apenas como hash no D1 e removidos ao expirar ou sair.
- A senha inicial não é exposta no frontend nem registrada em texto neste repositório.

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
