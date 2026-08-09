# SIX.OS Beta Readiness Roadmap

**North Star:** SIX.OS BETA READY

Este roadmap define as fases estritas para certificar que o SIX.OS é seguro, operável e confiável o suficiente para receber *Beta Testers* reais. O objetivo primário é a integridade e segurança, não a contagem de features.

## Fases do Programa

- **[x] BR-0 — Development Foundation Closure**
  - Conclusão da Fase 7.1-B.
  - Correção das cascatas destrutivas e certificação PDI.
  - *Gate: DEVELOPMENT FOUNDATION STATUS: GO*

- **[ ] BR-1 — Security, Authentication & Data Governance**
  - Escopo: Autenticação real, expiração de sessão, logout, CSRF, CORS, bloqueio de spoofing de header (Cloudflare Trust Boundary), auditoria completa RBAC V2 (políticas deny/override), arquivamento de usuários inativos, e auditoria de logs sensíveis.
  - *Gate: SECURITY FOUNDATION STATUS: GO*

- **[ ] BR-2 — Core Product Certification**
  - Escopo: Jornadas E2E de Administração, Pessoas, Clientes, Projetos, Missões, Time Entries, Arquivos, Reports, Evolution, Development. Criação da suíte unificada `npm run certify:beta`.
  - *Gate: CORE PRODUCT STATUS: GO*

- **[ ] BR-3 — Reliability, CI/CD & Operations**
  - Escopo: Implementação de CI, banco Beta isolado, políticas de backup/restore testados, observabilidade (error tracking), smoke/load tests de performance e changelog estrito.
  - *Gate: OPERATIONS FOUNDATION STATUS: GO*

- **[ ] BR-4 — User Experience & Beta Experience**
  - Escopo: QA Responsivo (320px a desktop), tratamentos de loading/empty/error states, onboarding mínimo, configurações de organização essenciais e botão nativo para Report Bug/Feedback.
  - *Gate: USER EXPERIENCE STATUS: GO*

- **[ ] BR-5 — Beta Governance & Environment**
  - Escopo: Conformidade LGPD primária, dados falsos limpos do ambiente, preparo da base real para usuários piloto, revisão de perfis de acesso ativos para o Beta.
  - *Gate: BETA ENVIRONMENT STATUS: GO*

- **[ ] BR-6 — Closed Beta Release**
  - Escopo: Agrupamento da certificação unificada (`npm run certify:beta`) produzindo aprovação em massa. Deploy de produção ativado sob supervisão humana.
  - *Gate: SIX.OS BETA READINESS: GO*

---

> [!IMPORTANT]
> Nenhuma feature do *Post-Beta* (Calibração, Promoções, Compensation) será iniciada até o Closed Beta ser lançado e validado.
