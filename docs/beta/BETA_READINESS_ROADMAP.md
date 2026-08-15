# SIX.OS Beta Readiness Roadmap

**North Star:** SIX.OS BETA READY

Este roadmap define as fases estritas para certificar que o SIX.OS é seguro, operável e confiável para receber *Beta Testers* reais. O objetivo primário é a integridade e segurança, não a contagem de features.

## Fases do Programa

- **[x] BR-0 — Development Foundation Closure**
  - Conclusão da Fase 7.1-B e modularização de `src/App.tsx`.
  - Correção das cascatas destrutivas e certificação PDI.
  - *Gate: DEVELOPMENT FOUNDATION STATUS: GO*

- **[x] BR-1 — Security, Authentication & Data Governance**
  - Escopo: Autenticação real (PBKDF2), expiração de sessão, logout, CSRF, CORS, bloqueio de spoofing de header (Cloudflare Trust Boundary), auditoria completa RBAC V2 (políticas deny/override), e auditoria de logs sensíveis.
  - *Gate: SECURITY FOUNDATION STATUS: GO*

- **[x] BR-2 — Core Product Certification**
  - Escopo: Jornadas E2E de Administração, Pessoas, Clientes, Projetos, Missões com fluxo setorial, Time Entries/Timers, Agenda expandida estilo Apple Calendar e Evolution. Criação da suíte unificada `pnpm certify:beta`.
  - *Gate: CORE PRODUCT STATUS: GO*

- **[x] BR-3 — Reliability, CI/CD & Operations**
  - Escopo: Suíte automatizada de certificação `scripts/certify-beta.ts`, observabilidade, build estático limpo e testes sem flaky behavior.
  - *Gate: OPERATIONS FOUNDATION STATUS: GO*

- **[x] BR-4 — User Experience & Beta Experience**
  - Escopo: Interface modularizada, calendário fluido (Mês, Semana, Dia), modais de detalhes e delegação rápida, feedback visual de conclusão de missões.
  - *Gate: USER EXPERIENCE STATUS: GO*

- **[x] BR-5 — Beta Governance & Environment**
  - Escopo: Limpeza de dados legados, tenant limpo isolado e controle estrito de RBAC para colaboradores.
  - *Gate: BETA ENVIRONMENT STATUS: GO*

- **[x] BR-6 — Closed Beta Release Readiness**
  - Escopo: Suíte de certificação unificada (`pnpm certify:beta`) produzindo aprovação em 100% dos gates.
  - *Gate: SIX.OS BETA READINESS: GO*
