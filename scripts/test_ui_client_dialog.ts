import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import React, { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// Some legacy icons still use the classic JSX runtime. Set it before loading
// the dialog tree so this isolated SSR contract can render the existing icon.
globalThis.React = React

const { AdminClientDialog, buildAdminClientInput, validateAdminClientImage } = await import('../src/components/admin/AdminClientDialog.tsx')

const repository = process.cwd()
const source = readFileSync(resolve(repository, 'src/components/admin/AdminClientDialog.tsx'), 'utf8')
const styles = readFileSync(resolve(repository, 'src/styles.css'), 'utf8')
const createdInputs: Array<{ name: string; shortCode: string; imageDataUrl: string | null }> = []

const markup = renderToStaticMarkup(createElement(AdminClientDialog, {
  onClose: () => undefined,
  onCreate: async (input) => { createdInputs.push(input) },
}))

assert.match(markup, /role="dialog"/)
assert.match(markup, /aria-modal="true"/)
assert.match(markup, /aria-labelledby="[^"]+"/)
assert.match(markup, /NOME DO CLIENTE/)
assert.match(markup, /SIGLA DO CLIENTE/)
assert.match(markup, /IMAGEM DO PERFIL \(OPCIONAL\)/)
assert.match(markup, /type="file"/)
assert.match(markup, /CRIAR CLIENTE/)
assert.doesNotMatch(source, /mission-create-(overlay|dialog|scroll|footer|submit)/)
assert.match(source, /<ModalShell/)
assert.match(source, /<ModalHeader/)
assert.match(source, /<FormField/)
assert.match(source, /<FileUploadField/)
assert.match(source, /onChange=\{handleImageSelection\}/)
assert.match(source, /if \(!file\) \{\s*setImageDataUrl\(null\)/)
assert.match(source, /disabled=\{isSaving\}/)
assert.match(source, /onClose=\{onClose\}/)

assert.deepEqual(buildAdminClientInput({ name: ' Cliente SIX ', shortCode: ' six ', imageDataUrl: 'data:image/png;base64,abc' }), {
  name: 'Cliente SIX', shortCode: 'SIX', imageDataUrl: 'data:image/png;base64,abc',
})
assert.equal(validateAdminClientImage({ type: 'image/png', size: 250000 }), undefined)
assert.equal(validateAdminClientImage({ type: 'image/gif', size: 100 }), 'Use PNG, JPEG ou WebP de até 250 KB.')
assert.equal(validateAdminClientImage({ type: 'image/webp', size: 250001 }), 'Use PNG, JPEG ou WebP de até 250 KB.')
assert.equal(createdInputs.length, 0)

const clientCss = (styles.match(/\.admin-client-dialog[^\{]*\{[^}]*\}/g) ?? []).join('\n')
assert.doesNotMatch(clientCss, /position:\s*(sticky|fixed)/)
assert.doesNotMatch(clientCss, /overflow-y:\s*auto/)

console.log('Admin client dialog contract: PASS')
