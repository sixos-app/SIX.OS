# SIX.OS

MVP inicial do sistema operacional gamificado da Agência SIX.

**Versão atual:** `0.50.0` (Consulte [VERSIONING.md](./VERSIONING.md) e [CHANGELOG.md](./CHANGELOG.md))

## O que já está implementado

- Dashboard responsivo com identidade visual SIX.
- Navegação entre os módulos previstos do produto.
- Missões com filtros e conclusão que atualiza o XP.
- Agenda nativa com eventos pessoais ou compartilhados por cargo, além de projetos e feed interno.
- SIXIA, assistente operacional determinístico sobre dados atuais, sem alegação de IA generativa.
- Dashboard, equipe, projetos, missões e métricas carregados exclusivamente do D1.
- Busca textual de arquivos reais, limitada à organização e à permissão de biblioteca.
- Camada de dados tipada, preparada para consumir a API do produto.
- Migração inicial e rotas de API para Cloudflare D1.
- Painel administrativo com cadastros protegidos de colaboradores e clientes.
- Identidade de cliente com sigla e imagem de perfil aplicada aos projetos.
- Biblioteca por projeto com pastas padrão, metadados de armazenamento e estrutura de histórico de versões no D1.
- Biblioteca própria por cliente no Ecossistema, com pastas, upload, download e versões separados dos arquivos de campanha dos projetos.
- Detalhes persistidos da missão com descrição, checklist, comentários, anexos da Biblioteca do Projeto, histórico e aprovação protegida por cargo.

## Executar localmente

```bash
pnpm install
pnpm dev
```

Para gerar a versão de produção:

```bash
pnpm build
```

### Administrador inicial

A cadeia de migrations cria o perfil `agsix`, mas remove a credencial histórica conhecida e revoga as sessões existentes. Defina uma senha individual antes do primeiro acesso:

```bash
SIXOS_PASSWORD_USERNAME=agsix SIXOS_NEW_PASSWORD='uma-senha-forte-com-12-ou-mais' pnpm security:rotate-password
```

Para alterar a senha no D1 remoto é necessário acrescentar `--remote` e confirmar com `ALLOW_REMOTE_PASSWORD_ROTATION=YES`. A senha é persistida somente como PBKDF2 com salt individual.

### Validação

```bash
pnpm test
pnpm build
```

`pnpm test` verifica o typecheck das Functions, RBAC, autenticação/CSRF, criptografia de integrações e o upgrade populado da migration 0021.

### Imagem de cliente

O cadastro de cliente exige uma sigla de 2 a 6 caracteres. Ela é o fallback visual em projetos quando não há imagem. Até a integração com Cloudflare R2, a imagem de perfil aceita PNG, JPEG e WebP de até 250 KB e é guardada temporariamente no D1.

### Biblioteca do projeto

Cada projeto recebe as pastas `Logo`, `KV`, `Vídeos`, `Artes`, `Briefing`, `Contrato` e `Outros`, além de pastas personalizadas criadas por Administração e Gestão. É possível enviar arquivos de até 25 MB pela Biblioteca do Projeto; um reenvio com o mesmo nome na mesma pasta cria uma nova versão. O D1 guarda organização e histórico, enquanto o conteúdo vai para o Cloudflare R2 no bucket remoto `six-os-files`. Links do MEGA.nz serão apenas referências compartilhadas opcionais.

### Biblioteca do cliente

No Ecossistema, selecione um cliente para administrar seus materiais permanentes sem misturá-los com os arquivos de campanhas. Cada cliente começa com as pastas `Logo`, `Brandbook`, `Briefing`, `Contrato`, `Referências` e `Outros`; Administração e Gestão podem criar outras categorias, anexar arquivos de até 25 MB e baixar os materiais. Reenviar o mesmo nome na mesma pasta cria uma nova versão e preserva o histórico no D1, com o conteúdo no R2.

### Agenda nativa

A Agenda reúne reuniões, prazos, compromissos, férias e missões. Usuários autenticados criam eventos pessoais com período, local, contexto e vínculo opcional a projeto. Atendimento, Coordenação, Gestão e Administração também podem publicar e acessar a agenda compartilhada; os demais cargos permanecem na agenda individual.

### Missões completas

No painel de Missões, clicar no card ou em `DETALHES COMPLETOS` abre a área operacional persistida da missão. Ela reúne descrição, cliente, projeto, responsável, prazo, prioridade, XP, checklist, comentários, anexos e histórico. Toda leitura ou alteração persistente exige sessão válida e autorização no servidor. Especialistas acessam e atualizam apenas os recursos permitidos pelo próprio escopo; coordenação, gestão e administração dependem da matriz RBAC V2 configurada.

## Publicação no Cloudflare Pages

Depois de enviar este repositório ao GitHub, no Cloudflare Pages selecione **Create application → Pages → Connect to Git** e escolha o repositório do SIX.OS. Use estas configurações:

- **Production branch:** `main`.
- **Build command:** `pnpm build`.
- **Build output directory:** `dist`.
- **Node.js:** a versão `22.16.0` já está fixada em `.node-version`.
- **pnpm:** defina `PNPM_VERSION` como `11.9.0` nas variáveis de ambiente do Pages.

O projeto de produção já está vinculado ao banco D1 `six-os` pela variável `DB`. A configuração reproduzível fica em `wrangler.toml`; as migrations incluem a estrutura, catálogos de sistema e a limpeza compensatória dos antigos registros de demonstração.

### Acesso compartilhado com Cloudflare Access

O ambiente de produção tem a aplicação **SIX.OS** do tipo **Self-hosted** para `six-os.pages.dev`. A política **SIX.OS — Guilherme** permite apenas `six.guimell@gmail.com` e está preservada para reativação.

Para adicionar alguém ao time:

1. Inclua o e-mail em uma política do Cloudflare Access.
2. Insira no D1 o usuário com o mesmo e-mail e crie o respectivo perfil em `gamification_profiles`.
3. As Functions aceitam `Cf-Access-Authenticated-User-Email` somente quando o JWT `Cf-Access-Jwt-Assertion` é válido e contém o mesmo e-mail.

Sem uma sessão Cloudflare Access ou SIX válida, o frontend exibe a tela de login e as APIs recusam acesso ao banco.

### Segredos das integrações

Webhooks e tokens são criptografados com AES-GCM antes de serem gravados no D1. Gere uma chave aleatória de 32 bytes em base64:

```bash
openssl rand -base64 32
```

Cadastre o resultado como secret criptografado `INTEGRATIONS_ENCRYPTION_KEY` nas configurações do Cloudflare Pages. No ambiente local, use `.dev.vars`, que está ignorado pelo Git. Não coloque a chave no `wrangler.toml`.

## Versões

As entregas seguem o processo descrito em `VERSIONING.md`. Os marcos recuperáveis são as tags de lançamento, começando por `v0.0.1`.

## Próximas etapas

O plano completo de entregas, dependências e critérios de avanço está em [ROADMAP.md](ROADMAP.md).

A prioridade atual é concluir a Agenda nativa e suas regras de privacidade. As integrações com Runrun.it, Google/Outlook Calendar e Slack foram reservadas para a fase final.
