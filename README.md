# SIX.OS

MVP inicial do sistema operacional gamificado da Agência SIX.

**Versão atual:** `0.23.3`

## O que já está implementado

- Dashboard responsivo com identidade visual SIX.
- Navegação entre os módulos previstos do produto.
- Missões com filtros e conclusão que atualiza o XP.
- Agenda, projetos em andamento e feed interno com dados demonstrativos.
- Painel inicial da SIX AI.
- Camada de dados tipada, preparada para consumir a API do produto.
- Migração inicial e rotas de API para Cloudflare D1.

## Executar localmente

```bash
pnpm install
pnpm dev
```

Para gerar a versão de produção:

```bash
pnpm build
```

## Publicação no Cloudflare Pages

Depois de enviar este repositório ao GitHub, no Cloudflare Pages selecione **Create application → Pages → Connect to Git** e escolha o repositório do SIX.OS. Use estas configurações:

- **Production branch:** `main`.
- **Build command:** `pnpm build`.
- **Build output directory:** `dist`.
- **Node.js:** a versão `22.16.0` já está fixada em `.node-version`.
- **pnpm:** defina `PNPM_VERSION` como `11.9.0` nas variáveis de ambiente do Pages.

O projeto de produção já está vinculado ao banco D1 `six-os` pela variável `DB`. A configuração reproduzível fica em `wrangler.toml`; as migrations incluem a estrutura e os dados iniciais do SIX.OS.

### Acesso compartilhado com Cloudflare Access

O ambiente de produção já tem a aplicação **SIX.OS** do tipo **Self-hosted** protegendo `six-os.pages.dev`. A política **SIX.OS — Guilherme** permite apenas `six.guimell@gmail.com`.

Para adicionar alguém ao time:

1. Inclua o e-mail em uma política do Cloudflare Access.
2. Insira no D1 o usuário com o mesmo e-mail e crie o respectivo perfil em `gamification_profiles`.
3. As Functions usam o cabeçalho verificado `Cf-Access-Authenticated-User-Email` para identificar a pessoa e limitar os dados à sua organização.

Sem uma sessão Access válida, o frontend continua no modo local e as APIs recusam acesso ao banco.

## Versões

As entregas seguem o processo descrito em `VERSIONING.md`. Os marcos recuperáveis são as tags de lançamento, começando por `v0.0.1`.

## Próximas etapas

O plano completo de entregas, dependências e critérios de avanço está em [ROADMAP.md](ROADMAP.md).

A prioridade atual é concluir a validação de acesso e fundação. As integrações com Runrun.it, Google/Outlook Calendar e Slack foram reservadas para a fase final.
