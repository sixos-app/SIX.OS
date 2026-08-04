# Versionamento do SIX.OS

O marco inicial do projeto é `0.0.1`.

Toda alteração entregue deve elevar a versão antes de gerar o commit e a tag de lançamento.

- `0.0.x`: correções, ajustes visuais e melhorias pequenas.
- `0.x.0`: módulos ou recursos novos compatíveis com a versão atual.
- `x.0.0`: mudanças que exigem adaptação de integrações ou dados existentes.

## Processo de lançamento

1. Atualize a versão usando `pnpm run version:patch`, `pnpm run version:minor` ou `pnpm run version:major`.
2. Registre a mudança no `CHANGELOG.md`.
3. Valide com `pnpm build`.
4. Faça o commit da entrega e crie a tag `v<versão>` no mesmo commit.

Tags de lançamento nunca são regravadas. Para voltar uma entrega, use a tag anterior como referência.
