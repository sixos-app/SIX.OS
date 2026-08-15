# Manual Operacional — SIX.OS

O **SIX.OS** é o sistema operacional da Agência SIX. Este documento fornece as instruções operacionais de execução, controle de banco de dados, credenciais e integrações locais.

---

## 1. Inicialização do Ambiente Local

O SIX.OS foi planejado para rodar com o ecossistema local do Cloudflare Workers & Pages. Para compilar e executar o ambiente de testes completo local (frontend + backend APIs + banco D1 local):

```bash
pnpm dev
```

Este comando executa a compilação do TypeScript/Vite e inicia o servidor local em:
👉 **http://localhost:8788**

---

## 2. Autenticação e Credenciais

A autenticação é obrigatória. Não existe senha padrão funcional: a migration de endurecimento remove a credencial histórica. Configure ou rotacione a senha local do administrador:

```bash
SIXOS_PASSWORD_USERNAME=agsix SIXOS_NEW_PASSWORD='uma-senha-forte-com-12-ou-mais' pnpm security:rotate-password
```

A rotação também revoga todas as sessões desse usuário.

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

Antes de salvar integrações, configure `INTEGRATIONS_ENCRYPTION_KEY` como secret de 32 bytes em base64. O backend nunca retorna tokens ou webhooks ao frontend; o painel informa apenas se o provedor está configurado.

Integrações disponíveis no painel:

1. **Slack Integration**: Insira um Webhook URL no painel admin para que o backend envie notificações automáticas a canais do Slack quando kudos ou missões forem completadas no Feed.
2. **Runrun.it Integration**: Armazena o token de forma criptografada. A sincronização automática ainda precisa de certificação funcional antes do beta.
