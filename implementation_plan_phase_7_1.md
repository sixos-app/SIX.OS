# Implementation Plan: Fase 7.1 — PDI, Devolutivas e Check-ins de Desenvolvimento

## 1. Objetivo
Implementar o fluxo completo de Planos de Desenvolvimento Individual (PDI) no SIX.OS. O objetivo é permitir que colaboradores e líderes criem, acompanhem e finalizem planos de desenvolvimento, apoiados por metas, ações, evidências e reuniões de check-in, com suporte a devolutivas (debriefs) estruturadas a partir de avaliações concluídas.

## 2. Non-goals
- Gamificação, pontuações, medalhas e loja de recompensas.
- Nine-Box, Calibração e cálculos complexos de bônus ou mérito financeiro.
- Feedback contínuo desestruturado (fora do contexto de check-ins do PDI).
- Avaliação diária/360 fora do fluxo de ciclo do módulo Evolução já implementado na Fase 7.0.

## 3. Arquitetura
O módulo PDI utilizará entidades arquiteturais segregadas, mantendo dependência fraca ("weak link") com os ciclos de avaliação, para garantir a opacidade e o sigilo dos avaliadores. A visibilidade e o "ownership" são controlados estritamente pelo RBAC V2 e pelo campo `manager_id` na hierarquia da empresa, respeitando o princípio de multi-tenant (`organization_id`).

## 4. Próxima migration prevista
- `0020_evolution_development.sql` (ATENÇÃO: A ser criada durante a Fase 7.1, não na etapa de recovery atual).

## 5. Modelo de dados planejado
As seguintes tabelas serão introduzidas no schema D1:
- `evaluation_debriefs`
- `development_plans`
- `development_goals`
- `development_actions`
- `development_evidence`
- `development_checkins`
- `development_checkin_entries`

## 6. Development Plans
- Entidade principal (`development_plans`), que agrega todos os objetivos de desenvolvimento de um colaborador.
- **Ownership:** O colaborador ("sujeito") é sempre o dono do plano.
- **Status:** Ativo, concluído, cancelado.
- Pode referenciar um `source_cycle_id`, mas também pode ser "avulso".

## 7. Debriefs
- Entidade `evaluation_debriefs`, registrando a reunião formal de entrega de resultados entre líder e liderado.
- Contém metadados, anotações de alinhamento, e links para as metas que serão trabalhadas.
- Torna-se **imutável (read-only)** após a conclusão.

## 8. Goals
- Objetivos específicos de desenvolvimento (`development_goals`) dentro de um Plano.

## 9. Actions
- Ações práticas (`development_actions`) para alcançar as metas. Podem ter datas limite e status independente (todo, in_progress, done).

## 10. Evidence
- Uploads ou links (`development_evidence`) provando a execução das ações ou o alcance das metas.

## 11. Check-ins
- Registros periódicos (`development_checkins`) de acompanhamento, garantindo a regularidade do desenvolvimento. Reuniões de acompanhamento 1:1.

## 12. Timeline
- Registros temporais de mudanças de status, para fins de histórico visual e auditoria dentro do PDI.

## 13. Permissions
Novas capabilities (RBAC V2):
- `development.plans.view` (scope: `own`, `team`, `department`, `all`)
- `development.plans.create`
- `development.plans.edit`
- `development.plans.manage` (suporte/admin RH)
- `development.monitor` (acesso apenas de leitura a dashboards de HR)
- `development.debriefs.view` / `.edit`

## 14. Scopes
O escopo base para líderes é `team` (gerenciado por `manager_id`). Colaboradores operam sob o escopo `own`.

## 15. Endpoints
- `/api/evolution/debriefs`
- `/api/evolution/development-plans`
- `/api/evolution/development-plans/:id/goals`
- `/api/evolution/development-plans/:id/actions`
- `/api/evolution/development-plans/:id/checkins`
- Todos os endpoints devem validar isolamento e ownership.

## 16. Frontend
- Telas de Dashboard de PDI.
- Assistente de Devolutiva (Debrief).
- Tela de visualização e edição detalhada do PDI.
- Modal de Check-ins periódicos.
- Reuso de componentes visuais do módulo de Evolução já existentes.

## 17. Invariantes
- Um Plano pertence inequivocamente ao seu autor original (collaborator).
- Nenhum dado secreto de avaliação `evaluation_answers` é diretamente visível ou transferido textualmente para o PDI de forma automática se isso quebrar a opacidade.
- A exclusão de um registro (como uma ação) deve ser idealmente "soft delete" ou documentada.

## 18. Confidencialidade
- **Opacidade Total:** Os líderes transcrevem *insights* das avaliações (se autorizados) para o PDI sem referenciar, sob nenhuma hipótese, as fontes brutas ou os avaliadores originais. O PDI NÃO é um espelho da avaliação bruta.

## 19. manager_id change
- Quando um colaborador troca de líder, o acesso à gestão do PDI muda automaticamente para o novo líder (devido ao escopo `team`).
- Registros históricos mantêm o `author_user_id` imutável, preservando a auditoria de quem fez os comentários do passado.

## 20. Multi-org
- Tudo deve ser restrito ao escopo do `organization_id` da sessão ativa do usuário. Qualquer cruzamento é violação crítica de segurança.

## 21. Audit
- Todos os endpoits críticos devem registrar ações através da infraestrutura de `Audit Log` já presente (`0016_access_audit.sql`).

## 22. State machines
- Status do PDI: `draft` -> `active` -> `completed` / `cancelled`.
- Debriefs: `scheduled` -> `in_progress` -> `completed` (imutável).

## 23. Test strategy
- Testes automatizados de API (integração) validando criação, edição, escopo (own vs team) e quebra de `organization_id`.
- Testes adversariais forjando o acesso de "team" em um usuário cujo `manager_id` não bate.

## 24. Runtime strategy
- Teste real com `npm run dev` + frontend e testes no banco local D1.

## 25. Migration strategy
- Migration 0020 com `PRAGMA foreign_keys = ON;` ativado, criação progressiva, indexes focados no `organization_id` para acelerar queries.

## 26. Rollback considerations
- Nenhuma exclusão de tabelas legadas nas migrations novas. Sempre progressivo.
- Preservar referências nulas se necessário.

## 27. Risks
- Acidental exposição de identidades (quebra de anonimato/opacidade).
- Erro nas lógicas de team visibility resultando em vazamento horizontal.
- Complexidade da estrutura do Debrief tornando o formulário propenso a bugs de salvamento em rascunho.

## 28. Definition of Done
- Fluxo end-to-end (Banco -> Backend -> Frontend) está implementado e validado.
- Todos os endpoints possuem a autorização RBAC V2 correta e validada por escopo.
- `npm run db:reset` funciona perfeitamente com a nova migration.
- Walkthrough concluído comprovando o sucesso e comportamento adversarial testado.
