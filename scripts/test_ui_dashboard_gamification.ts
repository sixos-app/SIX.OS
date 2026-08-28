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
assert.match(dashboard, /<div className="momentum-decoration" aria-hidden="true">[\s\S]*?<div className="momentum-decoration-visual">[\s\S]*?orbit-one[\s\S]*?orbit-two/)
assert.ok(dashboard.indexOf('className="momentum-art"') < dashboard.indexOf('className="xp-meter"'))
const momentumArt = dashboard.match(/<div className="momentum-art"[\s\S]*?<\/div>\n        <div className="xp-meter">/)?.[0] ?? ''
assert.ok(momentumArt.length > 0)
assert.doesNotMatch(momentumArt, /orbit-one|orbit-two|momentum-decoration/)

const momentumMeter = dashboard.match(/<div className="xp-meter">[\s\S]*?<\/div>\n      <\/section>/)?.[0] ?? ''
assert.ok(momentumMeter.length > 0)
assert.doesNotMatch(momentumMeter, /completionRate/)
assert.doesNotMatch(dashboard, /gamification\/levels\/\d|\.png/)

const homeBaseStart = styles.indexOf('.momentum-card {')
const homeBaseEnd = styles.indexOf('.dashboard-grid {', homeBaseStart)
const homeBaseContract = homeBaseStart >= 0 && homeBaseEnd > homeBaseStart ? styles.slice(homeBaseStart, homeBaseEnd) : ''
const mobileFlowStart = styles.indexOf('/* GAM-4.4: single responsive Home gamification strategy. */')
const mobileFlowContract = mobileFlowStart >= 0 ? styles.slice(mobileFlowStart) : ''
assert.ok(homeBaseContract.length > 0)
assert.ok(mobileFlowContract.length > 0)
assert.equal(styles.match(/\.momentum-art\s*\{/g)?.length, 1)
assert.equal(styles.match(/\.momentum-badge\s*\{/g)?.length, 1)
assert.equal(styles.match(/\/\* GAM-4\.4: single responsive Home gamification strategy\. \*\//g)?.length, 1)
assert.match(homeBaseContract, /\.momentum-card \{[^}]*grid-template-columns: minmax\(0, 1fr\) minmax\(220px, \.72fr\);[^}]*grid-template-areas: "copy badge" "meter meter";/)
assert.doesNotMatch(homeBaseContract, /\.momentum-card \{[^}]*min-height:/)
assert.match(homeBaseContract, /\.momentum-copy \{[^}]*grid-area: copy;[^}]*background: transparent;/)
assert.match(homeBaseContract, /\.momentum-decoration \{[^}]*position: relative;[^}]*grid-area: badge;[^}]*pointer-events: none;/)
assert.match(homeBaseContract, /\.momentum-decoration-visual \{[^}]*align-self: stretch;[^}]*justify-self: stretch;/)
assert.match(homeBaseContract, /\.momentum-art \{[^}]*position: relative;[^}]*grid-area: badge;[^}]*background: transparent;[^}]*border: 0;[^}]*box-shadow: none;[^}]*outline: 0;[^}]*overflow: visible;/)
assert.match(homeBaseContract, /\.momentum-badge \{[^}]*background: transparent;[^}]*border: 0;[^}]*box-shadow: none;[^}]*outline: 0;/)
assert.match(homeBaseContract, /\.xp-meter \{[^}]*position: relative;[^}]*grid-area: meter;[^}]*background: transparent;/)
assert.doesNotMatch(homeBaseContract, /\.momentum-(?:art|badge) \{[^}]*position: absolute|\.xp-meter \{[^}]*position: absolute/)
assert.doesNotMatch(homeBaseContract, /\.momentum-art \{[^}]*(?:height|min-height|overflow: hidden):?/)
assert.match(mobileFlowContract, /@media \(max-width: 780px\) \{[\s\S]*?\.momentum-card \{[^}]*grid-template-columns: minmax\(0, 1fr\) auto;[^}]*grid-template-areas: "copy badge" "meter meter";/)
assert.match(mobileFlowContract, /\.momentum-art \.level-badge \{ --level-badge-size: clamp\(64px, 22vw, 98px\); \}/)
assert.doesNotMatch(mobileFlowContract, /\.momentum-art\s*\{|\.momentum-badge\s*\{|\.xp-meter \{[^}]*position:/)
assert.doesNotMatch(mobileFlowContract, /\.momentum-card \{[^}]*(?:height|min-height):/)
assert.doesNotMatch(styles, /\.momentum[^\n]*transform: scale/)

console.log('✅ HOME GAMIFICATION: engine oficial, selo atual, XP real, máximo e contrato estrutural responsivo verificados.')
