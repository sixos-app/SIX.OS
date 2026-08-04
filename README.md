# SIX.OS

MVP inicial do sistema operacional gamificado da Agência SIX.

**Versão atual:** `0.30.0`

## O que já está implementado

- Dashboard responsivo com identidade visual SIX.
- Navegação entre os módulos previstos do produto.
- Missões com filtros e conclusão que atualiza o XP.
- Agenda, projetos em andamento e feed interno com dados demonstrativos.
- Painel inicial da SIX AI.
- Camada de dados tipada, preparada para consumir a API do produto.
- Migração inicial e rotas de API para Cloudflare D1.
- Painel administrativo com cadastros protegidos de colaboradores e clientes.
- Identidade de cliente com sigla e imagem de perfil aplicada aos projetos.
- Biblioteca por projeto com pastas padrão, metadados de armazenamento e estrutura de histórico de versões no D1.

## Executar localmente

```bash
pnpm install
pnpm dev
```

Para gerar a versão de produção:

```bash
pnpm build
```

### Prévia da tela de login

Com o servidor local em execução, abra `http://127.0.0.1:5173/?preview=login`. A interface usa os endpoints de sessão do Pages quando o app é servido por `wrangler pages dev` ou Cloudflare Pages.

### Administrador inicial

A migration `0004_admin_credentials.sql` cria o perfil administrativo `agsix`, as tabelas de credenciais e sessões, e o associa ao cargo Administrador. A senha fornecida para a configuração inicial é armazenada apenas como derivação PBKDF2 com salt individual. Troque-a antes de aplicar a migration no ambiente remoto.

### Imagem de cliente

O cadastro de cliente exige uma sigla de 2 a 6 caracteres. Ela é o fallback visual em projetos quando não há imagem. Até a integração com Cloudflare R2, a imagem de perfil aceita PNG, JPEG e WebP de até 250 KB e é guardada temporariamente no D1.

### Biblioteca do projeto

Cada projeto recebe as pastas `Logo`, `KV`, `Vídeos`, `Artes`, `Briefing`, `Contrato` e `Outros`, além de pastas personalizadas criadas por Administração e Gestão. É possível enviar arquivos de até 25 MB pela Biblioteca do Projeto; um reenvio com o mesmo nome na mesma pasta cria uma nova versão. O D1 guarda organização e histórico, enquanto o conteúdo vai para o Cloudflare R2. A integração foi validada localmente; o bucket remoto `six-os-files` deve ser criado antes da próxima publicação. Links do MEGA.nz serão apenas referências compartilhadas opcionais.

## Publicação no Cloudflare Pages

Depois de enviar este repositório ao GitHub, no Cloudflare Pages selecione **Create application → Pages → Connect to Git** e escolha o repositório do SIX.OS. Use estas configurações:

- **Production branch:** `main`.
- **Build command:** `pnpm build`.
- **Build output directory:** `dist`.
- **Node.js:** a versão `22.16.0` já está fixada em `.node-version`.
- **pnpm:** defina `PNPM_VERSION` como `11.9.0` nas variáveis de ambiente do Pages.

O projeto de produção já está vinculado ao banco D1 `six-os` pela variável `DB`. A configuração reproduzível fica em `wrangler.toml`; as migrations incluem a estrutura e os dados iniciais do SIX.OS.

### Acesso compartilhado com Cloudflare Access

O ambiente de produção tem a aplicação **SIX.OS** do tipo **Self-hosted** para `six-os.pages.dev`. A política **SIX.OS — Guilherme** permite apenas `six.guimell@gmail.com` e está preservada para reativação.

Durante os testes compartilhados, a política **SIX.OS — Teste público temporário** usa bypass para liberar o acesso direto ao app. Não envie dados reais ou confidenciais enquanto essa política estiver ativa.

Para adicionar alguém ao time:

1. Inclua o e-mail em uma política do Cloudflare Access.
2. Insira no D1 o usuário com o mesmo e-mail e crie o respectivo perfil em `gamification_profiles`.
3. As Functions usam o cabeçalho verificado `Cf-Access-Authenticated-User-Email` para identificar a pessoa e limitar os dados à sua organização.

Sem uma sessão Cloudflare Access ou SIX válida, o frontend continua no modo local e as APIs recusam acesso ao banco. Enquanto a política pública temporária estiver ativa, não cadastre dados reais ou confidenciais.

## Versões

As entregas seguem o processo descrito em `VERSIONING.md`. Os marcos recuperáveis são as tags de lançamento, começando por `v0.0.1`.

## Próximas etapas

O plano completo de entregas, dependências e critérios de avanço está em [ROADMAP.md](ROADMAP.md).

A prioridade atual é concluir a validação de acesso e fundação. As integrações com Runrun.it, Google/Outlook Calendar e Slack foram reservadas para a fase final.
