# ADR — Ownership, Visibility and Lifecycle of Development Plans

## 1. Contexto
A Fase 7.1 do SIX.OS introduz o conceito de PDI (Plano de Desenvolvimento Individual), Devolutivas (Debriefs), Check-ins e Ações de Desenvolvimento.
Esta estrutura complementa o Módulo Evolução, baseando-se nos resultados da avaliação para criar um ciclo de vida contínuo de desenvolvimento profissional, desvinculado de gamificação, calibração ou bônus (features futuras isoladas).

Como o PDI lida com dados confidenciais de avaliações, histórico de metas e liderança cruzada (mudança de gestor), as regras de Ownership e Lifecycle precisam ser absolutas, claras e em conformidade com o RBAC V2 e o princípio de confidencialidade estabelecido.

## 2. Decisões Estruturais (Respostas Opcionais e Regulatórias)

### 2.1 Quem é o dono do PDI?
O PDI pertence inequivocamente ao **colaborador (sujeito)**. O colaborador é o centro do desenvolvimento.

### 2.2 Quem pode criar?
O PDI pode ser criado de forma colaborativa:
* O próprio colaborador (`development.plans.create` com scope `own`).
* Seu líder direto (`development.plans.create` com scope `team`).
* RH/Admins (`development.plans.create` com scope `all` ou `department`).

### 2.3 Quem pode editar?
Campos core do plano (título, descrição, prazo) podem ser editados por quem tem acesso de edição de acordo com o escopo (próprio ou da equipe). 

### 2.4 Qual o papel do Colaborador?
O colaborador visualiza seu próprio plano, contribui criando e atualizando suas próprias metas, adiciona evidências, participa e comenta em check-ins, e é o responsável primordial por executar o plano.

### 2.5 Qual o papel do Líder?
O líder atua como mentor/orientador: acompanha os liderados, propõe objetivos de desenvolvimento, adiciona ações esperadas, conduz a devolutiva formal e registra os check-ins periódicos de acompanhamento.

### 2.6 Qual o papel de Pessoas/RH?
Pessoas/RH monitoram o processo via um dashboard de indicadores (`development.monitor`). Não interferem diretamente ou reescrevem o plano, a menos que atuem em nome de suporte sob a permission de `manage` (`development.plans.manage`).

### 2.7 Como `scope team` funciona?
A capability `team` se baseia estritamente no campo `manager_id` na tabela de usuários (`RBAC V2`). Um líder tem visão e edição sobre os PDIs onde ele é, atualmente, o gestor direto ou indireto na árvore hierárquica.

### 2.8 O que acontece quando `manager_id` muda?
* O **PDI não muda de dono** (ele ainda é do colaborador).
* O **novo líder assume acesso automaticamente** (pois o escopo dinâmico `team` agora engloba o usuário).
* O líder anterior **perde o acesso ativo** (a não ser que ainda esteja acima na hierarquia).
* Os **registros históricos (check-ins, author de ações)** permanecem imutáveis, ligados ao `author_user_id` original. Não reescrevemos o passado.

### 2.9 Como preservar histórico?
* Eventos pontuais (como criação de evidência, fechamento de check-in, comentários) registram permanentemente o `author_user_id` de quem realizou a ação no momento.
* Mudanças de estado devem gerar rastro de autoria.

### 2.10 PDI pode existir sem avaliação?
**Sim.** Um PDI pode ser "avulso". A referência `source_cycle_id` no banco de dados deve ser opcional (`nullable`), garantindo que planos pontuais de melhoria possam ser abertos a qualquer momento.

### 2.11 Como avaliação origina PDI?
Um PDI gerado através do resultado de uma avaliação salva a relação `source_cycle_id` (e opcionalmente `source_debrief_id`). Isso ajuda a contextualizar a origem, porém o PDI opera como entidade autônoma.

### 2.12 Que dados da avaliação podem entrar no PDI?
O PDI armazenará links fracos (ex: `competency_id`) para atrelar um objetivo de melhoria a uma competência que estava no ciclo. O sistema não copiará comentários de pares ou scores, mas usará metadados genéricos. O Leader/Colaborador transcrevem manualmente os insights de desenvolvimento.

### 2.13 Quais dados confidenciais nunca podem atravessar?
Comentários anônimos crus e as respostas base individuais (`evaluation_answers`) nunca serão linkadas ou copiadas ao PDI. O princípio da Opacidade protege a segurança do avaliador.

### 2.14 Devolutiva é editável depois de concluída?
**Não.** Uma devolutiva (`evaluation_debriefs`) marcada como `completed` torna-se **imutável** (read-only) para evitar manipulação de acordos gerenciais pós-reunião. Correções dependeriam de suporte técnico direto.

### 2.15 Quem pode concluir um PDI?
A conclusão de um PDI pode ser feita pelo colaborador (se a cultura permitir) ou pelo seu líder/RH. Isso será controlado pela capability `development.plans.complete`.

### 2.16 Como cancelamento funciona?
O cancelamento (status `cancelled`) interrompe a execução, mantendo os logs, não exigindo check-ins futuros, e arquivando-o logicamente.

### 2.17 Monitoramento de RH permite edição?
Não automaticamente. A capability `development.monitor` dá acesso de *leitura analítica* global aos metadados (percentual concluído, metas ativas), enquanto edição exige `development.plans.edit` (com `all` ou `department`).

### 2.18 Como impedir que PDI vire prontuário secreto?
PDIs só suportam interações abertas (evidentes para o dono do PDI). Não existem "notas secretas do gestor" em check-ins. A transparência do PDI garante que o colaborador veja todas as ações documentadas ali.

### 2.19 Como eventos históricos serão registrados?
Via log de timeline derivado da data de criação das entidades ou via infraestrutura do `Audit Log` já presente, quando os endpoints forem executados.

### 2.20 Quais decisões foram adiadas para a Fase 7.2?
* Gamificação, Nine-Box, Calibração, Promoção, Concessão de Moedas, Atrelamento a Sucessão, Curvas Forçadas e Feedback Contínuo Diário (não-estruturado). 

## 3. Entidades Arquiteturais Adotadas

A Fase 7.1 utilizará as seguintes entidades independentes e segregadas:
1. **evaluation_debriefs**: Reunião formal de entrega dos resultados.
2. **development_plans**: Container principal do PDI.
3. **development_goals**: Objetivos que o colaborador deve atingir.
4. **development_actions**: Ações pontuais para chegar ao objetivo (diferentes de Tasks/Missions do dia-a-dia da empresa).
5. **development_evidence**: Comprovações práticas para as ações.
6. **development_checkins**: Registro de reuniões contínuas de alinhamento ao longo do plano.
7. **development_checkin_entries**: Apontamentos qualitativos abertos e explícitos atrelados a um check-in.
