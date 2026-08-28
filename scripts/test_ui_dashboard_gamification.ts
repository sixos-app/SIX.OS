import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { getLevelProgress } from '../shared/gamificationLevels.ts'
import { getGamificationBadgeUrl } from '../src/data/gamificationBadges.ts'

const dashboard = await readFile(new URL('../src/components/dashboard/DashboardPage.tsx', import.meta.url), 'utf8')
const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')

for (const [xp, id, name] of [
  [0, '01-criador', 'Criador'],
  [8700, '02-visionario', 'Visionário'],
  [20500, '05-impulsionador', 'Impulsionador'],
  [103000, '16-transformador', 'Transformador'],
  [216000, '25-originador', 'Originador'],
  [500000, '25-originador', 'Originador'],
] as const) {
  const progress = getLevelProgress(xp)
  assert.equal(progress.currentLevel.id, id)
  assert.equal(progress.currentLevel.name, name)
  assert.equal(getGamificationBadgeUrl(progress.currentLevel.id), `/gamification/levels/${id}.png`)
}

assert.equal(getLevelProgress(0).progressPercent, 0)
assert.equal(getLevelProgress(4350).progressPercent, 50)
assert.ok(getLevelProgress(8699).progressPercent < 100)
assert.equal(getLevelProgress(8700).progressPercent, 0)
assert.equal(getLevelProgress(216000).progressPercent, 100)
assert.equal(getLevelProgress(500000).progressPercent, 100)
assert.equal(getLevelProgress(216000).nextLevel, null)
assert.equal(getLevelProgress(216000).xpRemaining, 0)

assert.match(dashboard, /import \{ getLevelProgress \} from '\.\.\/\.\.\/\.\.\/shared\/gamificationLevels'/)
assert.match(dashboard, /import \{ LevelBadge \} from '\.\.\/gamification\/LevelBadge'/)
assert.match(dashboard, /const levelProgress = getLevelProgress\(totalXp\)/)
assert.match(dashboard, /<LevelBadge level=\{currentLevel\} size="xl" decorative loading="eager" \/>/)
assert.match(dashboard, /<div className="momentum-badge">/)
assert.match(dashboard, /\{nextLevel \? `\$\{xpRemaining\.toLocaleString\('pt-BR'\)\} XP para \$\{nextLevel\.name\}` : 'NÍVEL MÁXIMO ALCANÇADO'\}/)
assert.match(dashboard, /aria-valuenow=\{Math\.round\(progressPercent\)\}/)
assert.match(dashboard, /<i style=\{\{ width: `\$\{progressPercent\}%` \}\} \/>/)
assert.match(dashboard, /VER MINHA JORNADA/)
assert.doesNotMatch(dashboard, /GO MAKE\s*<br\s*\/?\s*>\s*IT POSSIBLE/)
assert.ok(dashboard.indexOf('className="momentum-art"') < dashboard.indexOf('className="xp-meter"'))

const momentumMeter = dashboard.match(/<div className="xp-meter">[\s\S]*?<\/div>\n      <\/section>/)?.[0] ?? ''
assert.ok(momentumMeter.length > 0)
assert.doesNotMatch(momentumMeter, /completionRate/)
assert.doesNotMatch(dashboard, /gamification\/levels\/\d|\.png/)

assert.match(styles, /\.momentum-art \{[^}]*overflow: hidden/s)
assert.match(styles, /\.momentum-art::before \{[^}]*width: 185px[^}]*height: 185px/s)
assert.match(styles, /\.momentum-badge \{[^}]*position: relative[^}]*z-index: 2/s)
assert.match(styles, /\.momentum-art \.level-badge \{[^}]*--level-badge-size: clamp\(104px, 10\.5vw, 150px\)/s)
assert.match(styles, /@media \(max-width: 780px\) \{[\s\S]*?\.momentum-art::before \{ width: 130px; height: 130px; \}/)
const mobileFlowStart = styles.indexOf('/* GAM-4.3: stable Home and Journey hero compositions. */')
const mobileFlowContract = mobileFlowStart >= 0 ? styles.slice(mobileFlowStart, mobileFlowStart + 5000) : ''
assert.ok(mobileFlowContract.length > 0)
assert.match(mobileFlowContract, /\.momentum-card \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) minmax\(220px, \.72fr\);[\s\S]*?grid-template-areas:[\s\S]*?"copy badge"[\s\S]*?"meter meter";/)
assert.match(mobileFlowContract, /\.momentum-copy \{[^}]*grid-area: copy;/)
assert.match(mobileFlowContract, /\.momentum-art \{[\s\S]*?grid-area: badge;[\s\S]*?background: transparent;[\s\S]*?border: 0;[\s\S]*?box-shadow: none;/)
assert.match(mobileFlowContract, /\.momentum-badge \{[^}]*background: transparent;[^}]*border: 0;[^}]*box-shadow: none;/)
assert.match(mobileFlowContract, /\.xp-meter \{[\s\S]*?grid-area: meter;[\s\S]*?position: relative;[\s\S]*?width: auto;[\s\S]*?bottom: auto;[\s\S]*?left: auto;/)
assert.match(mobileFlowContract, /@media \(max-width: 780px\) \{[\s\S]*?\.momentum-card \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) auto;[\s\S]*?grid-template-areas:[\s\S]*?"copy badge"[\s\S]*?"meter meter";/)
assert.match(mobileFlowContract, /@media \(max-width: 780px\) \{[\s\S]*?\.momentum-art \{[\s\S]*?position: relative;[\s\S]*?right: auto;[\s\S]*?bottom: auto;/)
assert.match(mobileFlowContract, /@media \(max-width: 780px\) \{[\s\S]*?\.xp-meter \{[^}]*position: relative;[^}]*bottom: auto;[^}]*left: auto;/)
assert.doesNotMatch(mobileFlowContract, /\.momentum-(?:art|badge)[\s\S]{0,180}position:\s*absolute|\.xp-meter[\s\S]{0,180}position:\s*absolute/)
assert.doesNotMatch(styles, /\.momentum[^\n]*transform: scale/)

console.log('✅ HOME GAMIFICATION: engine oficial, selo atual, XP real, máximo e contrato estrutural responsivo verificados.')
