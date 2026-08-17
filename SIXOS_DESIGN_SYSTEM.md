# SIX.OS — Design System & Diretrizes de Interface

## 1. Identidade Visual e Superfícies
- **Fundo Principal:** Escuro (#111110 / #191919) para modais operacionais e dialogs.
- **Cor Primária / Destaque Operacional:** Verde-Lima (#c6ff38).
- **Cores Semânticas:**
  - Sucesso / Concluído: #c6ff38
  - Atenção / Revisão: #ff7047 / #efad96
  - Destrutivo / Erro: #ff6b6b / rgba(239, 68, 68, 0.45)
  - Neutro / Secundário: #282825 / #85857e
- **Backdrop:** `background: rgba(18, 18, 17, 0.65); backdrop-filter: blur(8px);`
- **Border Radius:**
  - Modais: 16px
  - Painéis e Boxes: 8px a 10px
  - Badges e Tags: 4px a 6px
  - Botões de Ação: 8px

---

## 2. Sistema Global de Menções (`@mentions`)

> **REGRA FIXA:** Campos de texto colaborativos do SIX.OS devem utilizar o componente global de menções quando houver necessidade de comunicação entre usuários. Não implementar sistemas locais de `@mentions`.

### Componentes Obrigatórios:
- **`MentionTextarea`** (`src/components/shared/MentionTextarea.tsx`):
  Substituto padrão para campos `<textarea>` colaborativos. Suporta detecção do gatilho `@`, autocomplete pesquisável por `@login` e nome completo, navegação por teclado (`ArrowDown`, `ArrowUp`, `Enter`, `Tab`, `Escape`) e vinculação estruturada com a equipe.
- **`MentionRenderer`** (`src/components/shared/MentionRenderer.tsx`):
  Renderizador de texto para exibir `@login` destacado em verde-lima (`#c6ff38`, peso 800) e links seguros com abertura em nova aba.
- **`useMentions`** (`src/components/shared/useMentions.ts`):
  Hook reutilizável de lógica de menções para outros componentes customizados.

### Convenção de Identificação:
- No banco: `users.username` (ex.: `fernanda.alves`, sem o `@`).
- Na interface: `@login` (ex.: `@fernanda.alves`).
- Somente colaboradores com login cadastrado aparecem no autocomplete.
- O backend associa a notificação ao `user.id` real do colaborador.

---

## 3. Botões e Ações
- **Primário:** Fundo verde-lima (#c6ff38), texto escuro (#171717), peso 900, uppercase.
- **Secundário / Cancelar:** `.dialog-cancel-button` com fundo cinza grafite (#282825), borda (#44443f), texto claro (#d8d8d0).
- **Destrutivo:** `.mission-delete-button` com fundo vermelho translúcido (`rgba(239, 68, 68, 0.08)`), borda (`rgba(239, 68, 68, 0.45)`), texto (#ff6b6b), hover e pressed com transição suave.
