# Diretriz Oficial de Versionamento do SIX.OS

Este documento define a **regra oficial e obrigatória de versionamento** para o projeto **SIX.OS**. Todos os desenvolvedores humanos e agentes de Inteligência Artificial (Codex, Gemini, Claude, Antigravity e outros) devem seguir estritamente estas diretrizes.

---

> [!IMPORTANT]
> ### 🤖 REGRA PERMANENTE PARA DESENVOLVEDORES E AGENTES DE IA
> **Antes de finalizar qualquer alteração no SIX.OS, você DEVE consultar este `VERSIONING.md` e determinar se as modificações realizadas exigem incremento de versão.**
> Nenhuma alteração é considerada concluída sem a devida checagem e atualização do versionamento e do [CHANGELOG.md](./CHANGELOG.md).

---

## 1. Padrão de Versionamento (Semantic Versioning — SemVer)

O SIX.OS adota rigorosamente o padrão **SemVer**:

$$\text{MAJOR}.\text{MINOR}.\text{PATCH}$$

Exemplo: `0.44.0`

### 🔹 PATCH (`0.44.0` → `0.44.1`)
Incrementar o **PATCH** quando houver:
- Correção de bugs ou regressões;
- Pequenos ajustes visuais ou de alinhamento;
- Correções de responsividade ou quebras em telas menores;
- Correções ortográficas, labels ou micro-textos;
- Otimizações de desempenho pontuais;
- Refatorações internas de código sem adição de novas telas/recursos;
- Ajustes em testes ou scripts de suporte.

### 🔹 MINOR (`0.44.0` → `0.45.0`)
Incrementar o **MINOR** (e zerar o PATCH) quando houver:
- Nova funcionalidade para o usuário;
- Novo módulo ou nova tela do sistema;
- Novo recurso operacional relevante (ex.: novo tipo de evento na agenda, timers de produção);
- Melhoria funcional substancial em módulo existente;
- Expansão de fluxos operacionais sem quebra de compatibilidade geral.

### 🔹 MAJOR (`0.44.0` → `1.0.0`)
Incrementar o **MAJOR** (e zerar MINOR e PATCH) exclusivamente quando houver:
- Lançamento oficial da primeira versão de produção estável (`1.0.0`);
- Mudança arquitetural de grande porte que quebre compatibilidade com contratos anteriores;
- Reformulação substancial de banco de dados que exija migrações manuais complexas ou quebra de APIs públicas.

---

## 2. Fonte Única da Verdade (Single Source of Truth)

Para evitar duplicidade, divergência ou versões hardcoded espalhadas pelo código:

1. **Fonte Primária**: [`package.json`](./package.json) no campo `"version"`.
2. **Consumo no Frontend**: [`src/version.ts`](./src/version.ts) que importa diretamente o `package.json`:
   ```ts
   import packageJson from '../package.json'
   export const APP_VERSION = packageJson.version
   export const APP_VERSION_LABEL = `v${packageJson.version}`
   ```
3. **Exibição na Interface**: O componente [`src/components/AppShell.tsx`](./src/components/AppShell.tsx) consome `APP_VERSION_LABEL` e o renderiza no topo da barra lateral esquerda (sidebar), garantindo atualização visual 100% automática a cada incremento.

---

## 3. Fluxo Obrigatório de Atualização

Ao concluir uma tarefa ou conjunto de modificações:

1. **Analisar a mudança**: Identificar a classificação da entrega (`PATCH`, `MINOR` ou `MAJOR`).
2. **Atualizar `package.json`**: Alterar o valor do campo `"version"`.
3. **Atualizar `README.md`**: Atualizar o indicador `**Versão atual:**`.
4. **Registrar no `CHANGELOG.md`**:
   - Criar uma seção com a nova versão e data real no formato `YYYY-MM-DD` (ex.: `## [0.44.0] - 2026-08-15`).
   - Categorizar sob `### Added`, `### Changed`, `### Fixed`, `### Removed`, `### Security` ou `### Performance`.
5. **Executar a Certificação**: Rodar `npm run certify:beta` para garantir que o build e todos os 7 gates passem com sucesso.
6. **Verificar Ausência de Conflitos**: Garantir que nenhum arquivo contenha versões divergentes.

---

## 4. Agrupamento em Unidade Lógica de Mudança

- Se uma solicitação envolver modificações em 10 arquivos (modais, APIs, banco de dados, estilos) para entregar **uma mesma funcionalidade**, tudo deve ser tratado como **um único incremento de versão**.
- **Não incremente versões repetidamente** durante a execução intermediária da mesma tarefa. Faça o incremento apenas ao finalizar o escopo da entrega.

---

## 5. Exemplos Práticos no SIX.OS

| Cenário de Mudança | Versão Anterior | Nova Versão | Tipo |
|---|---|---|---|
| Correção de padding e cores no modal de kudo | `0.44.0` | `0.44.1` | **PATCH** |
| Correção de erro 400 no endpoint de checklist | `0.44.1` | `0.44.2` | **PATCH** |
| Adição do módulo de relatórios analíticos de clientes | `0.44.2` | `0.45.0` | **MINOR** |
| Criação de novo sistema de permissões com workflow setorial | `0.45.0` | `0.46.0` | **MINOR** |
| Lançamento Oficial do SIX.OS Beta Geral | `0.46.0` | `1.0.0` | **MAJOR** |
