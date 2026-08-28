import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const manager = await readFile(new URL('../src/components/admin/GamificationManager.tsx', import.meta.url), 'utf8')
const endpoint = await readFile(new URL('../functions/api/admin/gamification.ts', import.meta.url), 'utf8')

const levelsView = manager.match(/\{tab === 'levels' && ([\s\S]*?)\n    \{tab === 'rewards'/)?.[1] ?? ''
assert.ok(levelsView.length > 0)
assert.match(levelsView, /GAMIFICATION_LEVELS\.map/)
assert.match(levelsView, /level\.name/)
assert.match(levelsView, /level\.description/)
assert.match(levelsView, /level\.minXp\.toLocaleString\('pt-BR'\)/)
assert.doesNotMatch(levelsView, /<input|onChange|onClick|onSave|levelConfig/)

assert.match(endpoint, /const OFFICIAL_LEVEL_CONFIG = GAMIFICATION_LEVELS\.map/)
assert.match(endpoint, /if \(input\.levelConfig !== undefined && !isOfficialLevelConfig\(input\.levelConfig\)\)/)
assert.match(endpoint, /Os níveis oficiais são definidos pelo produto e não podem ser alterados por organização/)
assert.match(endpoint, /VALUES \(\?, \?, NULL, \?, \?\)/)

console.log('✅ GAMIFICATION ADMIN READ-ONLY: níveis oficiais visíveis, sem edição na UI e bloqueados no endpoint.')
