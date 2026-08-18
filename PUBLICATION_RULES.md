# REGRA FIXA E PRIORITÁRIA DE PUBLICAÇÃO — SIX.OS

Esta instrução tem prioridade máxima sempre que houver pedido para publicar, implantar, subir para produção, gerar release ou atualizar o SIX.OS.

Nunca considere uma publicação concluída apenas porque o site foi enviado à Cloudflare. A versão publicada, o banco de produção e o Git devem representar exatamente o mesmo estado.

## 1. Diagnóstico obrigatório

Antes de modificar ou publicar:

1. Verifique a branch atual.
2. Verifique alterações locais e arquivos não rastreados.
3. Compare o `main` local com `origin/main`.
4. Inspecione:
   - `package.json`;
   - `README.md`;
   - `CHANGELOG.md`;
   - `VERSIONING.md`;
   - migrations pendentes;
   - último commit;
   - última tag;
   - último deployment da Cloudflare.
5. Identifique qual versão está atualmente em produção.

Não publique enquanto houver divergência não explicada.

## 2. Versionamento obrigatório

Determine a nova versão seguindo SemVer:

- PATCH: correções sem nova funcionalidade.
- MINOR: novas funcionalidades compatíveis.
- MAJOR: mudanças incompatíveis.

A mesma versão deve aparecer em:

- `package.json`;
- versão exibida no aplicativo;
- `README.md`;
- `CHANGELOG.md`;
- demais arquivos oficiais de versionamento.

Preserve sufixos beta ou pré-release quando o projeto estiver usando esse padrão.

Nunca altere apenas a versão visual do aplicativo.

## 3. Banco de dados

Antes do deployment:

1. Liste as migrations locais.
2. Liste as migrations pendentes no banco remoto.
3. Revise se a migration é segura e compatível com a versão anterior.
4. Execute primeiro migrations aditivas e retrocompatíveis.
5. Confirme novamente que não existem migrations remotas pendentes.

Se uma migration falhar ou permanecer pendente, interrompa a publicação. Não envie o frontend que depende dela.

Mudanças destrutivas devem usar estratégia expand-contract e exigem autorização explícita.

## 4. Validação obrigatória

Antes de publicar, execute no mínimo:

- typecheck do frontend;
- typecheck das Functions;
- testes de segurança e RBAC;
- testes dos fluxos alterados;
- build de produção;
- verificação de formatação e `git diff --check`.

No SIX.OS, execute preferencialmente a certificação completa:

`pnpm certify:beta`

Se qualquer verificação falhar, não publique e não marque a release.

## 5. Git antes da publicação

A publicação deve partir de código registrado no Git.

Ordem obrigatória:

1. Revisar o diff.
2. Garantir que nenhum segredo, token, credencial ou arquivo indevido será versionado.
3. Atualizar versão e changelog.
4. Criar um commit claro da release.
5. Enviar o commit para `origin/main`.
6. Confirmar que `main` local e `origin/main` apontam para o mesmo commit.
7. Criar tag anotada no formato `vX.Y.Z`.
8. Enviar a tag ao remoto.
9. Confirmar que a tag remota existe e aponta para o commit correto.

Nunca:

- publicar com alterações importantes não commitadas;
- usar uma tag de versão antiga;
- criar a tag em um commit diferente do código publicado;
- deixar README, changelog ou package com versões divergentes;
- incorporar tokens no endereço do remote Git.

## 6. Deployment

Somente depois de banco, testes, commit, push e tag:

1. Gere novamente o build a partir do commit da release.
2. Publique a pasta `dist` no projeto Cloudflare correto.
3. Use a branch `main`.
4. Registre o ID e a URL do deployment.
5. Confirme que o deployment informa como source o commit da release.

Evite `--commit-dirty=true`. Se for tecnicamente obrigatório, o working tree ainda deve estar limpo e o deployment deve corresponder ao commit já enviado.

## 7. Verificação em produção

Depois do deployment, confirme:

1. `https://sixos.app` responde HTTP 200.
2. A versão exibida e a versão contida no bundle são a nova versão.
3. O domínio oficial aponta para o deployment novo.
4. APIs protegidas retornam 401 sem autenticação.
5. Login e dashboard funcionam autenticados.
6. Os fluxos modificados funcionam com dados reais de teste.
7. Não há erros inesperados no console.
8. Não existem migrations remotas pendentes.
9. Desktop, tablet e mobile não apresentam overflow ou elementos cortados.

Se o deployment inicialmente retornar 404, aguarde a propagação e teste novamente antes de concluir que falhou.

## 8. Condições de interrupção

Interrompa a publicação se ocorrer qualquer uma destas condições:

- build ou teste com falha;
- migration pendente ou com erro;
- Git local divergente do remoto;
- ausência de commit ou tag;
- versão divergente entre arquivos;
- deployment associado ao commit errado;
- credenciais insuficientes;
- dúvida sobre o projeto, banco ou ambiente correto;
- alteração destrutiva não autorizada.

Nunca esconda falhas nem declare sucesso parcial como publicação concluída.

## 9. Relatório obrigatório

Ao finalizar, informe objetivamente:

- versão publicada;
- commit;
- tag;
- migration aplicada;
- URL oficial;
- URL do deployment;
- resultados dos testes;
- status HTTP;
- confirmação de que Git e produção estão sincronizados;
- qualquer validação que não tenha sido realizada.

Formato final obrigatório:

`PUBLICAÇÃO CONCLUÍDA E SINCRONIZADA`

Essa frase só pode ser usada quando:

- banco atualizado;
- certificação aprovada;
- commit no `origin/main`;
- tag remota correta;
- deployment ativo;
- versão confirmada em `sixos.app`.

Caso contrário, use:

`PUBLICAÇÃO INCOMPLETA — NÃO CONSIDERAR COMO RELEASE`
