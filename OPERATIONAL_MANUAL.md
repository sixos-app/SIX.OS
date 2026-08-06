# Manual Operacional — SIX.OS

O **SIX.OS** é o sistema operacional da Agência SIX. Este documento fornece as instruções operacionais de execução, controle de banco de dados, credenciais e integrações locais.

---

## 1. Inicialização do Ambiente Local

O SIX.OS foi planejado para rodar com o ecossistema local do Cloudflare Workers & Pages. Para compilar e executar o ambiente de testes completo local (frontend + backend APIs + banco D1 local):

```bash
pnpm preview:local
```

Este comando executa a compilação do TypeScript/Vite e inicia o servidor local em:
👉 **http://localhost:8788**

---

## 2. Autenticação e Credenciais de Teste

A autenticação é obrigatória para acessar as telas do sistema. No modo local, utilize as credenciais a seguir pré-configuradas no D1:

- **Usuário Admin padrão:** `agsix`
- **Senha provisória:** `sixos123`

---

## 3. Modelo de Permissões (RBAC)

O sistema possui controle de acesso baseado em cargos (RBAC). Os principais escopos e permissões são:

| Cargo | Escopos e Ações Permitidas |
| :--- | :--- |
| **Administrador (`admin`)** | Gestão de equipe, cargos, gamificação, projetos, missões, biblioteca global e integrações. |
| **Gestão (`management`)** | Criação e gestão de projetos, distribuição de missões e relatórios. |
| **Coordenador (`coordinator`)** | Atribuição de missões, controle de fluxo e aprovação. |
| **Atendimento (`service`)** | Cadastro de clientes, abertura de projetos e acompanhamento. |
| **Especialistas (`specialist`)** | Execução de missões atribuídas, acompanhamento de progresso e checklist. |

---

## 4. Integrações de Backend

As integrações de terceiros estão prontas para configuração no painel administrativo:

1. **Slack Integration**: Insira um Webhook URL no painel admin para que o backend envie notificações automáticas a canais do Slack quando kudos ou missões forem completadas no Feed.
2. **Runrun.it Integration**: Permite o mapeamento e importação de tarefas para alimentar o fluxo de gamificação de forma automática.
