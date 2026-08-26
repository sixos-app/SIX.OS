import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { FileUploadField } from '../src/components/shared/FileUploadField.tsx'
import { FormField } from '../src/components/shared/FormField.tsx'
import { ModalHeader } from '../src/components/shared/ModalHeader.tsx'
import { isModalCloseKey, ModalShell } from '../src/components/shared/ModalShell.tsx'

const repository = process.cwd()
const modalSource = readFileSync(resolve(repository, 'src/components/shared/ModalShell.tsx'), 'utf8')
const modalHeaderSource = readFileSync(resolve(repository, 'src/components/shared/ModalHeader.tsx'), 'utf8')
const uploadSource = readFileSync(resolve(repository, 'src/components/shared/FileUploadField.tsx'), 'utf8')
const styles = readFileSync(resolve(repository, 'src/styles.css'), 'utf8')

const modalMarkup = renderToStaticMarkup(createElement(
  ModalShell,
  {
    accessibleTitle: 'Teste de modal',
    children: [
      createElement(ModalHeader, { key: 'header', onClose: () => undefined, title: 'Teste de modal' }),
      createElement('p', { key: 'content' }, 'Conteúdo do modal'),
    ],
    onClose: () => undefined,
  },
))

assert.match(modalMarkup, /role="dialog"/)
assert.match(modalMarkup, /aria-modal="true"/)
const titleId = modalMarkup.match(/aria-labelledby="([^"]+)"/)?.[1]
assert.ok(titleId, 'ModalShell must associate the dialog with a title')
assert.match(modalMarkup, new RegExp(`<h2 id="${titleId}"[^>]*>Teste de modal</h2>`))
assert.match(modalMarkup, /Conteúdo do modal/)
assert.equal(isModalCloseKey('Escape'), true)
assert.equal(isModalCloseKey('Enter'), false)
assert.match(modalSource, /window\.addEventListener\('keydown', handleKeyDown\)/)
assert.match(modalSource, /document\.body\.style\.overflow = 'hidden'/)
assert.match(modalSource, /previouslyFocused\?\.isConnected/)
assert.match(modalHeaderSource, /onClick=\{onClose\}/)

const fieldMarkup = renderToStaticMarkup(createElement(
  FormField,
  { children: createElement('input', { type: 'text' }), controlId: 'company-name', error: 'Campo obrigatório', hint: 'Use o nome comercial.', label: 'Nome do cliente', required: true },
))

assert.match(fieldMarkup, /<label[^>]*for="company-name"/)
assert.match(fieldMarkup, /aria-invalid="true"/)
assert.match(fieldMarkup, /aria-describedby="[^"]+-hint [^"]+-error"/)
assert.match(fieldMarkup, /role="alert"/)

const fileMarkup = renderToStaticMarkup(createElement(FileUploadField, {
  accept: 'image/png',
  hint: 'PNG aceito.',
  label: 'Imagem',
  maxBytes: 250000,
}))

assert.match(fileMarkup, /type="file"/)
assert.match(fileMarkup, /shared-file-upload__native-input/)
assert.match(fileMarkup, /SELECIONAR ARQUIVO/)
assert.match(uploadSource, /inputRef\.current\?\.click\(\)/)
assert.match(uploadSource, /inputRef\.current\.value = ''/)
assert.match(uploadSource, /setFile\(nextFile\)/)

const sharedPrimitiveCss = styles.slice(styles.indexOf('/* Shared UI primitives'), styles.indexOf('.sidebar-version-badge'))
assert.doesNotMatch(sharedPrimitiveCss, /position:\s*sticky/)
const surfaceCss = sharedPrimitiveCss.match(/\.shared-modal-surface \{[^}]+\}/)?.[0] ?? ''
assert.doesNotMatch(surfaceCss, /overflow/)
assert.doesNotMatch(surfaceCss, /max-height/)

console.log('Shared UI primitives contract: PASS')
