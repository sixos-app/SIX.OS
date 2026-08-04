# SIX.OS

MVP inicial do sistema operacional gamificado da Agência SIX.

**Versão atual:** `0.0.2`

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

Após o primeiro deploy, em **Settings → Bindings → Add → D1 database bindings**, conecte o banco com o nome de variável `DB` e faça um novo deploy. As rotas em `functions/api` passarão a usar os dados reais.

## Versões

As entregas seguem o processo descrito em `VERSIONING.md`. Os marcos recuperáveis são as tags de lançamento, começando por `v0.0.1`.

## Próximas etapas

1. Copie `wrangler.toml.example` para `wrangler.toml` e informe o banco D1 da Agência SIX.
2. Aplique `migrations/0001_initial.sql` no banco com o Wrangler.
3. Conecte a autenticação para substituir o perfil temporário usado pelas rotas de API.
4. Integrar eventos do Runrun.it à regra de gamificação.
