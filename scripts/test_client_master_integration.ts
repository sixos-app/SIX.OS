import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')
const admin = read('src/components/admin/AdminPage.tsx')
const libraryPage = read('src/components/library/LibraryPage.tsx')
const libraryManager = read('src/components/library/ClientLibraryManager.tsx')
const clientRepository = read('src/data/clientRepository.ts')
const clientLibraryRepository = read('src/data/clientLibraryRepository.ts')
const projectCreate = read('src/components/projects/ProjectCreateModal.tsx')
const projectsPage = read('src/components/projects/ProjectsPage.tsx')
const missions = read('src/components/missions/MissionCreateModal.tsx')
const modal = read('src/components/clients/ClientMasterModal.tsx')
const styles = read('src/styles.css')

function pass(id: string, test: () => void) { test(); console.log(`${id}: PASS`) }

pass('I-ADMIN-LIST', () => { assert.match(admin, /getClientIdentities/); assert.match(admin, /admin-client-master-list/) })
pass('I-ADMIN-CREATE', () => { assert.match(admin, /setMasterClientId\(client\.id\)/); assert.match(admin, /AdminClientDialog/) })
pass('I-ADMIN-OPEN', () => assert.match(admin, /<ClientMasterModal/))
pass('I-LIBRARY-OPEN', () => { assert.match(libraryPage, /<ClientMasterModal/); assert.match(libraryPage, /client-library-master-open/) })
pass('I-LIBRARY-REUSE', () => { assert.match(modal, /<ClientLibraryManager/); assert.match(libraryManager, /provisionClientLibrary/) })
pass('I-LIBRARY-LEGACY-SAFE', () => { assert.match(libraryManager, /reason\.status !== 404/); assert.match(clientLibraryRepository, /ClientLibraryRequestError/) })
pass('I-PROJECT-SUMMARY', () => { assert.match(projectCreate, /ClientIdentity/); assert.match(projectCreate, /item\.name.*item\.shortCode/); assert.doesNotMatch(projectCreate, /ClientMaster/) })
pass('I-PROJECTS-PAGE-SUMMARY', () => { assert.match(projectsPage, /ClientIdentity/); assert.doesNotMatch(projectsPage, /ClientMaster/) })
pass('I-MISSION-NO-CLIENT-MASTER', () => assert.doesNotMatch(missions, /ClientMaster/))
pass('I-NAME-SEMANTICS', () => { assert.match(modal, /NOME OPERACIONAL/); assert.match(modal, /RAZÃO SOCIAL/); assert.match(modal, /NOME FANTASIA/) })
pass('I-SPARSE-NULL', () => { assert.match(modal, /clientPatch/); assert.match(modal, /event\.target\.value \|\| null/) })
pass('I-CONTACT-RELOAD', () => assert.match(modal, /getClientContacts/))
pass('I-CONTRACT-RELOAD', () => assert.match(modal, /getClientContracts/))
pass('I-FINANCE-SEPARATION', () => { assert.match(modal, /canViewFinance/); assert.match(modal, /canManageFinance/); assert.doesNotMatch(modal, /inadimplência|LTV|faturamento/) })
pass('I-RBAC-SCOPES', () => { assert.match(clientRepository, /response\.status === 403/); assert.doesNotMatch(modal, /assigned_clients|participating_projects/) })
pass('I-ACCOUNT-MANAGER', () => { assert.match(modal, /can\('users\.manage'\)/); assert.match(modal, /Responsável interno preservado/) })
pass('I-A11Y', () => { assert.match(modal, /role="tablist"/); assert.match(modal, /ArrowRight/); assert.match(styles, /client-master-tabs button:focus-visible/) })
pass('I-SINGLE-SURFACE', () => { const css = (styles.match(/\.client-master[^\{]*\{[^}]*\}/g) ?? []).join('\n'); assert.doesNotMatch(css, /position:\s*(sticky|fixed)|overflow-y:\s*auto/); assert.match(styles, /shared-modal-overlay/) })
pass('I-NO-LOOP-PROVISION', () => { assert.match(libraryManager, /\[canManageLibrary, client\.id\]/); assert.match(libraryManager, /reason\.status !== 404/) })
console.log('Client master integration contract: PASS')
