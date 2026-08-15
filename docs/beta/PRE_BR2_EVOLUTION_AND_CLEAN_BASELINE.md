# PRE-BR-2 — EVOLUTION RECOVERY & CLEAN AGENCY BASELINE

## 1. Evolution UI Root Cause
O problema da "tela branca" no módulo de Evolução era causado pela falta de tratamento explícito de exceções nas respostas da API (erros 4xx, 5xx, payloads vazios/mal formados) que ocasionavam a quebra do fluxo de renderização do React por erro não capturado no `useEffect`.

**Correção Implementada:**
Adicionadas checagens explícitas via bloco `try-catch` para captura de Payload inválido e validações `!r.ok` nas requisições da API.
A fallback UI foi modernizada e exibe: *"Não foi possível carregar esta área."* junto com o botão *"Tentar novamente"*.

**Arquivos corrigidos (Commit 8d94f22 e subsequentes):**
- `EvolutionOverview.tsx`
- `MyEvaluations.tsx`
- `CycleManager.tsx`
- `CompetencyManager.tsx`
- `TemplateManager.tsx`
- `DevelopmentDashboard.tsx`

---

## 2. Clean Agency Baseline (Local)
**Estratégia Adotada:**
Foi criado o script `scripts/reset-agency-baseline.ts` que destrói integralmente todos os registros de tabelas transacionais, tabelas de demonstração, e configurações associadas ao seed antigo que não fazem parte do core do produto.
Logo em seguida, o sistema invoca automaticamente o `scripts/bootstrap_clean_tenant.ts`, que injeta *exclusivamente*:
- Configurações essenciais da Organização Target
- Dados de Sistema e Catálogo Padrão (`competency_categories`, `competencies`, `evaluation_scales`, `evaluation_scale_options`, `evaluation_templates`, `evaluation_questions`)
- O usuário Mestre (Admin Tech) validado via variável de ambiente.

**Controle de Segurança (Master Account) — corrigido em 09/08/2026:**
A versão anterior deste relatório estava incorreta: a migration histórica ainda continha uma credencial conhecida e o frontend ainda aceitava fallbacks administrativos. A migration 0022 agora remove a credencial histórica quando ela não foi rotacionada, revoga sessões existentes e exige configuração explícita de uma nova senha. Os fallbacks do frontend foram removidos. A validação remota continua pendente.

### 2.1. Matriz de Dados & Counts (Before/After)
| TABLE | EXPECTED AFTER | POLICY | RATIONALE |
|---|---|---|---|
| development_* | 0 | WIPE | Dados demo da evolução limpos.
| evaluation_* | 0 (exceto system defaults no bootstrap) | WIPE | Ciclos e assignments demo limpos; mantém escalas/catálogo padronizado.
| time_entries, subtasks, tasks | 0 | WIPE | Não há sentido iniciar com tarefas prontas.
| demands, contracts, agency_feed | 0 | WIPE | Alimentação e histórico do tenant zerados.
| missions, mission_* | 0 | WIPE | Sem missões antigas na timeline.
| *_library_files, *_library_folders | 0 | WIPE | Repositório de arquivos 100% limpo.
| projects, clients, teams | 0 | WIPE | Clientes da demo excluídos; organização recém-adquirida criará.
| gamification_profiles, xp_events | 0 | WIPE | Level/XP iniciam zerados.
| auth_sessions | 0 | WIPE | Todas as sessões revogadas no baseline.
| user_role_assignments | 1 | BOOTSTRAP | Apenas 1 assignment pro usuário master.
| departments, professional_* | 0 | WIPE | Cada organização tem sua própria estrutura (Níveis/Cargos).
| users | 1 | BOOTSTRAP | Existência garantida de 1 usuário Master Admin `agsix`.

---

## 3. Tooling & QA
Foi adotada a padronização no `package.json` separando a rotina de limpeza limpa (`db:reset`) e com seed demo (`db:reset-demo`).
Foi criado `scripts/test-clean-baseline.ts` contendo assertions ativas para verificar a validade do Reset (1 único usuário de email predefinido, assertions de FKs zeradas, checagem vazia nas tabelas de negócios).

- **Build**: PASS (`npm run build`)
- **Foreign Key Check**: Zero violações após a recriação do DB e bootstrap.
- **Empty States**: Renderização ok na ausência de dados de tenant.
- **Testes Automáticos de Estado**: PASS (`npx tsx scripts/test-clean-baseline.ts`)

---

## 4. Status Final

**EVOLUTION UI STATUS:** GO  
**CLEAN AGENCY BASELINE LOCAL STATUS:** GO  
**PRE-BR-2 STATUS:** REVALIDATION REQUIRED

*NOTA:* A execução no Beta/Remote continua contida. Este relatório certifica apenas as credenciais e validações em nível de sandbox local.
