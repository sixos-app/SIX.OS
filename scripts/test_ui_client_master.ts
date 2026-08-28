import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import React, { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

globalThis.React = React

const { ClientMasterModal, clientPatch, formatCnpj } = await import('../src/components/clients/ClientMasterModal.tsx')
const root = process.cwd()
const modal = readFileSync(resolve(root, 'src/components/clients/ClientMasterModal.tsx'), 'utf8')
const repository = readFileSync(resolve(root, 'src/data/clientRepository.ts'), 'utf8')
const libraryRepository = readFileSync(resolve(root, 'src/data/clientLibraryRepository.ts'), 'utf8')
const library = readFileSync(resolve(root, 'src/components/library/ClientLibraryManager.tsx'), 'utf8')
const page = readFileSync(resolve(root, 'src/components/library/LibraryPage.tsx'), 'utf8')
const styles = readFileSync(resolve(root, 'src/styles.css'), 'utf8')

const client = {
  id: 'client-a', name: 'Cliente A', shortCode: 'CLA', imageUrl: null, description: null, corporateName: null, tradeName: null,
  cnpj: '12345678000190', stateRegistration: null, municipalRegistration: null, segment: null, units: null, accountManagerId: null,
  status: 'active' as const, brandbookUrl: null, website: null,
  address: { zipCode: null, street: null, number: null, complement: null, district: null, city: null, state: null, country: 'BR' }, createdAt: '2026-01-01',
}

function pass(id: string, test: () => void) { test(); console.log(`${id}: PASS`) }

const markup = renderToStaticMarkup(createElement(ClientMasterModal, { clientId: 'client-a', onClose: () => undefined }))
pass('UI-CM1', () => assert.match(markup, /role="dialog"/))
pass('UI-CM2', () => assert.match(modal, /tab === 'general'/))
pass('UI-CM3', () => assert.match(modal, /tab === 'address'/))
pass('UI-CM4', () => { const next = { ...client, tradeName: 'Marca A', address: { ...client.address, city: 'São Paulo' } }; assert.deepEqual(clientPatch(client, next, undefined), { tradeName: 'Marca A', addressCity: 'São Paulo' }) })
pass('UI-CM5', () => { assert.equal(formatCnpj('12345678000190'), '12.345.678/0001-90'); assert.match(modal, /CNPJ/) })
pass('UI-CM6', () => assert.match(repository, /response\.status === 403/))
pass('UI-CM7', () => assert.match(modal, /client-master-manager/))
pass('UI-CM8', () => assert.match(modal, /value="paused"/))

pass('UI-CT1', () => assert.match(repository, /getClientContacts/))
pass('UI-CT2', () => assert.match(repository, /createClientContact/))
pass('UI-CT3', () => assert.match(repository, /updateClientContact/))
pass('UI-CT4', () => assert.match(modal, /Contato principal/))
pass('UI-CT5', () => assert.match(repository, /deactivateClientContact/))
pass('UI-CT6', () => assert.match(modal, /canManage/))
pass('UI-CT7', () => assert.match(modal, /Falha ao salvar contato/))

pass('UI-CO1', () => assert.match(repository, /getClientContracts/))
pass('UI-CO2', () => assert.match(modal, /canContracts/))
pass('UI-CO3', () => assert.match(modal, /canManageContracts/))
pass('UI-CO4', () => assert.match(modal, /Contratos em modo leitura/))
pass('UI-CO5', () => assert.match(modal, /canViewFinance/))
pass('UI-CO6', () => assert.match(modal, /contractValue/))
pass('UI-CO7', () => assert.match(modal, /canManageFinance/))
pass('UI-CO8', () => assert.match(repository, /createClientContract/))
pass('UI-CO9', () => assert.match(modal, /billingDay/))
pass('UI-CO10', () => assert.match(modal, /renewalType/))

pass('UI-FL1', () => assert.match(modal, /canLibrary/))
pass('UI-FL2', () => assert.match(modal, /\.\.\.\(canLibrary \? \['documents'\]/))
pass('UI-FL3', () => assert.match(library, /canManageLibrary/))
pass('UI-FL4', () => assert.match(library, /provisionClientLibrary/))
pass('UI-FL5', () => assert.match(libraryRepository, /provisionClientLibrary/))

pass('UI-A1', () => { assert.match(markup, /aria-modal="true"/); assert.match(markup, /aria-labelledby=/) })
pass('UI-A2', () => { assert.match(modal, /role="tablist"/); assert.match(modal, /ArrowRight/) })
pass('UI-A3', () => assert.match(modal, /<FormField/))
pass('UI-A4', () => assert.match(styles, /\.client-master-tabs button:focus-visible/))
pass('UI-A5', () => assert.match(modal, /<ModalShell/))
pass('UI-A6', () => assert.match(readFileSync(resolve(root, 'src/components/shared/ModalShell.tsx'), 'utf8'), /previouslyFocused/))
pass('UI-A7', () => { assert.match(page, /client-library-master-open/); assert.match(page, /aria-label=\{`Abrir cadastro mestre/) })

const clientCss = (styles.match(/\.client-master[^\{]*\{[^}]*\}/g) ?? []).join('\n')
pass('UI-S1', () => assert.match(styles, /\.shared-modal-overlay[^\{]*\{[^}]*overflow-y:\s*auto/))
pass('UI-S2', () => assert.doesNotMatch(clientCss, /position:\s*sticky/))
pass('UI-S3', () => assert.doesNotMatch(clientCss, /position:\s*(sticky|fixed)/))
pass('UI-S4', () => assert.doesNotMatch(clientCss, /overflow-y:\s*auto/))
pass('UI-S5', () => { assert.match(styles, /client-master-modal__body/); assert.match(styles, /shared-modal-overlay/) })

assert.doesNotMatch(modal, /role\s*===\s*['"]admin['"]/)
assert.doesNotMatch(modal, /mission-tabs/)
assert.match(page, /<ClientMasterModal/)
console.log('Client master UI contract: PASS')
