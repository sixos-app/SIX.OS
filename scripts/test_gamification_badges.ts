import assert from 'node:assert/strict'
import { access, readFile, readdir } from 'node:fs/promises'
import { constants } from 'node:fs'
import { GAMIFICATION_LEVELS } from '../shared/gamificationLevels.ts'
import { GAMIFICATION_BADGES } from '../src/data/gamificationBadges.ts'

const badgeIds = Object.keys(GAMIFICATION_BADGES).sort()
const officialIds = GAMIFICATION_LEVELS.map(level => level.id).sort()
const badgeUrls = Object.values(GAMIFICATION_BADGES)

assert.equal(badgeIds.length, 25)
assert.deepEqual(badgeIds, officialIds)
assert.equal(new Set(badgeUrls).size, 25)
assert.ok(badgeUrls.every(url => url.startsWith('/gamification/levels/') && url.endsWith('.png')))

const destination = new URL('../public/gamification/levels/', import.meta.url)
const destinationFiles = (await readdir(destination)).filter(file => file.endsWith('.png')).sort()
assert.equal(destinationFiles.length, 25)
assert.deepEqual(destinationFiles, badgeUrls.map(url => url.split('/').at(-1)!).sort())
for (const url of badgeUrls) await access(new URL(`../public${url}`, import.meta.url), constants.R_OK)

const component = await readFile(new URL('../src/components/gamification/LevelBadge.tsx', import.meta.url), 'utf8')
const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')

assert.match(styles, /\.level-badge\s*\{[^}]*aspect-ratio:\s*1/s)
assert.match(styles, /\.level-badge img\s*\{[^}]*object-fit:\s*contain/s)
assert.match(styles, /\.level-badge--xs/)
assert.match(styles, /\.level-badge--sm/)
assert.match(styles, /\.level-badge--md/)
assert.match(styles, /\.level-badge--lg/)
assert.match(styles, /\.level-badge--xl/)
assert.match(component, /onError=\{\(\) => setHasError\(true\)\}/)
assert.match(component, /level-badge__fallback/)
assert.match(component, /decorative \? '' : label/)
assert.match(component, /loading=\{loading\}/)

console.log('✅ GAMIFICATION BADGES: registry, arquivos públicos e contrato LevelBadge verificados.')
